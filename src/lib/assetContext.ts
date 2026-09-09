export type AssetClass = 'built_property' | 'land' | 'mixed_use' | 'development_project' | 'other' | string;
export type OperationModel = 'long_term_rental' | 'short_stay' | 'sale' | 'lease' | 'land_sale' | 'mixed' | string;

export type AssetContext = {
  assetClass: AssetClass;
  operationModel: OperationModel;
  label: string;
  relationshipLabel: string;
  primarySubject: string;
  dashboardTitle: string;
  financeLabel: string;
  stayOrLeaseLabel: string;
  serviceLabel: string;
  icon: 'home' | 'building' | 'land' | 'hotel';
};

export function getAssetContext(assetClass?: string | null, operationModel?: string | null): AssetContext {
  const asset = assetClass || 'built_property';
  const model = operationModel || 'long_term_rental';
  if (model === 'short_stay') return { assetClass: asset, operationModel: model, label: 'Short-stay asset', relationshipLabel: 'Guest', primarySubject: 'Stay', dashboardTitle: 'Your stay workspace', financeLabel: 'Stay charges', stayOrLeaseLabel: 'Booking', serviceLabel: 'Stay services', icon: 'hotel' };
  if (asset === 'land' || model === 'land_sale') return { assetClass: asset, operationModel: model, label: 'Land parcel', relationshipLabel: 'Buyer / leaseholder', primarySubject: 'Parcel', dashboardTitle: 'Your land workspace', financeLabel: 'Purchase & payments', stayOrLeaseLabel: 'Purchase / lease', serviceLabel: 'Documents & due diligence', icon: 'land' };
  if (model === 'sale') return { assetClass: asset, operationModel: model, label: 'Property for sale', relationshipLabel: 'Buyer', primarySubject: 'Property', dashboardTitle: 'Your acquisition workspace', financeLabel: 'Purchase payments', stayOrLeaseLabel: 'Purchase', serviceLabel: 'Documents', icon: 'building' };
  if (asset === 'mixed_use') return { assetClass: asset, operationModel: model, label: 'Mixed-use asset', relationshipLabel: 'Occupant / client', primarySubject: 'Premises', dashboardTitle: 'Your premises workspace', financeLabel: 'Rent & charges', stayOrLeaseLabel: 'Lease', serviceLabel: 'Property services', icon: 'building' };
  if (model === 'lease') return { assetClass: asset, operationModel: model, label: 'Leased asset', relationshipLabel: 'Leaseholder', primarySubject: 'Premises', dashboardTitle: 'Your lease workspace', financeLabel: 'Lease payments', stayOrLeaseLabel: 'Lease', serviceLabel: 'Property services', icon: 'building' };
  return { assetClass: asset, operationModel: model, label: 'Managed property', relationshipLabel: 'Tenant', primarySubject: 'Home', dashboardTitle: 'Your home workspace', financeLabel: 'Rent & payments', stayOrLeaseLabel: 'Lease', serviceLabel: 'Maintenance', icon: 'home' };
}

export function assetClassLabel(value?: string | null) { return getAssetContext(value, undefined).label; }
