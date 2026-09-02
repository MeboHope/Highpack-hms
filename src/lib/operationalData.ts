import { supabase } from '@/lib/supabase';

type RawRow = Record<string, unknown>;

export interface ManagedExpenseRow {
  id: string; property_id: string; owner_id: string; category: string; amount: number; expense_date: string; vendor: string | null; description: string | null; payment_method: string; created_at: string;
  properties?: { name: string } | null;
}

export interface ManagedMaintenanceRow {
  id: string; tenant_id: string; property_id: string; unit_id: string; category: string; description: string; priority: 'low' | 'medium' | 'high' | 'urgent'; status: string; created_at: string; updated_at: string;
  property_units?: { unit_number: string } | null;
  properties?: { name: string } | null;
  profiles?: { full_name: string | null; phone: string | null } | null;
}

export interface DashboardPropertyPerformance {
  id: string;
  name: string;
  propertyType: string;
  units: number;
  available: number;
  reserved: number;
  occupied: number;
  tenants: number;
  expectedRent: number;
  collectedRent: number;
  tax: number;
  floors: Record<string, { total: number; available: number; occupied: number; reserved: number }>;
  unitTypes: Record<string, number>;
}

function number(value: unknown): number {
  return Number(value || 0);
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeRow(row: RawRow): DashboardPropertyPerformance {
  const unitTypes = Object.fromEntries(Object.entries(jsonRecord(row.unit_types)).map(([key, value]) => [key, number(value)]));
  const floors = Object.fromEntries(Object.entries(jsonRecord(row.floors)).map(([key, value]) => {
    const x = jsonRecord(value);
    return [key, { total: number(x.total), available: number(x.available), occupied: number(x.occupied), reserved: number(x.reserved) }];
  }));
  return {
    id: String(row.id),
    name: String(row.name || 'Unnamed property'),
    propertyType: String(row.property_type || 'Property'),
    units: number(row.units),
    available: number(row.available),
    reserved: number(row.reserved),
    occupied: number(row.occupied),
    tenants: number(row.tenants),
    expectedRent: number(row.expected_rent),
    collectedRent: number(row.collected_rent),
    tax: number(row.tax),
    floors,
    unitTypes,
  };
}

/**
 * Loads the portfolio summary through the hardened RPC first, then falls back
 * to the same live tables used by the admin screens. This makes the dashboard
 * resilient to an older Supabase schema cache while never inventing counts.
 */
export async function loadDashboardPropertyPerformance(userId: string, role: string, period: string): Promise<DashboardPropertyPerformance[]> {
  const rpc = await supabase.rpc('get_dashboard_property_performance', { p_period: period });
  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
    const rpcRows = (rpc.data as RawRow[]).map(normalizeRow);
    // A stale function/schema cache has historically returned property rows
    // with zero unit counts. If the whole portfolio is zeroed, use the live
    // table fallback instead of displaying misleading zeros.
    if (rpcRows.some((row) => row.units > 0)) return rpcRows;
  }

  const propertyQuery = role === 'admin'
    ? supabase.from('properties').select('id,name,property_type')
    : supabase.from('properties').select('id,name,property_type').eq('owner_id', userId);
  const { data: properties, error: propertyError } = await propertyQuery.order('name');
  if (propertyError || !properties?.length) return [];

  const ids = properties.map((p) => p.id);
  const start = `${period}-01`;
  const endDate = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;

  const [{ data: units }, { data: leases }, { data: payments }, { data: taxes }] = await Promise.all([
    supabase.from('property_units').select('property_id,status,monthly_rent,house_type,bedrooms,floor').in('property_id', ids),
    supabase.from('leases').select('property_id,status,tenant_id').in('property_id', ids),
    supabase.from('payments').select('property_id,amount,status,verified,payment_type,created_at').in('property_id', ids).eq('payment_type', 'rent').eq('status', 'successful').eq('verified', true).gte('created_at', start).lt('created_at', end),
    supabase.from('tax_records').select('property_id,estimated_tax,period').in('property_id', ids).eq('period', period),
  ]);

  return properties.map((property) => {
    const us = (units || []).filter((u) => u.property_id === property.id);
    const ls = (leases || []).filter((l) => l.property_id === property.id && l.status === 'active');
    const ps = (payments || []).filter((p) => p.property_id === property.id);
    const ts = (taxes || []).filter((t) => t.property_id === property.id);
    const unitTypes: Record<string, number> = {};
    const floors: DashboardPropertyPerformance['floors'] = {};
    us.forEach((u) => {
      const type = String(u.house_type || (Number(u.bedrooms || 0) === 0 ? 'Bedsitter / Studio' : `${Number(u.bedrooms)} Bedroom`));
      unitTypes[type] = (unitTypes[type] || 0) + 1;
      const floor = u.floor == null ? 'Ground / Unspecified' : `Floor ${u.floor}`;
      floors[floor] ||= { total: 0, available: 0, occupied: 0, reserved: 0 };
      floors[floor].total += 1;
      if (u.status === 'available') floors[floor].available += 1;
      if (u.status === 'occupied') floors[floor].occupied += 1;
      if (u.status === 'reserved') floors[floor].reserved += 1;
    });
    return {
      id: property.id,
      name: property.name,
      propertyType: property.property_type,
      units: us.length,
      available: us.filter((u) => u.status === 'available').length,
      reserved: us.filter((u) => u.status === 'reserved').length,
      occupied: us.filter((u) => u.status === 'occupied').length,
      tenants: ls.length,
      expectedRent: us.filter((u) => u.status === 'occupied').reduce((sum, u) => sum + number(u.monthly_rent), 0),
      collectedRent: ps.reduce((sum, p) => sum + number(p.amount), 0),
      tax: ts.reduce((sum, t) => sum + number(t.estimated_tax), 0),
      floors,
      unitTypes,
    };
  });
}

export async function loadManagedExpenses(userId: string, role: string): Promise<{ data: ManagedExpenseRow[]; error: unknown }> {
  const rpc = await supabase.rpc('get_managed_expenses');
  if (!rpc.error && Array.isArray(rpc.data)) {
    const data = (rpc.data as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      properties: row.property_name ? { name: String(row.property_name) } : null,
    })) as unknown as ManagedExpenseRow[];
    // A stale RPC can legitimately return an empty array while the live table
    // already contains records. Only trust the helper when it actually has
    // data; otherwise use the table fallback below.
    if (data.length > 0) return { data, error: null };
  }

  if (role === 'admin') {
    const { data, error } = await supabase.from('expenses').select('*, properties(name)').order('expense_date', { ascending: false });
    return { data: (data || []) as ManagedExpenseRow[], error };
  }
  const { data: properties, error: propertyError } = await supabase.from('properties').select('id').eq('owner_id', userId);
  if (propertyError || !properties?.length) return { data: [], error: propertyError };
  const ids = properties.map((p) => p.id);
  const { data, error } = await supabase.from('expenses').select('*, properties(name)').in('property_id', ids).order('expense_date', { ascending: false });
  return { data: (data || []) as ManagedExpenseRow[], error };
}

export async function loadManagedMaintenance(userId: string, role: string): Promise<{ data: ManagedMaintenanceRow[]; error: unknown }> {
  const rpc = await supabase.rpc('get_managed_maintenance_requests');
  if (!rpc.error && Array.isArray(rpc.data)) {
    const data = (rpc.data as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      properties: row.property_name ? { name: String(row.property_name) } : null,
      property_units: row.unit_number ? { unit_number: String(row.unit_number) } : null,
      profiles: { full_name: row.tenant_name == null ? null : String(row.tenant_name), phone: row.tenant_phone == null ? null : String(row.tenant_phone) },
    })) as unknown as ManagedMaintenanceRow[];
    return { data, error: null };
  }

  if (role === 'admin') {
    const { data, error } = await supabase.from('maintenance_requests').select('*, property_units(unit_number), properties(name), profiles:tenant_id(full_name,phone)').order('created_at', { ascending: false });
    return { data: (data || []) as ManagedMaintenanceRow[], error };
  }
  const { data: properties, error: propertyError } = await supabase.from('properties').select('id').eq('owner_id', userId);
  if (propertyError || !properties?.length) return { data: [], error: propertyError };
  const ids = properties.map((p) => p.id);
  const { data, error } = await supabase.from('maintenance_requests').select('*, property_units(unit_number), properties(name), profiles:tenant_id(full_name,phone)').in('property_id', ids).order('created_at', { ascending: false });
  return { data: (data || []) as ManagedMaintenanceRow[], error };
}
