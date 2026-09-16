import type { Profile } from '@/lib/supabase';
import type { StaffAccess } from '@/context/AuthContext';

export type RoleArea = 'public' | 'superadmin' | 'admin' | 'property_manager' | 'finance_officer' | 'sales_officer' | 'compliance_officer' | 'support_officer' | 'owner' | 'tenant' | 'customer';

const HOST_ROLE: Record<string, RoleArea> = {
  'superadmin.highparkconsult.com': 'superadmin',
  'admin.highparkconsult.com': 'admin',
  'property-manager.highparkconsult.com': 'property_manager',
  'finance.highparkconsult.com': 'finance_officer',
  'sales.highparkconsult.com': 'sales_officer',
  'compliance.highparkconsult.com': 'compliance_officer',
  'support.highparkconsult.com': 'support_officer',
  'owners.highparkconsult.com': 'owner',
  'owner.highparkconsult.com': 'owner',
  'tenants.highparkconsult.com': 'tenant',
  'tenant.highparkconsult.com': 'tenant',
  'portal.highparkconsult.com': 'customer',
};

export function roleAreaForHost(hostname = window.location.hostname): RoleArea {
  return HOST_ROLE[hostname.toLowerCase()] ?? 'public';
}

export function expectedRoleArea(profile: Profile | null, staff: StaffAccess): RoleArea {
  if (!profile) return 'public';
  if (profile.role === 'owner' || profile.role === 'agent') return 'owner';
  if (profile.role === 'customer') return 'tenant';
  if (staff.isSuperAdmin) return 'superadmin';
  if (staff.staffRoleKey === 'property_manager') return 'property_manager';
  if (staff.staffRoleKey === 'finance_officer') return 'finance_officer';
  if (staff.staffRoleKey === 'sales_officer') return 'sales_officer';
  if (staff.staffRoleKey === 'compliance_officer') return 'compliance_officer';
  if (staff.staffRoleKey === 'support_officer') return 'support_officer';
  return 'admin';
}

export function isRoleHostAllowed(profile: Profile | null, staff: StaffAccess): boolean {
  const hostRole = roleAreaForHost();
  if (hostRole === 'public' || !profile) return true;
  const expected = expectedRoleArea(profile, staff);
  return hostRole === expected;
}

export function roleSubdomain(area: RoleArea): string {
  if (area === 'public') return '';
  const hosts: Record<Exclude<RoleArea, 'public'>, string> = {
    superadmin: 'superadmin.highparkconsult.com',
    admin: 'admin.highparkconsult.com',
    property_manager: 'property-manager.highparkconsult.com',
    finance_officer: 'finance.highparkconsult.com',
    sales_officer: 'sales.highparkconsult.com',
    compliance_officer: 'compliance.highparkconsult.com',
    support_officer: 'support.highparkconsult.com',
    owner: 'owners.highparkconsult.com',
    tenant: 'tenants.highparkconsult.com',
    customer: 'portal.highparkconsult.com',
  };
  return hosts[area];
}
