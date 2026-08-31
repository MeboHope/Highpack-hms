import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = 'customer' | 'owner' | 'admin' | 'agent';

export type PropertyStatus = 'pending_verification' | 'verified' | 'rejected' | 'suspended';
export type UnitStatus = 'available' | 'reserved' | 'occupied' | 'maintenance' | 'unavailable';
export type ReservationStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'converted';
export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
export type PaymentMethod = 'mpesa' | 'card' | 'bank_transfer' | 'cash' | 'other';
export type PaymentType = 'reservation' | 'rent' | 'deposit' | 'service_charge' | 'other';
export type LeaseStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'terminated' | 'renewed';
export type MaintenanceStatus = 'submitted' | 'assigned' | 'in_progress' | 'awaiting_parts' | 'completed' | 'closed';
export type TaxStatus = 'calculated' | 'prepared' | 'filed' | 'paid' | 'overdue';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type ViewingStatus = 'requested' | 'confirmed' | 'rescheduled' | 'completed' | 'cancelled';
export type Furnishing = 'furnished' | 'semi_furnished' | 'unfurnished';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  national_id: string | null;
  kra_pin: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  property_type: string;
  county: string;
  sub_county: string | null;
  town: string;
  estate: string | null;
  street: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  map_url: string | null;
  number_of_units: number;
  amenities: string[];
  parking: boolean;
  security_info: string | null;
  water_availability: boolean;
  electricity: boolean;
  internet: boolean;
  pets_allowed: boolean;
  photos: string[];
  videos: string[];
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
}

export interface PropertyUnit {
  id: string;
  property_id: string;
  unit_number: string;
  floor: number | null;
  house_type: string | null;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  security_deposit: number;
  reservation_fee: number;
  service_charge: number;
  water_charge: number;
  parking_fee: number;
  other_charges: number;
  status: UnitStatus;
  furnishing: Furnishing;
  amenities: string[];
  photos: string[];
  videos: string[];
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  unit_id: string;
  property_id: string;
  customer_id: string;
  reservation_fee: number;
  status: ReservationStatus;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  reservation_id: string | null;
  lease_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  amount: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  provider_reference: string | null;
  transaction_ref: string | null;
  status: PaymentStatus;
  verified: boolean;
  refund_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: string;
  tenant_id: string;
  unit_id: string;
  property_id: string;
  reservation_id: string | null;
  lease_start: string;
  lease_end: string;
  monthly_rent: number;
  deposit: number;
  service_charge: number;
  payment_due_day: number;
  grace_period_days: number;
  status: LeaseStatus;
  agreement_text: string | null;
  signed_by_tenant: boolean;
  signed_by_owner: boolean;
  created_at: string;
  updated_at: string;
}

export interface RentInvoice {
  id: string;
  lease_id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  period: string;
  amount: number;
  balance: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
  due_date: string;
  created_at: string;
}

export interface MaintenanceRequest {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  category: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: MaintenanceStatus;
  photos: string[];
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  property_id: string;
  owner_id: string;
  category: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  receipt_url: string | null;
  payment_method: string;
  created_at: string;
}

export interface TaxRecord {
  id: string;
  owner_id: string;
  property_id: string | null;
  period: string;
  gross_income: number;
  allowable_expenses: number;
  taxable_income: number;
  tax_rate_pct: number;
  estimated_tax: number;
  tax_paid: number;
  status: TaxStatus;
  kra_reference: string | null;
  created_at: string;
}

export interface OwnerPayout {
  id: string;
  owner_id: string;
  property_id: string | null;
  period: string | null;
  gross_amount: number;
  platform_fee: number;
  deductions: number;
  net_amount: number;
  status: PayoutStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
}

export interface ViewingAppointment {
  id: string;
  property_id: string;
  unit_id: string | null;
  customer_id: string;
  appointment_date: string;
  appointment_time: string;
  status: ViewingStatus;
  notes: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  property_id: string | null;
  body: string;
  read: boolean;
  created_at: string;
}

export interface SystemSettings {
  id: number;
  reservation_fee: number;
  reservation_duration_hours: number;
  reservation_fee_policy: string;
  currency: string;
  platform_commission_pct: number;
  default_tax_rate_pct: number;
  mpesa_enabled: boolean;
  card_enabled: boolean;
  bank_transfer_enabled: boolean;
  require_property_verification: boolean;
  updated_at: string;
}


