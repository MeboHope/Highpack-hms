import { PROPERTY_TYPES, KENYAN_COUNTIES, PROPERTY_AMENITIES, EXPENSE_CATEGORIES, MAINTENANCE_CATEGORIES, FURNISHING_OPTIONS, formatKES, formatDate, formatDateTime, timeAgo, statusColor, titleCase } from '@/lib/constants';

export { PROPERTY_TYPES, KENYAN_COUNTIES, PROPERTY_AMENITIES, EXPENSE_CATEGORIES, MAINTENANCE_CATEGORIES, FURNISHING_OPTIONS, formatKES, formatDate, formatDateTime, timeAgo, statusColor, titleCase };

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function propertyTypeLabel(value: string) {
  return value || 'Property';
}

export function availabilityColor(status: string) {
  return statusColor(status);
}

export function availabilityLabel(status: string) {
  return titleCase(status);
}

export function reservationStatusColor(status: string) {
  return statusColor(status);
}

export function reservationStatusLabel(status: string) {
  return titleCase(status);
}

export function paymentStatusColor(status: string) {
  return statusColor(status);
}

export function paymentStatusLabel(status: string) {
  return titleCase(status);
}

export function generateReference(prefix = 'HP') {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}
