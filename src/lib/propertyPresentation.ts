export type PropertyDisplayKind =
  | 'residential_rental'
  | 'commercial_rental'
  | 'mixed_use'
  | 'short_stay'
  | 'land'
  | 'development'
  | 'sale'
  | 'whole_asset';

export type PropertyPresentation = {
  kind: PropertyDisplayKind;
  label: string;
  inventoryLabel: string;
  availableLabel: string;
  occupiedLabel: string;
  reservedLabel: string;
  showOccupancy: boolean;
  showRentMetrics: boolean;
  showTenantMetrics: boolean;
  showUnitInventory: boolean;
  showFloorAvailability: boolean;
  primaryFacts: string[];
};

const LAND_PATTERN = /land|plot|acre|ranch|farm|parcel|acreage/i;
const COMMERCIAL_PATTERN = /commercial|office|retail|shop|warehouse|industrial|institutional/i;
const RESIDENTIAL_PATTERN = /apartment|flat|house|townhouse|villa|residential|student|bedsitter/i;

export function getPropertyDisplayKind(
  assetClass?: string | null,
  operationModel?: string | null,
  propertyType?: string | null,
): PropertyDisplayKind {
  const asset = String(assetClass || '').toLowerCase();
  const operation = String(operationModel || '').toLowerCase();
  const type = String(propertyType || '').toLowerCase();

  if (asset === 'land' || operation === 'land_sale' || LAND_PATTERN.test(type)) return 'land';
  if (asset === 'development_project') return 'development';
  if (asset === 'mixed_use') return 'mixed_use';
  if (operation === 'short_stay') return 'short_stay';
  if (operation === 'sale') return 'sale';
  if (COMMERCIAL_PATTERN.test(type)) return 'commercial_rental';
  if (RESIDENTIAL_PATTERN.test(type) || asset === 'built_property') return 'residential_rental';
  return 'whole_asset';
}

export function getPropertyPresentation(
  assetClass?: string | null,
  operationModel?: string | null,
  propertyType?: string | null,
): PropertyPresentation {
  const kind = getPropertyDisplayKind(assetClass, operationModel, propertyType);

  switch (kind) {
    case 'land':
      return {
        kind,
        label: 'Land / plot asset',
        inventoryLabel: 'Plots',
        availableLabel: 'Plots available',
        occupiedLabel: 'Plots sold / allocated',
        reservedLabel: 'Plots reserved',
        showOccupancy: false,
        showRentMetrics: false,
        showTenantMetrics: false,
        showUnitInventory: false,
        showFloorAvailability: false,
        primaryFacts: ['plot count', 'land area', 'dimensions', 'title / parcel', 'tenure', 'zoning'],
      };
    case 'short_stay':
      return {
        kind,
        label: 'Short-stay / hospitality asset',
        inventoryLabel: 'Listings',
        availableLabel: 'Available stays',
        occupiedLabel: 'Booked stays',
        reservedLabel: 'Pending bookings',
        showOccupancy: false,
        showRentMetrics: false,
        showTenantMetrics: false,
        showUnitInventory: false,
        showFloorAvailability: false,
        primaryFacts: ['listing count', 'nightly rate', 'booking status', 'guest capacity'],
      };
    case 'development':
      return {
        kind,
        label: 'Development project',
        inventoryLabel: 'Components',
        availableLabel: 'Development capacity',
        occupiedLabel: 'Completed / occupied',
        reservedLabel: 'Reserved / committed',
        showOccupancy: false,
        showRentMetrics: false,
        showTenantMetrics: false,
        showUnitInventory: false,
        showFloorAvailability: false,
        primaryFacts: ['development type', 'land area', 'zoning', 'project status', 'components'],
      };
    case 'sale':
      return {
        kind,
        label: 'Property for sale',
        inventoryLabel: 'Sale assets',
        availableLabel: 'For sale',
        occupiedLabel: 'Sold',
        reservedLabel: 'Under offer / reserved',
        showOccupancy: false,
        showRentMetrics: false,
        showTenantMetrics: false,
        showUnitInventory: false,
        showFloorAvailability: false,
        primaryFacts: ['asking price', 'sale status', 'title / ownership', 'property type'],
      };
    case 'mixed_use':
      return {
        kind,
        label: 'Mixed-use asset',
        inventoryLabel: 'Spaces',
        availableLabel: 'Available spaces',
        occupiedLabel: 'Occupied spaces',
        reservedLabel: 'Reserved spaces',
        showOccupancy: true,
        showRentMetrics: true,
        showTenantMetrics: true,
        showUnitInventory: true,
        showFloorAvailability: true,
        primaryFacts: ['residential / commercial mix', 'spaces', 'occupancy', 'income'],
      };
    case 'commercial_rental':
      return {
        kind,
        label: 'Commercial rental asset',
        inventoryLabel: 'Spaces',
        availableLabel: 'Available spaces',
        occupiedLabel: 'Occupied spaces',
        reservedLabel: 'Reserved spaces',
        showOccupancy: true,
        showRentMetrics: true,
        showTenantMetrics: true,
        showUnitInventory: true,
        showFloorAvailability: true,
        primaryFacts: ['space count', 'occupancy', 'rent', 'tenant status'],
      };
    case 'residential_rental':
      return {
        kind,
        label: 'Residential rental asset',
        inventoryLabel: 'Units',
        availableLabel: 'Vacant units',
        occupiedLabel: 'Occupied units',
        reservedLabel: 'Reserved units',
        showOccupancy: true,
        showRentMetrics: true,
        showTenantMetrics: true,
        showUnitInventory: true,
        showFloorAvailability: true,
        primaryFacts: ['unit count', 'bedrooms', 'occupancy', 'rent', 'tenants'],
      };
    default:
      return {
        kind,
        label: 'Real-estate asset',
        inventoryLabel: 'Components',
        availableLabel: 'Available',
        occupiedLabel: 'In use',
        reservedLabel: 'Reserved',
        showOccupancy: false,
        showRentMetrics: false,
        showTenantMetrics: false,
        showUnitInventory: false,
        showFloorAvailability: false,
        primaryFacts: ['asset type', 'location', 'ownership', 'status'],
      };
  }
}
