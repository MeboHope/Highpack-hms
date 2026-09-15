import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserPlus, Users, UserRoundCheck, UserRoundX, RefreshCw, Crown, Mail, Phone, KeyRound, Building2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { adminNav } from '@/components/dashboardNav';
import { Card, EmptyState, LoadingPage, Badge } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth, useToast } from '@/context/hooks';
import { formatDate, titleCase } from '@/lib/constants';

type StaffRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_super_admin: boolean;
  staff_status: 'active' | 'suspended' | null;
  staff_role_key: string | null;
  staff_role_name: string | null;
  permissions: string[] | null;
  created_at: string;
};

type StaffRole = { id: string; role_key: string; name: string; description: string; permissions: string[] };

export function AdminStaffPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleKey, setRoleKey] = useState('property_manager');
  const [properties, setProperties] = useState<Array<{ id: string; name: string; town: string | null; county: string | null }>>([]);
  const [scopeUser, setScopeUser] = useState<StaffRow | null>(null);
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [scopeBusy, setScopeBusy] = useState(false);

  const isSuperAdmin = Boolean(profile?.is_super_admin);

  const load = async () => {
    setLoading(true);
    const [{ data: members, error: memberError }, { data: roleRows, error: roleError }, { data: propertyRows, error: propertyError }] = await Promise.all([
      supabase.rpc('staff_members_for_admin'),
      supabase.from('staff_roles').select('id,role_key,name,description,permissions').order('name'),
      supabase.from('properties').select('id,name,town,county').order('name'),
    ]);
    if (memberError) toast(memberError.message, 'error');
    if (roleError) toast(roleError.message, 'error');
    if (propertyError) toast(propertyError.message, 'error');
    setStaff((members as StaffRow[]) || []);
    setRoles((roleRows as StaffRole[]) || []);
    setProperties((propertyRows as typeof properties) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const adminCount = useMemo(() => staff.filter((row) => row.role === 'admin').length, [staff]);
  const activeCount = useMemo(() => staff.filter((row) => row.staff_status === 'active' || row.is_super_admin).length, [staff]);

  const bootstrap = async () => {
    const { error } = await supabase.rpc('bootstrap_super_admin');
    if (error) { toast(error.message, 'error'); return; }
    toast('This administrator is now the Super Admin.', 'success');
    window.location.reload();
  };

  const invite = async () => {
    if (!email.trim() || !fullName.trim() || !roleKey) { toast('Enter the staff member’s name, email and role.', 'error'); return; }
    setInviteBusy(true);
    const { data, error } = await supabase.functions.invoke('staff-admin', { body: { action: 'invite', email, fullName, phone, roleKey } });
    setInviteBusy(false);
    if (error || data?.error) {
      let detail = data?.error || error?.message || 'Could not send staff invitation.';
      const context = (error as { context?: Response } | null)?.context;
      if (context instanceof Response) {
        try {
          const body = await context.clone().json() as { error?: string };
          if (body?.error) detail = body.error;
        } catch {
          // Keep the SDK error message when the response body is not JSON.
        }
      }
      toast(detail, 'error');
      return;
    }
    toast('Staff invitation sent. The staff member will set their password from the invitation.', 'success');
    setEmail(''); setFullName(''); setPhone(''); setRoleKey('property_manager'); setShowInvite(false);
    await load();
  };

  const updateStatus = async (userId: string, status: 'active' | 'suspended') => {
    const { data, error } = await supabase.functions.invoke('staff-admin', { body: { action: 'set_status', userId, status } });
    if (error || data?.error) { toast(error?.message || data?.error || 'Could not update staff status.', 'error'); return; }
    toast(status === 'active' ? 'Staff account reactivated.' : 'Staff account suspended.', 'success');
    await load();
  };

  const changeRole = async (userId: string, nextRole: string) => {
    const { data, error } = await supabase.functions.invoke('staff-admin', { body: { action: 'change_role', userId, roleKey: nextRole } });
    if (error || data?.error) { toast(error?.message || data?.error || 'Could not change staff role.', 'error'); return; }
    toast('Staff role updated.', 'success');
    await load();
  };

  const openScope = async (row: StaffRow) => {
    setScopeUser(row);
    setScopeBusy(true);
    const { data, error } = await supabase.rpc('staff_property_assignments_for_admin', { p_user_id: row.user_id });
    setScopeBusy(false);
    if (error) { toast(error.message, 'error'); setScopeUser(null); return; }
    setScopeIds((data || []).map((item: { property_id: string }) => item.property_id));
  };

  const saveScope = async () => {
    if (!scopeUser) return;
    setScopeBusy(true);
    const { data, error } = await supabase.rpc('set_staff_property_assignments', { p_user_id: scopeUser.user_id, p_property_ids: scopeIds });
    setScopeBusy(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(`${data ?? scopeIds.length} properties assigned to ${scopeUser.full_name || 'staff member'}.`, 'success');
    setScopeUser(null);
    await load();
  };

  return <DashboardLayout navItems={adminNav} title="Staff & Access">
    <div className="mb-7 flex flex-col gap-4 rounded-3xl brand-gradient p-6 text-white shadow-soft-lg sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Identity & security</p><h2 className="mt-1 text-2xl font-bold">Staff & access control</h2><p className="mt-2 max-w-3xl text-sm text-white/80">Create individual staff accounts, assign operational roles and suspend access without sharing administrator credentials.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void load()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>
        {isSuperAdmin && <button type="button" onClick={() => setShowInvite(true)} className="btn-primary"><UserPlus className="h-4 w-4" /> Invite staff</button>}
      </div>
    </div>

    {!isSuperAdmin && <Card className="mb-6 border-amber-200 bg-amber-50"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-amber-950"><Crown className="h-5 w-5" /><p className="font-bold">Super Admin is not assigned to this account</p></div><p className="mt-1 text-sm text-amber-900">If this is the first administrator in the system, bootstrap this account as the initial Super Admin. This button becomes unavailable once a Super Admin exists.</p></div><button type="button" onClick={() => void bootstrap()} className="btn-secondary whitespace-nowrap">Become Super Admin</button></div></Card>}

    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card><div className="flex items-center gap-3"><Users className="h-5 w-5 text-brand-600" /><div><p className="text-xs uppercase tracking-wide text-ink-400">Internal accounts</p><p className="mt-1 text-2xl font-bold text-ink-900">{adminCount}</p></div></div></Card>
      <Card><div className="flex items-center gap-3"><UserRoundCheck className="h-5 w-5 text-emerald-600" /><div><p className="text-xs uppercase tracking-wide text-ink-400">Active staff</p><p className="mt-1 text-2xl font-bold text-ink-900">{activeCount}</p></div></div></Card>
      <Card><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-accent-600" /><div><p className="text-xs uppercase tracking-wide text-ink-400">Defined operational roles</p><p className="mt-1 text-2xl font-bold text-ink-900">{roles.length}</p></div></div></Card>
    </div>

    {loading ? <LoadingPage /> : staff.length === 0 ? <EmptyState icon={<Users className="h-8 w-8" />} title="No internal staff accounts" description="Invite your first staff member when you are ready." /> : <Card className="overflow-hidden"><div className="border-b border-ink-100 px-5 py-4"><h3 className="font-semibold text-ink-900">Internal team</h3><p className="mt-1 text-xs text-ink-500">Each person has an individual account. Never share one administrator password between employees.</p></div><div className="overflow-x-auto"><table className="premium-table w-full min-w-[1100px] text-sm"><thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Permissions</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{staff.map((row) => <tr key={row.user_id}>
      <td><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">{(row.full_name || 'U').slice(0,1).toUpperCase()}</span><div><p className="font-semibold text-ink-900">{row.full_name || 'Unnamed staff'}</p><p className="text-xs text-ink-400">{row.user_id.slice(0,8)}…</p></div></div></td>
      <td>{row.is_super_admin ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"><Crown className="h-3 w-3" /> Super Admin</span> : row.staff_role_name ? <select disabled={!isSuperAdmin} className="input min-w-52 py-2 text-xs" value={row.staff_role_key || ''} onChange={(e) => void changeRole(row.user_id, e.target.value)}>{roles.map((r) => <option key={r.role_key} value={r.role_key}>{r.name}</option>)}</select> : <Badge>Administrator</Badge>}</td>
      <td>{row.is_super_admin ? <Badge status="active">Active</Badge> : <Badge status={row.staff_status || 'active'}>{titleCase(row.staff_status || 'active')}</Badge>}</td>
      <td><span className="text-xs text-ink-500">{row.permissions?.length || 0} module permissions</span></td>
      <td className="text-ink-500">{formatDate(row.created_at)}</td>
      <td><div className="flex gap-2">{row.phone && <span title={row.phone} className="icon-action"><Phone className="h-4 w-4" /></span>}{isSuperAdmin && !row.is_super_admin && row.staff_role_key && <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => void openScope(row)}><Building2 className="h-3.5 w-3.5" /> Scope</button>}{isSuperAdmin && !row.is_super_admin && <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => void updateStatus(row.user_id, row.staff_status === 'suspended' ? 'active' : 'suspended')}>{row.staff_status === 'suspended' ? <><UserRoundCheck className="h-3.5 w-3.5" /> Reactivate</> : <><UserRoundX className="h-3.5 w-3.5" /> Suspend</>}</button>}</div></td>
    </tr>)}</tbody></table></div></Card>}

    {scopeUser && <Modal open onClose={() => !scopeBusy && setScopeUser(null)} title={`Property scope · ${scopeUser.full_name || 'Staff member'}`} size="lg"><div className="space-y-4">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><p className="font-semibold text-brand-950">Assigned portfolio</p><p className="mt-1 text-xs leading-5 text-brand-900">This controls which properties this staff member can access when their role requires property-scoped data. Super Admins are unrestricted.</p></div>
      <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-ink-100 divide-y divide-ink-100">
        {properties.length === 0 ? <p className="p-5 text-sm text-ink-500">No properties are available for assignment.</p> : properties.map((property) => <label key={property.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-ink-50"><input type="checkbox" checked={scopeIds.includes(property.id)} onChange={(event) => setScopeIds((current) => event.target.checked ? [...current, property.id] : current.filter((id) => id !== property.id))} className="h-4 w-4 rounded border-ink-300 text-brand-600" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink-900">{property.name}</span><span className="block text-xs text-ink-500">{[property.town, property.county].filter(Boolean).join(', ') || 'Location not supplied'}</span></span></label>)}
      </div>
      <div className="flex gap-3 pt-2"><button type="button" onClick={() => setScopeUser(null)} className="btn-secondary flex-1">Cancel</button><button type="button" disabled={scopeBusy} onClick={() => void saveScope()} className="btn-primary flex-1">{scopeBusy ? 'Saving…' : `Save scope (${scopeIds.length})`}</button></div>
    </div></Modal>}

    {showInvite && <Modal open onClose={() => !inviteBusy && setShowInvite(false)} title="Invite staff member" size="md"><div className="space-y-4">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><div className="flex gap-3"><KeyRound className="mt-0.5 h-5 w-5 text-brand-700" /><div><p className="font-semibold text-brand-950">Individual sign-in</p><p className="mt-1 text-xs leading-5 text-brand-900">HighPark sends an invitation email. The staff member creates their own password; you do not need to know or share it.</p></div></div></div>
      <div><label className="label">Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Mary Wanjiku" /></div>
      <div><label className="label">Work email</label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@highparkconsult.com" /></div></div>
      <div><label className="label">Phone <span className="font-normal text-ink-400">(optional)</span></label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254…" /></div>
      <div><label className="label">Operational role</label><select className="input" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>{roles.map((role) => <option key={role.role_key} value={role.role_key}>{role.name}</option>)}</select>{roles.find((role) => role.role_key === roleKey) && <p className="mt-2 text-xs text-ink-500">{roles.find((role) => role.role_key === roleKey)?.description}</p>}</div>
      <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowInvite(false)} className="btn-secondary flex-1">Cancel</button><button type="button" disabled={inviteBusy} onClick={() => void invite()} className="btn-primary flex-1"><UserPlus className="h-4 w-4" /> {inviteBusy ? 'Sending…' : 'Send invitation'}</button></div>
    </div></Modal>}
  </DashboardLayout>;
}
