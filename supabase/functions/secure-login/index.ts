import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const randomCode = () => { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return String(100000 + (bytes[0] % 900000)); };
const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return 'your email address';
  const visible = name.length <= 2 ? name[0] : name.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(1, Math.min(5, name.length - visible.length)))}@${domain}`;
};

const clientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
  return forwarded.split(',')[0].trim() || null;
};

const sendOtpEmail = async (email: string, code: string) => {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('SECURITY_OTP_FROM_EMAIL');
  if (!resendKey || !from) throw new Error('Security email delivery is not configured. Set RESEND_API_KEY and SECURITY_OTP_FROM_EMAIL.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'HighPark Consult sign-in verification code',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#172033"><h2 style="margin:0 0 12px">HighPark Consult</h2><p>A sign-in was attempted for your account.</p><p style="margin-top:24px;font-size:32px;letter-spacing:8px;font-weight:700">${code}</p><p>This code expires in 5 minutes and can only be used once.</p><p>If you did not attempt to sign in, ignore this email and consider changing your password.</p></div>`,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email provider rejected the message (${response.status}). ${text.slice(0, 240)}`);
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pepper = Deno.env.get('LOGIN_OTP_PEPPER');
  if (!supabaseUrl || !serviceRoleKey || !pepper) {
    console.error('[secure-login] required server configuration is missing.');
    return json({ error: 'Secure sign-in is temporarily unavailable. Please try again shortly.' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }

  const action = String(body.action || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  const challengeId = String(body.challengeId || '').trim();
  const clientNonce = String(body.clientNonce || '').trim();

  if (action === 'start') {
    const password = String(body.password || '');
    if (!email || !password || !clientNonce) return json({ error: 'Email, password and security challenge context are required.' }, 400);

    // IMPORTANT: do not call signInWithPassword here. Phase 51 installs a
    // Custom Access Token Hook that intentionally blocks password token issuance
    // until the email OTP challenge is verified. Calling signInWithPassword from
    // this preflight step would therefore trigger the same hook and deadlock the
    // login flow. Instead, the server-side SECURITY DEFINER verifier checks the
    // Supabase Auth password hash without issuing a JWT.
    const { data: passwordCheck, error: passwordCheckError } = await admin.rpc('verify_login_password', {
      p_email: email,
      p_password: password,
    });
    const passwordRow = Array.isArray(passwordCheck) ? passwordCheck[0] : passwordCheck;
    if (passwordCheckError || !passwordRow?.password_valid || !passwordRow?.user_id) {
      return json({ error: 'Invalid email or password.' }, 401);
    }

    const userId = String(passwordRow.user_id);
    const codeValue = randomCode();
    const challengeIdValue = crypto.randomUUID();
    const codeHash = await sha256(`${codeValue}:${pepper}:${challengeIdValue}`);
    const nonceHash = await sha256(`${clientNonce}:${pepper}`);
    const ip = clientIp(req);
    const userAgent = req.headers.get('user-agent');

    await admin.from('login_otp_challenges').update({ consumed_at: new Date().toISOString() }).eq('user_id', userId).is('consumed_at', null);
    const { data: challenge, error: challengeError } = await admin.from('login_otp_challenges').insert({
      id: challengeIdValue,
      user_id: userId,
      email,
      code_hash: codeHash,
      client_nonce_hash: nonceHash,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      attempts: 0,
    }).select('id,expires_at').single();
    if (challengeError || !challenge) return json({ error: 'Could not create the security verification challenge.' }, 500);

    try {
      await sendOtpEmail(email, codeValue);
    } catch (error) {
      await admin.from('login_otp_challenges').delete().eq('id', challenge.id);
      console.error('[secure-login] email delivery failed:', error);
      return json({ error: 'We could not send your verification email right now. Please try again shortly.' }, 503);
    }

    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'LOGIN_OTP_SENT',
      entity_type: 'security',
      metadata: { email_masked: maskEmail(email), challenge_id: challenge.id },
      ip_address: ip,
      user_agent: userAgent,
      severity: 'info',
      source: 'authentication',
    });

    return json({ ok: true, challengeId: challenge.id, email: maskEmail(email), expiresAt: challenge.expires_at });
  }

  if (action === 'verify') {
    if (!challengeId || !email || !code || !clientNonce || !/^\d{6}$/.test(code)) return json({ error: 'Enter the six-digit verification code.' }, 400);
    const { data: challenge, error: lookupError } = await admin.from('login_otp_challenges').select('*').eq('id', challengeId).eq('email', email).maybeSingle();
    if (lookupError || !challenge) return json({ error: 'This verification request is no longer valid. Start the sign-in process again.' }, 400);
    if (challenge.consumed_at || new Date(challenge.expires_at).getTime() < Date.now()) return json({ error: 'This verification code has expired. Start the sign-in process again.' }, 400);
    if (Number(challenge.attempts) >= 5) return json({ error: 'Too many incorrect verification attempts. Start the sign-in process again.' }, 429);

    const nonceHash = await sha256(`${clientNonce}:${pepper}`);
    if (nonceHash !== challenge.client_nonce_hash) return json({ error: 'This verification session is not valid.' }, 403);
    const expectedHash = await sha256(`${code}:${pepper}:${challenge.id}`);
    if (expectedHash !== String(challenge.code_hash)) {
      await admin.from('login_otp_challenges').update({ attempts: Number(challenge.attempts) + 1 }).eq('id', challenge.id);
      await admin.from('audit_logs').insert({ user_id: challenge.user_id, action: 'LOGIN_OTP_FAILED', entity_type: 'security', entity_id: challenge.user_id, metadata: { challenge_id: challenge.id, attempt: Number(challenge.attempts) + 1 }, ip_address: clientIp(req), user_agent: req.headers.get('user-agent'), severity: 'warning', source: 'authentication' });
      return json({ error: 'The verification code is incorrect.' }, 401);
    }

    const { data: magic, error: magicError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (magicError || !magic?.properties?.email_otp) return json({ error: 'The final secure session could not be prepared. Please try again.' }, 500);

    await admin.from('login_otp_challenges').update({ verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).eq('id', challenge.id);
    await admin.from('audit_logs').insert({ user_id: challenge.user_id, action: 'LOGIN_OTP_VERIFIED', entity_type: 'security', entity_id: challenge.user_id, metadata: { challenge_id: challenge.id }, ip_address: clientIp(req), user_agent: req.headers.get('user-agent'), severity: 'info', source: 'authentication' });

    return json({ ok: true, email, emailOtp: magic.properties.email_otp });
  }

  return json({ error: 'Unknown secure-login action.' }, 400);
});
