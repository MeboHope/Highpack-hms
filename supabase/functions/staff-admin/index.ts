import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

const safeMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '');
    if (message) return message;
  }
  return fallback;
};

const fail = (operation: string, error: unknown, status = 400) => {
  const message = safeMessage(error, 'Unknown error.');
  console.error(`[staff-admin] ${operation} failed:`, message);
  return json({ error: `${operation} failed: ${message}`, operation }, status);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[staff-admin] Required Supabase environment variables are missing.');
      return json({ error: 'Staff administration is not configured correctly on the server.' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization.' }, 401);

    // The browser has already supplied a valid Supabase access token in the
    // Authorization header. Validate that token explicitly with the trusted
    // service-role client instead of calling auth.getUser() on a client whose
    // session storage does not exist inside the Edge Function runtime.
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) return json({ error: 'Invalid authorization header.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !user) return fail('Authentication check', authError || new Error('Unauthorized.'), 401);

    const { data: caller, error: callerError } = await admin
      .from('profiles')
      .select('id,role,is_super_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (callerError) return fail('Super Admin profile lookup', callerError, 500);
    if (!caller || caller.role !== 'admin' || !caller.is_super_admin) {
      return json({ error: 'Only a Super Admin can manage staff accounts.' }, 403);
    }
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch (error) {
      return fail('Request parsing', error, 400);
    }

    const action = String(payload.action || '').trim();

    if (action === 'invite') {
      const email = String(payload.email || '').trim().toLowerCase();
      const fullName = String(payload.fullName || '').trim();
      const phone = String(payload.phone || '').trim() || null;
      const roleKey = String(payload.roleKey || '').trim();

      if (!email || !email.includes('@') || !fullName || !roleKey) {
        return json({ error: 'Email, full name and staff role are required.' }, 400);
      }

      const { data: staffRole, error: roleError } = await admin
        .from('staff_roles')
        .select('id,role_key,name')
        .eq('role_key', roleKey)
        .maybeSingle();

      if (roleError) return fail('Staff role lookup', roleError, 500);
      if (!staffRole) {
        return json({ error: `Staff role "${roleKey}" was not found. Refresh Staff & Access and try again.` }, 400);
      }

      const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || undefined;
      const redirectTo = siteUrl ? `${siteUrl.replace(/\/$/, '')}/reset-password` : undefined;
      console.log(`[staff-admin] Inviting ${email} as ${roleKey}. Redirect: ${redirectTo || 'Supabase default'}`);

      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, phone, invited_as_staff: true },
        redirectTo,
      });

      if (inviteError || !invited.user) {
        const message = safeMessage(inviteError, 'Supabase did not return an invited user.');
        const lower = message.toLowerCase();
        if (lower.includes('redirect') || lower.includes('url')) {
          return fail('Invitation email', new Error(`${message} Check Supabase Authentication > URL Configuration and ensure the HighPark site URL is allowed.`), 400);
        }
        if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
          return fail('Invitation email', new Error(`${message} This email may already have a HighPark account. Use a different email or manage the existing account.`), 400);
        }
        return fail('Invitation email', inviteError || new Error('Could not create invitation.'), 400);
      }

      const invitedUserId = invited.user.id;
      const { error: profileError } = await admin
        .from('profiles')
        .update({ role: 'admin', full_name: fullName, phone, updated_at: new Date().toISOString() })
        .eq('id', invitedUserId);

      if (profileError) {
        console.error('[staff-admin] Profile update failed after invitation; rolling back auth user.', profileError.message);
        await admin.auth.admin.deleteUser(invitedUserId);
        return fail('Staff profile update', profileError, 500);
      }

      const { error: staffError } = await admin
        .from('staff_members')
        .upsert({
          user_id: invitedUserId,
          staff_role_id: staffRole.id,
          status: 'active',
          invited_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (staffError) {
        console.error('[staff-admin] Staff membership insert failed after invitation; rolling back auth user.', staffError.message);
        await admin.auth.admin.deleteUser(invitedUserId);
        return fail('Staff membership creation', staffError, 500);
      }

      const { error: auditError } = await admin.from('audit_logs').insert({
        user_id: user.id,
        action: 'staff_invited',
        entity_type: 'profile',
        entity_id: invitedUserId,
        new_value: { email, full_name: fullName, staff_role: roleKey },
      });
      if (auditError) console.warn('[staff-admin] Audit log insert failed:', auditError.message);

      return json({ ok: true, userId: invitedUserId, role: staffRole.name });
    }

    if (action === 'set_status') {
      const userId = String(payload.userId || '');
      const status = String(payload.status || '');
      if (!userId || !['active', 'suspended'].includes(status)) return json({ error: 'Invalid staff status.' }, 400);
      if (userId === user.id) return json({ error: 'You cannot suspend your own account.' }, 400);

      const { error } = await admin.from('staff_members').update({ status, updated_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) return fail('Staff status update', error, 400);
      await admin.from('audit_logs').insert({ user_id: user.id, action: status === 'active' ? 'staff_reactivated' : 'staff_suspended', entity_type: 'profile', entity_id: userId, new_value: { status } });
      return json({ ok: true });
    }

    if (action === 'change_role') {
      const userId = String(payload.userId || '');
      const roleKey = String(payload.roleKey || '');
      if (!userId || !roleKey) return json({ error: 'Staff account and role are required.' }, 400);

      const { data: staffRole, error: roleError } = await admin.from('staff_roles').select('id,name').eq('role_key', roleKey).maybeSingle();
      if (roleError) return fail('Staff role lookup', roleError, 500);
      if (!staffRole) return json({ error: `Staff role "${roleKey}" was not found.` }, 400);

      const { error } = await admin.from('staff_members').update({ staff_role_id: staffRole.id, updated_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) return fail('Staff role update', error, 400);
      await admin.from('audit_logs').insert({ user_id: user.id, action: 'staff_role_changed', entity_type: 'profile', entity_id: userId, new_value: { staff_role: roleKey } });
      return json({ ok: true });
    }

    return json({ error: 'Unsupported staff action.' }, 400);
  } catch (error) {
    console.error('[staff-admin] Unexpected error:', error);
    return fail('Staff administration', error, 500);
  }
});
