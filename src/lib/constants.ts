export const PROPERTY_TYPES = [
  'Bedsitter',
  'Studio',
  '1 Bedroom',
  '2 Bedroom',
  '3 Bedroom',
  '4 Bedroom',
  '5+ Bedroom',
  'Maisonette',
  'Apartment',
  'Townhouse',
  'Villa',
  'Single-family house',
  'Commercial property',
  'Office',
  'Shop',
  'Other',
] as const;

export const KENYAN_COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Kilifi', 'Machakos',
  'Kakamega', 'Nyeri', 'Meru', 'Eldoret (Uasin Gishu)', 'Kisii', 'Malindi',
  'Thika', 'Naivasha', 'Kitale', 'Garissa', 'Nanyuki', 'Lamu', 'Voi',
] as const;

export const PROPERTY_AMENITIES = [
  'Swimming Pool', 'Gym', 'Borehole Water', 'Backup Generator', 'CCTV Security',
  'Elevator', 'Balcony', 'Garden', 'Fibre Internet', 'DSTV Ready',
  'Servant Quarter (SQ)', 'Borehole', 'Solar Water Heating', 'Gated Community',
  'Tarmac Road Access', 'Near Shopping Mall', 'Near School', 'Near Hospital',
  'Near Matatu Stage', 'Near Bus Stop', 'Playground', 'Ample Parking',
] as const;

export const EXPENSE_CATEGORIES = [
  'Repairs', 'Maintenance', 'Security', 'Utilities', 'Property Management Fees',
  'Insurance', 'Cleaning', 'Service Charges', 'Legal Expenses', 'Advertising',
  'Garbage Collection', 'Pest Control', 'Other',
] as const;

export const MAINTENANCE_CATEGORIES = [
  'Plumbing', 'Electrical', 'Water', 'Security', 'Structural',
  'Appliances', 'Cleaning', 'Other',
] as const;

export const FURNISHING_OPTIONS = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'semi_furnished', label: 'Semi-Furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
] as const;



export function normalizeUnitType(houseType: string | null | undefined, bedrooms: number | null | undefined): string {
  if (houseType?.trim()) return titleCase(houseType.trim());
  const count = Number(bedrooms || 0);
  if (count <= 0) return 'Bedsitter / Studio';
  if (count === 1) return '1 Bedroom';
  if (count === 2) return '2 Bedroom';
  if (count === 3) return '3 Bedroom';
  if (count === 4) return '4 Bedroom';
  return '5+ Bedroom';
}

export function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    available: 'bg-brand-100 text-brand-700',
    verified: 'bg-brand-100 text-brand-700',
    active: 'bg-brand-100 text-brand-700',
    confirmed: 'bg-brand-100 text-brand-700',
    successful: 'bg-brand-100 text-brand-700',
    paid: 'bg-brand-100 text-brand-700',
    completed: 'bg-brand-100 text-brand-700',
    occupied: 'bg-accent-100 text-accent-700',
    reserved: 'bg-accent-100 text-accent-700',
    pending: 'bg-yellow-100 text-yellow-700',
    pending_verification: 'bg-yellow-100 text-yellow-700',
    pending_signature: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-yellow-100 text-yellow-700',
    requested: 'bg-yellow-100 text-yellow-700',
    calculated: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    assigned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-blue-100 text-blue-700',
    prepared: 'bg-blue-100 text-blue-700',
    filed: 'bg-blue-100 text-blue-700',
    maintenance: 'bg-orange-100 text-orange-700',
    awaiting_parts: 'bg-orange-100 text-orange-700',
    overdue: 'bg-red-100 text-red-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
    suspended: 'bg-red-100 text-red-700',
    expired: 'bg-red-100 text-red-700',
    terminated: 'bg-red-100 text-red-700',
    unavailable: 'bg-ink-200 text-ink-600',
    closed: 'bg-ink-200 text-ink-600',
    draft: 'bg-ink-200 text-ink-600',
    renewed: 'bg-brand-100 text-brand-700',
    partially_paid: 'bg-accent-100 text-accent-700',
    partially_refunded: 'bg-accent-100 text-accent-700',
    refunded: 'bg-ink-200 text-ink-600',
    converted: 'bg-brand-100 text-brand-700',
    rescheduled: 'bg-yellow-100 text-yellow-700',
  };
  return colors[status] || 'bg-ink-200 text-ink-600';
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
