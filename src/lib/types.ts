export type {
  UserRole,
  PropertyStatus,
  UnitStatus,
  ReservationStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentType,
  LeaseStatus,
  MaintenanceStatus,
  TaxStatus,
  PayoutStatus,
  ViewingStatus,
  Furnishing,
  Profile,
  Property,
  PropertyUnit,
  Reservation,
  Payment,
  Lease,
  RentInvoice,
  MaintenanceRequest,
  Expense,
  TaxRecord,
  OwnerPayout,
  Notification,
  Favorite,
  ViewingAppointment,
  Message,
  SystemSettings,
} from '@/lib/supabase';

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  caption: string | null;
  category: string | null;
  sort_order: number;
  created_at?: string;
}

export interface Viewing {
  id: string;
  property_id: string;
  unit_id: string | null;
  customer_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface TaxTransaction {
  id: string;
  owner_id: string;
  property_id: string | null;
  period: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}
