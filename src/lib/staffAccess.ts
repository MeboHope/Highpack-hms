import type { StaffAccess } from '@/context/AuthContext';

export function hasStaffPermission(access: StaffAccess, permission: string) {
  return access.isSuperAdmin || access.permissions.includes(permission);
}

export function canStaffAccessProperty(access: StaffAccess, propertyId: string | null | undefined, permission: string) {
  if (!hasStaffPermission(access, permission)) return false;
  return access.isSuperAdmin || Boolean(propertyId && access.assignedPropertyIds.includes(propertyId));
}

export const ADMIN_PERMISSION = {
  dashboard: 'dashboard.view',
  propertiesView: 'properties.view',
  propertiesManage: 'properties.manage',
  propertiesVerify: 'properties.verify',
  unitsView: 'units.view',
  unitsManage: 'units.manage',
  leasesView: 'leases.view',
  leasesManage: 'leases.manage',
  tenantsView: 'tenants.view',
  maintenanceView: 'maintenance.view',
  maintenanceManage: 'maintenance.manage',
  paymentsView: 'payments.view',
  paymentsManage: 'payments.manage',
  expensesView: 'expenses.view',
  expensesManage: 'expenses.manage',
  taxView: 'tax.view',
  taxManage: 'tax.manage',
  reportsView: 'reports.view',
  salesView: 'sales.view',
  salesManage: 'sales.manage',
  enquiriesView: 'enquiries.view',
  enquiriesManage: 'enquiries.manage',
  viewingsView: 'viewings.view',
  viewingsManage: 'viewings.manage',
  documentsView: 'documents.view',
  documentsManage: 'documents.manage',
  auditView: 'audit.view',
  customersView: 'customers.view',
  messagesView: 'messages.view',
  messagesManage: 'messages.manage',
  notificationsManage: 'notifications.manage',
  reservationsView: 'reservations.view',
  shortStayView: 'shortstay.view',
} as const;
