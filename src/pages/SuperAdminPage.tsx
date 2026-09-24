import { useEffect, useState, type ReactNode } from 'react';
import { Activity, AlertTriangle, KeyRound, LockKeyhole, Settings, ShieldCheck, Users, UserCog } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { adminNav } from '@/components/dashboardNav';
import { Card, LoadingPage } from '@/components/ui';
import { useAuth, useRouter, useToast } from '@/context/hooks';
import { supabase } from '@/lib/supabase';


export function SuperAdminPage() {
  const { profile, staffAccess } = useAuth();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [staffCount, setStaffCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);

  useEffect(() => {
    if (!staffAccess.isSuperAdmin) return;
    void (async () => {
      setLoading(true);
      try {
        const [staff, audit, users] = await Promise.all([
          supabase.from('staff_members').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.rpc('get_admin_audit_page', { p_page: 1, p_page_size: 1, p_entity_type: null, p_action: null, p_query: null, p_severity: null, p_source: null, p_ip: null }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
        ]);
        if (staff.error) throw staff.error;
        if (users.error) throw users.error;
        if (audit.error) throw audit.error;
        setStaffCount(Number(staff.count || 0));
        setAuditCount(Number((audit.data as { total?: number } | null)?.total || 0));
        setAdminCount(Number(users.count || 0));
      } catch (error) {
        console.error('Super Admin overview error:', error);
        toast('Some Super Admin metrics could not be loaded.', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [staffAccess.isSuperAdmin]);

  if (!profile || !staffAccess.isSuperAdmin) {
    return <div className="p-8 text-center text-sm text-ink-500">Super Admin access required.</div>;
  }

  const controls = [
    { title: 'Staff identity & RBAC', description: 'Create staff accounts, assign roles and control property access.', icon: <UserCog className="h-5 w-5" />, href: '/admin/staff' },
    { title: 'Users & account control', description: 'Review administrator and customer account records.', icon: <Users className="h-5 w-5" />, href: '/admin/users' },
    { title: 'Security & MFA', description: 'Review your authenticator setup, sessions and security controls.', icon: <KeyRound className="h-5 w-5" />, href: '/security' },
    { title: 'Audit & security trail', description: 'Inspect IP addresses, user agents, sessions, severity and system events.', icon: <Activity className="h-5 w-5" />, href: '/admin/activity' },
    { title: 'System settings', description: 'Manage high-impact platform configuration reserved for Super Admin.', icon: <Settings className="h-5 w-5" />, href: '/admin/settings' },
  ];

  return (
    <DashboardLayout navItems={adminNav} title="Super Admin Command Center">
      <div className="mb-7 rounded-3xl brand-gradient p-7 text-white shadow-soft-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">System owner control plane</p>
            <h1 className="mt-2 text-3xl font-bold">Super Admin Command Center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">The highest-privilege administration workspace for identity, staff access, security posture, audit oversight and platform configuration.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur"><div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5" /><div><p className="text-xs text-white/70">Signed in as</p><p className="font-semibold">{profile.full_name || 'Super Admin'}</p></div></div></div>
        </div>
      </div>

      {loading ? <LoadingPage /> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<ShieldCheck className="h-5 w-5" />} label="Privilege level" value="Super Admin" detail="Unrestricted administrative role" />
          <Metric icon={<UserCog className="h-5 w-5" />} label="Active staff" value={staffCount.toLocaleString()} detail="Provisioned operational accounts" />
          <Metric icon={<Activity className="h-5 w-5" />} label="Audit events" value={auditCount.toLocaleString()} detail="Captured application events" />
          <Metric icon={<Users className="h-5 w-5" />} label="Admin accounts" value={adminCount.toLocaleString()} detail="Accounts with administrator profile" />
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          {controls.map((control) => <button key={control.href} type="button" onClick={() => navigate(control.href)} className="group rounded-3xl border border-ink-100 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-soft-lg"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 group-hover:bg-brand-100">{control.icon}</span><span><span className="block font-bold text-brand-950">{control.title}</span><span className="mt-1 block text-sm leading-6 text-ink-500">{control.description}</span></span></div></button>)}
        </div>

        <Card className="mt-7 border-amber-100 bg-amber-50/60 p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="font-bold text-amber-950">High-privilege operating rule</h2><p className="mt-1 text-sm leading-6 text-amber-900/80">Super Admin actions should be performed only from trusted devices. Staff role changes, privilege changes, sensitive financial workflows and security configuration changes remain auditable.</p></div></div></Card>
      </>}
    </DashboardLayout>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <Card className="p-5"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</span><span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</span></div><p className="mt-5 text-2xl font-bold text-brand-950">{value}</p><p className="mt-1 text-xs leading-5 text-ink-500">{detail}</p></Card>;
}
