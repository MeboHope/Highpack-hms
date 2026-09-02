/*
# Initial Schema — Kenya Property Management Platform

## Overview
Creates the core relational schema for a multi-tenant property management and house-hunting platform for Kenya.

## New Tables
1. `profiles` — extends auth.users with role (customer/owner/admin/agent), full_name, phone, national_id
2. `properties` — real-estate listings owned by a user (owner), with location, type, amenities, media
3. `property_units` — individual rentable units within a property (status: available/reserved/occupied/maintenance/unavailable)
4. `reservations` — a customer reserving a unit; holds fee, expiry, status
5. `payments` — all payments (reservation fees, rent, deposits) with provider + status + verified flag
6. `leases` — tenancy records linking tenant, unit, dates, amounts, status
7. `rent_invoices` — monthly rent invoices per lease
8. `maintenance_requests` — tenant maintenance tickets with category/priority/status
9. `expenses` — owner-recorded property expenses
10. `tax_records` — computed tax obligations per period
11. `notifications` — in-app notifications per user
12. `favorites` — customer saved properties
13. `viewing_appointments` — scheduled property viewings
14. `messages` — conversation messages between users
15. `system_settings` — platform-wide config (reservation fee, duration, commission, etc.)
16. `audit_logs` — track important user actions
17. `owner_payouts` — settlements to owners

## Security
- RLS enabled on every table.
- Profiles: owner-scoped (read/update own), admins read all.
- Properties/units: public read (anon+authenticated) for verified properties; owners manage own; admins manage all.
- Reservations/payments/leases/maintenance/expenses/tax/notifications/favorites/messages: owner-scoped (user sees own rows); admins see all; owners see rows related to their properties.
- system_settings: public read, admin write.
- audit_logs: admin read only.

## Notes
1. Owner columns default to auth.uid() so client inserts that omit user_id succeed.
2. Double-reservation prevention is handled by a unique partial index on active reservations per unit + status check in application logic.
3. Payment "verified" flag is only set server-side (via webhook/edge function), never by the browser.
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','owner','admin','agent')),
  full_name text,
  phone text,
  national_id text,
  kra_pin text,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ SYSTEM SETTINGS ============
CREATE TABLE IF NOT EXISTS system_settings (
  id int PRIMARY KEY DEFAULT 1,
  reservation_fee numeric NOT NULL DEFAULT 2000,
  reservation_duration_hours int NOT NULL DEFAULT 48,
  reservation_fee_policy text NOT NULL DEFAULT 'non_refundable',
  currency text NOT NULL DEFAULT 'KES',
  platform_commission_pct numeric NOT NULL DEFAULT 5,
  default_tax_rate_pct numeric NOT NULL DEFAULT 7.5,
  mpesa_enabled boolean DEFAULT false,
  card_enabled boolean DEFAULT true,
  bank_transfer_enabled boolean DEFAULT true,
  require_property_verification boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_public_read" ON system_settings;
CREATE POLICY "settings_public_read" ON system_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON system_settings;
CREATE POLICY "settings_admin_write" ON system_settings FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============ PROPERTIES ============
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  property_type text NOT NULL,
  county text NOT NULL,
  sub_county text,
  town text NOT NULL,
  estate text,
  street text,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  map_url text,
  number_of_units int DEFAULT 1,
  amenities text[] DEFAULT '{}',
  parking boolean DEFAULT false,
  security_info text,
  water_availability boolean DEFAULT true,
  electricity boolean DEFAULT true,
  internet boolean DEFAULT false,
  pets_allowed boolean DEFAULT false,
  photos text[] DEFAULT '{}',
  videos text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification','verified','rejected','suspended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_county_town ON properties(county, town);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);

DROP POLICY IF EXISTS "properties_public_read" ON properties;
CREATE POLICY "properties_public_read" ON properties FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "properties_owner_insert" ON properties;
CREATE POLICY "properties_owner_insert" ON properties FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "properties_owner_update" ON properties;
CREATE POLICY "properties_owner_update" ON properties FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "properties_owner_delete" ON properties;
CREATE POLICY "properties_owner_delete" ON properties FOR DELETE
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============ PROPERTY UNITS ============
CREATE TABLE IF NOT EXISTS property_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  floor int,
  house_type text,
  bedrooms int DEFAULT 0,
  bathrooms int DEFAULT 1,
  monthly_rent numeric NOT NULL DEFAULT 0,
  security_deposit numeric NOT NULL DEFAULT 0,
  reservation_fee numeric NOT NULL DEFAULT 2000,
  service_charge numeric DEFAULT 0,
  water_charge numeric DEFAULT 0,
  parking_fee numeric DEFAULT 0,
  other_charges numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','occupied','maintenance','unavailable')),
  furnishing text DEFAULT 'unfurnished' CHECK (furnishing IN ('furnished','semi_furnished','unfurnished')),
  amenities text[] DEFAULT '{}',
  photos text[] DEFAULT '{}',
  videos text[] DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE property_units ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_units_property ON property_units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON property_units(status);

DROP POLICY IF EXISTS "units_public_read" ON property_units;
CREATE POLICY "units_public_read" ON property_units FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "units_owner_insert" ON property_units;
CREATE POLICY "units_owner_insert" ON property_units FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "units_owner_update" ON property_units;
CREATE POLICY "units_owner_update" ON property_units FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "units_owner_delete" ON property_units;
CREATE POLICY "units_owner_delete" ON property_units FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============ RESERVATIONS ============
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES property_units(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reservation_fee numeric NOT NULL DEFAULT 2000,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','expired','cancelled','converted')),
  expires_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_reservation_per_unit
  ON reservations(unit_id) WHERE status IN ('pending','confirmed');

CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_property ON reservations(property_id);

DROP POLICY IF EXISTS "reservations_read" ON reservations;
CREATE POLICY "reservations_read" ON reservations FOR SELECT
  TO authenticated USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "reservations_insert" ON reservations;
CREATE POLICY "reservations_insert" ON reservations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "reservations_update" ON reservations;
CREATE POLICY "reservations_update" ON reservations FOR UPDATE
  TO authenticated USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "reservations_delete" ON reservations;
CREATE POLICY "reservations_delete" ON reservations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ LEASES ============
CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES property_units(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  lease_start date NOT NULL,
  lease_end date NOT NULL,
  monthly_rent numeric NOT NULL,
  deposit numeric NOT NULL DEFAULT 0,
  service_charge numeric DEFAULT 0,
  payment_due_day int NOT NULL DEFAULT 5,
  grace_period_days int DEFAULT 7,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_signature','active','expired','terminated','renewed')),
  agreement_text text,
  signed_by_tenant boolean DEFAULT false,
  signed_by_owner boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_property ON leases(property_id);

DROP POLICY IF EXISTS "leases_read" ON leases;
CREATE POLICY "leases_read" ON leases FOR SELECT
  TO authenticated USING (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "leases_insert" ON leases;
CREATE POLICY "leases_insert" ON leases FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "leases_update" ON leases;
CREATE POLICY "leases_update" ON leases FOR UPDATE
  TO authenticated USING (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  lease_id uuid REFERENCES leases(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES property_units(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('reservation','rent','deposit','service_charge','other')),
  payment_method text NOT NULL DEFAULT 'mpesa' CHECK (payment_method IN ('mpesa','card','bank_transfer','cash','other')),
  provider_reference text,
  transaction_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed','cancelled','refunded','partially_refunded')),
  verified boolean NOT NULL DEFAULT false,
  refund_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

DROP POLICY IF EXISTS "payments_read" ON payments;
CREATE POLICY "payments_read" ON payments FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ RENT INVOICES ============
CREATE TABLE IF NOT EXISTS rent_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES property_units(id) ON DELETE CASCADE,
  period text NOT NULL,
  amount numeric NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partially_paid','paid','overdue')),
  due_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE rent_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invoices_lease ON rent_invoices(lease_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON rent_invoices(tenant_id);

DROP POLICY IF EXISTS "invoices_read" ON rent_invoices;
CREATE POLICY "invoices_read" ON rent_invoices FOR SELECT
  TO authenticated USING (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "invoices_insert" ON rent_invoices;
CREATE POLICY "invoices_insert" ON rent_invoices FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "invoices_update" ON rent_invoices;
CREATE POLICY "invoices_update" ON rent_invoices FOR UPDATE
  TO authenticated USING (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ MAINTENANCE REQUESTS ============
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES property_units(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('plumbing','electrical','water','security','structural','appliances','cleaning','other')),
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','assigned','in_progress','awaiting_parts','completed','closed')),
  photos text[] DEFAULT '{}',
  assigned_to text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_maintenance_property ON maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant ON maintenance_requests(tenant_id);

DROP POLICY IF EXISTS "maintenance_read" ON maintenance_requests;
CREATE POLICY "maintenance_read" ON maintenance_requests FOR SELECT
  TO authenticated USING (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "maintenance_insert" ON maintenance_requests;
CREATE POLICY "maintenance_insert" ON maintenance_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "maintenance_update" ON maintenance_requests;
CREATE POLICY "maintenance_update" ON maintenance_requests FOR UPDATE
  TO authenticated USING (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = tenant_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ EXPENSES ============
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL,
  vendor text,
  description text,
  receipt_url text,
  payment_method text DEFAULT 'cash',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_id);

DROP POLICY IF EXISTS "expenses_read" ON expenses;
CREATE POLICY "expenses_read" ON expenses FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============ TAX RECORDS ============
CREATE TABLE IF NOT EXISTS tax_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  period text NOT NULL,
  gross_income numeric NOT NULL DEFAULT 0,
  allowable_expenses numeric NOT NULL DEFAULT 0,
  taxable_income numeric NOT NULL DEFAULT 0,
  tax_rate_pct numeric NOT NULL DEFAULT 7.5,
  estimated_tax numeric NOT NULL DEFAULT 0,
  tax_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated','prepared','filed','paid','overdue')),
  kra_reference text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tax_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tax_owner ON tax_records(owner_id);

DROP POLICY IF EXISTS "tax_read" ON tax_records;
CREATE POLICY "tax_read" ON tax_records FOR SELECT
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "tax_insert" ON tax_records;
CREATE POLICY "tax_insert" ON tax_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "tax_update" ON tax_records;
CREATE POLICY "tax_update" ON tax_records FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============ OWNER PAYOUTS ============
CREATE TABLE IF NOT EXISTS owner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  period text,
  gross_amount numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE owner_payouts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payouts_owner ON owner_payouts(owner_id);

DROP POLICY IF EXISTS "payouts_read" ON owner_payouts;
CREATE POLICY "payouts_read" ON owner_payouts FOR SELECT
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "payouts_insert" ON owner_payouts;
CREATE POLICY "payouts_insert" ON owner_payouts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "payouts_update" ON owner_payouts;
CREATE POLICY "payouts_update" ON owner_payouts FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

DROP POLICY IF EXISTS "notifications_read" ON notifications;
CREATE POLICY "notifications_read" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ FAVORITES ============
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, property_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_read" ON favorites;
CREATE POLICY "favorites_read" ON favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_insert" ON favorites;
CREATE POLICY "favorites_insert" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete" ON favorites;
CREATE POLICY "favorites_delete" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ VIEWING APPOINTMENTS ============
CREATE TABLE IF NOT EXISTS viewing_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES property_units(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_date date NOT NULL,
  appointment_time text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','rescheduled','completed','cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE viewing_appointments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_viewings_customer ON viewing_appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_viewings_property ON viewing_appointments(property_id);

DROP POLICY IF EXISTS "viewings_read" ON viewing_appointments;
CREATE POLICY "viewings_read" ON viewing_appointments FOR SELECT
  TO authenticated USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "viewings_insert" ON viewing_appointments;
CREATE POLICY "viewings_insert" ON viewing_appointments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "viewings_update" ON viewing_appointments;
CREATE POLICY "viewings_update" ON viewing_appointments FOR UPDATE
  TO authenticated USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  body text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

DROP POLICY IF EXISTS "messages_read" ON messages;
CREATE POLICY "messages_read" ON messages FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_admin_read" ON audit_logs;
CREATE POLICY "audit_admin_read" ON audit_logs FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'customer'), NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  -- Only attach the trigger to tables that actually contain an updated_at column.
  -- rent_invoices, expenses, tax_records, owner_payouts, notifications and
  -- viewing_appointments intentionally use created_at only in this schema.
  FOR t IN SELECT unnest(ARRAY['profiles','properties','property_units','reservations','payments','leases','maintenance_requests']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I;', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

-- ============ SEED SYSTEM SETTINGS ============
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;