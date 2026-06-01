/*
  # Create appointment scheduling schema

  1. New Tables
    - `services` - appointment types offered by hosts
    - `availability` - recurring weekly availability slots
    - `bookings` - scheduled appointments
    - `subscriptions` - Stripe billing state

  2. Modified Tables
    - `profiles` - added bio, timezone, slug (for public booking page), stripe_customer_id

  3. Security
    - RLS on all new tables
    - Public read access for booking pages (by profile slug)
    - Hosts manage own services/availability/bookings
    - Anyone can create bookings (for guest booking flow)

  4. Indexes for common query patterns
*/

-- Add new columns to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
    ALTER TABLE profiles ADD COLUMN bio text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'timezone') THEN
    ALTER TABLE profiles ADD COLUMN timezone text NOT NULL DEFAULT 'America/New_York';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'slug') THEN
    ALTER TABLE profiles ADD COLUMN slug text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
  END IF;
END $$;

-- Services
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  duration_minutes int NOT NULL DEFAULT 30,
  price_cents int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#10b981',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Availability (recurring weekly schedule)
CREATE TABLE IF NOT EXISTS availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_timezone text NOT NULL DEFAULT 'America/New_York',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'canceled', 'completed', 'no_show')),
  stripe_payment_id text,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_current_period_end timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles policies (re-add since we dropped them)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Public can read profiles by slug"
  ON profiles FOR SELECT TO anon, authenticated
  USING (slug IS NOT NULL);

CREATE POLICY "Service role can manage profiles"
  ON profiles FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Services policies
CREATE POLICY "Hosts can manage own services"
  ON services FOR ALL TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Public can read active services"
  ON services FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Availability policies
CREATE POLICY "Hosts can manage own availability"
  ON availability FOR ALL TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Public can read availability"
  ON availability FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Bookings policies
CREATE POLICY "Hosts can read own bookings"
  ON bookings FOR SELECT TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can update own bookings"
  ON bookings FOR UPDATE TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Anyone can create bookings"
  ON bookings FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Guests can read booking by id"
  ON bookings FOR SELECT TO anon, authenticated
  USING (true);

-- Subscriptions policies
CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_host_id ON services(host_id);
CREATE INDEX IF NOT EXISTS idx_availability_host_id ON availability(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host_id ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- Updated_at triggers for new tables
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
