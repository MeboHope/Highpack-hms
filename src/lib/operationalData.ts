import { supabase } from '@/lib/supabase';
import { getPropertyDisplayKind } from '@/lib/propertyPresentation';

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
  assetClass: string;
  operationModel: string;
  displayKind: ReturnType<typeof getPropertyDisplayKind>;
  inventoryLabel: string;
  units: number;
  available: number;
  reserved: number;
  occupied: number;
  tenants: number;
  expectedRent: number;
  collectedRent: number;
  tax: number;
  landArea: number | null;
  landAreaUnit: string | null;
  plotCount: number | null;
  plotDimensions: string | null;
  titleNumber: string | null;
  parcelNumber: string | null;
  zoning: string | null;
  saleListings: number;
  saleMinPrice: number | null;
  shortStayListings: number;
  shortStayMinRate: number | null;
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
  const assetClass = String(row.asset_class || 'built_property');
  const operationModel = String(row.operation_model || 'long_term_rental');
  const propertyType = String(row.property_type || 'Property');
  const displayKind = getPropertyDisplayKind(assetClass, operationModel, propertyType);
  return {
    id: String(row.id),
    name: String(row.name || 'Unnamed property'),
    propertyType,
    assetClass,
    operationModel,
    displayKind,
    inventoryLabel: displayKind === 'land' ? 'Plots' : displayKind === 'short_stay' ? 'Listings' : displayKind === 'commercial_rental' || displayKind === 'mixed_use' ? 'Spaces' : displayKind === 'development' ? 'Components' : 'Units',
    units: number(row.units),
    available: number(row.available),
    reserved: number(row.reserved),
    occupied: number(row.occupied),
    tenants: number(row.tenants),
    expectedRent: number(row.expected_rent),
    collectedRent: number(row.collected_rent),
    tax: number(row.tax),
    landArea: row.land_area == null ? null : number(row.land_area),
    landAreaUnit: row.land_area_unit == null ? null : String(row.land_area_unit),
    plotCount: row.plot_count == null ? null : number(row.plot_count),
    plotDimensions: row.plot_dimensions == null ? null : String(row.plot_dimensions),
    titleNumber: row.title_number == null ? null : String(row.title_number),
    parcelNumber: row.parcel_number == null ? null : String(row.parcel_number),
    zoning: row.zoning == null ? null : String(row.zoning),
    saleListings: number(row.sale_listings),
    saleMinPrice: row.sale_min_price == null ? null : number(row.sale_min_price),
    shortStayListings: number(row.short_stay_listings),
    shortStayMinRate: row.short_stay_min_rate == null ? null : number(row.short_stay_min_rate),
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
  let baseRows: DashboardPropertyPerformance[] = [];

  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
    baseRows = (rpc.data as RawRow[]).map(normalizeRow);
  }

  // The legacy dashboard RPC intentionally remains the source for financial and
  // unit rollups, but its return shape predates the universal asset model. Enrich
  // those rows from the live property registry so presentation is asset-aware.
  if (baseRows.length > 0) {
    const ids = baseRows.map((row) => row.id);
    const [{ data: properties }, { data: landParcels }, { data: sales }, { data: stays }] = await Promise.all([
      supabase.from('properties').select('id,asset_class,operation_model,property_type,total_land_area,land_area_unit,plot_count,plot_dimensions,title_number,parcel_number,zoning').in('id', ids),
      supabase.from('land_parcels').select('property_id,plot_count,plot_dimensions,acreage,area_unit,title_number,parcel_number,zoning,asking_price,sale_status').in('property_id', ids),
      supabase.from('sale_listings').select('property_id,asking_price,listing_status').in('property_id', ids).eq('listing_status', 'active'),
      supabase.from('short_stay_listings').select('property_id,nightly_rate,listing_status').in('property_id', ids).eq('listing_status', 'active'),
    ]);
    const propMap = new Map((properties || []).map((p) => [p.id, p]));
    const landMap = new Map<string, Record<string, unknown>>();
    (landParcels || []).forEach((p) => landMap.set(String(p.property_id), p as Record<string, unknown>));
    const saleMap = new Map<string, { count: number; min: number | null }>();
    (sales || []).forEach((s) => {
      const key = String(s.property_id); const current = saleMap.get(key) || { count: 0, min: null };
      const price = Number(s.asking_price || 0); current.count += 1; current.min = current.min == null ? price : Math.min(current.min, price); saleMap.set(key, current);
    });
    const stayMap = new Map<string, { count: number; min: number | null }>();
    (stays || []).forEach((s) => {
      const key = String(s.property_id); const current = stayMap.get(key) || { count: 0, min: null };
      const rate = Number(s.nightly_rate || 0); current.count += 1; current.min = current.min == null ? rate : Math.min(current.min, rate); stayMap.set(key, current);
    });
    return baseRows.map((row) => {
      const p = propMap.get(row.id) as Record<string, unknown> | undefined;
      const land = landMap.get(row.id);
      const assetClass = String(p?.asset_class || row.assetClass || 'built_property');
      const operationModel = String(p?.operation_model || row.operationModel || 'long_term_rental');
      const propertyType = String(p?.property_type || row.propertyType || 'Property');
      const displayKind = getPropertyDisplayKind(assetClass, operationModel, propertyType);
      const sale = saleMap.get(row.id);
      const stay = stayMap.get(row.id);
      const landArea = land?.acreage != null ? number(land.acreage) : p?.total_land_area == null ? null : number(p.total_land_area);
      const landAreaUnit = land?.area_unit ? String(land.area_unit) : p?.land_area_unit == null ? null : String(p.land_area_unit);
      const plotCount = land?.plot_count != null ? number(land.plot_count) : p?.plot_count == null ? row.plotCount : number(p.plot_count);
      const plotDimensions = land?.plot_dimensions ? String(land.plot_dimensions) : p?.plot_dimensions == null ? row.plotDimensions : String(p.plot_dimensions);
      return { ...row, assetClass, operationModel, propertyType, displayKind,
        inventoryLabel: displayKind === 'land' ? 'Plots' : displayKind === 'short_stay' ? 'Listings' : displayKind === 'commercial_rental' || displayKind === 'mixed_use' ? 'Spaces' : displayKind === 'development' ? 'Components' : 'Units',
        landArea, landAreaUnit,
        plotCount,
        plotDimensions,
        titleNumber: land?.title_number ? String(land.title_number) : p?.title_number == null ? row.titleNumber : String(p.title_number),
        parcelNumber: land?.parcel_number ? String(land.parcel_number) : p?.parcel_number == null ? row.parcelNumber : String(p.parcel_number),
        zoning: land?.zoning ? String(land.zoning) : p?.zoning == null ? row.zoning : String(p.zoning),
        saleListings: sale?.count || 0,
        saleMinPrice: sale?.min ?? null,
        shortStayListings: stay?.count || 0,
        shortStayMinRate: stay?.min ?? null,
      };
    });
  }

  const propertyQuery = role === 'admin'
    ? supabase.from('properties').select('id,name,property_type,asset_class,operation_model,total_land_area,land_area_unit,plot_count,plot_dimensions,title_number,parcel_number,zoning')
    : supabase.from('properties').select('id,name,property_type,asset_class,operation_model,total_land_area,land_area_unit,plot_count,plot_dimensions,title_number,parcel_number,zoning').eq('owner_id', userId);
  const { data: properties, error: propertyError } = await propertyQuery.order('name');
  if (propertyError || !properties?.length) return baseRows;

  const ids = properties.map((p) => p.id);
  const start = `${period}-01`;
  const endDate = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
  const [{ data: units }, { data: leases }, { data: payments }, { data: taxes }, { data: landParcels }, { data: sales }, { data: stays }] = await Promise.all([
    supabase.from('property_units').select('property_id,status,monthly_rent,house_type,bedrooms,floor').in('property_id', ids),
    supabase.from('leases').select('property_id,status,tenant_id').in('property_id', ids),
    supabase.from('payments').select('property_id,amount,status,verified,payment_type,created_at').in('property_id', ids).eq('payment_type', 'rent').eq('status', 'successful').eq('verified', true).gte('created_at', start).lt('created_at', end),
    supabase.from('tax_records').select('property_id,estimated_tax,period').in('property_id', ids).eq('period', period),
    supabase.from('land_parcels').select('property_id,plot_count,plot_dimensions,acreage,area_unit,title_number,parcel_number,zoning,asking_price,sale_status').in('property_id', ids),
    supabase.from('sale_listings').select('property_id,asking_price,listing_status').in('property_id', ids).eq('listing_status', 'active'),
    supabase.from('short_stay_listings').select('property_id,nightly_rate,listing_status').in('property_id', ids).eq('listing_status', 'active'),
  ]);
  const landMap = new Map<string, Record<string, unknown>>(); (landParcels || []).forEach((p) => landMap.set(String(p.property_id), p as Record<string, unknown>));
  const saleMap = new Map<string, { count: number; min: number | null }>(); (sales || []).forEach((s) => { const key=String(s.property_id); const c=saleMap.get(key)||{count:0,min:null}; const price=Number(s.asking_price||0); c.count+=1; c.min=c.min==null?price:Math.min(c.min,price); saleMap.set(key,c); });
  const stayMap = new Map<string, { count: number; min: number | null }>(); (stays || []).forEach((s) => { const key=String(s.property_id); const c=stayMap.get(key)||{count:0,min:null}; const rate=Number(s.nightly_rate||0); c.count+=1; c.min=c.min==null?rate:Math.min(c.min,rate); stayMap.set(key,c); });

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
    const assetClass = String(property.asset_class || 'built_property');
    const operationModel = String(property.operation_model || 'long_term_rental');
    const displayKind = getPropertyDisplayKind(assetClass, operationModel, property.property_type);
    const land = landMap.get(property.id);
    const sale = saleMap.get(property.id); const stay = stayMap.get(property.id);
    return {
      id: property.id, name: property.name, propertyType: property.property_type, assetClass, operationModel, displayKind,
      inventoryLabel: displayKind === 'land' ? 'Plots' : displayKind === 'short_stay' ? 'Listings' : displayKind === 'commercial_rental' || displayKind === 'mixed_use' ? 'Spaces' : displayKind === 'development' ? 'Components' : 'Units',
      units: us.length, available: us.filter((u) => u.status === 'available').length, reserved: us.filter((u) => u.status === 'reserved').length, occupied: us.filter((u) => u.status === 'occupied').length,
      tenants: ls.length, expectedRent: us.filter((u) => u.status === 'occupied').reduce((sum, u) => sum + number(u.monthly_rent), 0), collectedRent: ps.reduce((sum, p) => sum + number(p.amount), 0), tax: ts.reduce((sum, t) => sum + number(t.estimated_tax), 0),
      landArea: land?.acreage != null ? number(land.acreage) : property.total_land_area == null ? null : number(property.total_land_area),
      landAreaUnit: land?.area_unit ? String(land.area_unit) : property.land_area_unit == null ? null : String(property.land_area_unit),
      plotCount: land?.plot_count != null ? number(land.plot_count) : property.plot_count == null ? null : number(property.plot_count),
      plotDimensions: land?.plot_dimensions ? String(land.plot_dimensions) : property.plot_dimensions || null,
      titleNumber: land?.title_number ? String(land.title_number) : property.title_number || null,
      parcelNumber: land?.parcel_number ? String(land.parcel_number) : property.parcel_number || null,
      zoning: land?.zoning ? String(land.zoning) : property.zoning || null,
      saleListings: sale?.count || 0, saleMinPrice: sale?.min ?? null, shortStayListings: stay?.count || 0, shortStayMinRate: stay?.min ?? null,
      floors, unitTypes,
    };
  });
}

export async function loadManagedExpenses(userId: string, role: string): Promise<{ data: ManagedExpenseRow[]; error: unknown }> {
  const mapRows = (rows: Array<Record<string, unknown>>): ManagedExpenseRow[] => rows.map((row) => ({
    ...row,
    properties: row.property_name ? { name: String(row.property_name) } : null,
  })) as unknown as ManagedExpenseRow[];

  // One canonical RPC is used for both owner and admin screens. The previous
  // owner path called get_managed_expenses() as a composite-return function,
  // then fell back to a direct REST query. That combination was responsible
  // for the 400/403 loop visible after a page refresh. The definitive database
  // migration changes get_managed_expenses() to a simple JSONB response.
  const rpc = role === 'admin'
    ? await supabase.rpc('get_admin_expense_ledger_final')
    : await supabase.rpc('get_managed_expenses');

  if (!rpc.error) {
    let rows: unknown = rpc.data;
    if (typeof rows === 'string') {
      try { rows = JSON.parse(rows); } catch { rows = []; }
    }
    if (Array.isArray(rows)) {
      return { data: mapRows(rows as Array<Record<string, unknown>>), error: null };
    }
    return { data: [], error: new Error('The expense ledger returned an invalid response.') };
  }

  // For admin, retain the existing hardened compatibility paths. For owners,
  // deliberately do NOT call the old composite RPC again: that is the exact
  // request producing HTTP 400 in the affected database.
  if (role === 'admin') {
    const adminRpc = await supabase.rpc('get_admin_expense_ledger_v2');
    if (!adminRpc.error && Array.isArray(adminRpc.data)) {
      return { data: mapRows(adminRpc.data as Array<Record<string, unknown>>), error: null };
    }
    const legacyRpc = await supabase.rpc('get_admin_expense_ledger');
    if (!legacyRpc.error && Array.isArray(legacyRpc.data)) {
      return { data: mapRows(legacyRpc.data as Array<Record<string, unknown>>), error: null };
    }
  }

  return { data: [], error: rpc.error };
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
