/*
  # Calendly Parity Features

  1. Services enhancements
    - `buffer_before_minutes` – dead time blocked before appointment
    - `buffer_after_minutes` – dead time blocked after appointment
    - `min_notice_hours` – minimum advance notice required (default 1h)
    - `max_bookings_per_day` – daily cap (null = unlimited)
    - `booking_window_days` – how far in advance guests can book (default 60)
    - `slot_increment_minutes` – granularity of offered slots (15/30/60)
    - `allow_cancellation` – whether guest can cancel
    - `allow_reschedule` – whether guest can reschedule
    - `cancellation_policy` – freetext shown to guest
    - `confirmation_redirect_url` – redirect after booking (like Calendly)
    - `location` – where meeting happens (Zoom link, address, phone, etc.)
    - `location_type` – video/in_person/phone/custom

  2. Booking questions (custom intake forms)
    - New table `booking_questions` with field type, label, required flag, order
    - New table `booking_answers` linked to bookings

  3. Date overrides (block days or set custom hours on specific dates)
    - New table `date_overrides` – specific date with available ranges or blocked flag

  4. Booking page branding
    - `avatar_url` on profiles already exists
    - Add `brand_color` and `booking_page_header` to profiles

  5. Guest timezone field on bookings already exists (guest_timezone)
*/

-- ============================================================
-- Services: scheduling control columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='buffer_before_minutes') THEN
    ALTER TABLE services ADD COLUMN buffer_before_minutes int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='buffer_after_minutes') THEN
    ALTER TABLE services ADD COLUMN buffer_after_minutes int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='min_notice_hours') THEN
    ALTER TABLE services ADD COLUMN min_notice_hours int NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='max_bookings_per_day') THEN
    ALTER TABLE services ADD COLUMN max_bookings_per_day int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='booking_window_days') THEN
    ALTER TABLE services ADD COLUMN booking_window_days int NOT NULL DEFAULT 60;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='slot_increment_minutes') THEN
    ALTER TABLE services ADD COLUMN slot_increment_minutes int NOT NULL DEFAULT 30;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='allow_cancellation') THEN
    ALTER TABLE services ADD COLUMN allow_cancellation boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='allow_reschedule') THEN
    ALTER TABLE services ADD COLUMN allow_reschedule boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='cancellation_policy') THEN
    ALTER TABLE services ADD COLUMN cancellation_policy text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='confirmation_redirect_url') THEN
    ALTER TABLE services ADD COLUMN confirmation_redirect_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='location') THEN
    ALTER TABLE services ADD COLUMN location text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='location_type') THEN
    ALTER TABLE services ADD COLUMN location_type text NOT NULL DEFAULT 'video' CHECK (location_type IN ('video','in_person','phone','custom'));
  END IF;
END $$;

-- ============================================================
-- Profiles: branding fields
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='brand_color') THEN
    ALTER TABLE profiles ADD COLUMN brand_color text NOT NULL DEFAULT '#10b981';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='booking_page_header') THEN
    ALTER TABLE profiles ADD COLUMN booking_page_header text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- ============================================================
-- Booking questions (custom intake form per service)
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','textarea','select','checkbox','phone','url')),
  options jsonb,           -- for 'select' type: ["Option A","Option B"]
  required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE booking_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage own booking questions"
  ON booking_questions FOR ALL TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Public can read booking questions"
  ON booking_questions FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- Booking answers (guest responses to intake questions)
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES booking_questions(id) ON DELETE CASCADE,
  answer text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE booking_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts read own booking answers"
  ON booking_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.host_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert booking answers"
  ON booking_answers FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role manages booking answers"
  ON booking_answers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- Date overrides (block a specific day or set custom hours)
-- ============================================================
CREATE TABLE IF NOT EXISTS date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  is_blocked boolean NOT NULL DEFAULT false,   -- true = entire day blocked
  start_time time,                              -- null if blocked
  end_time time,                               -- null if blocked
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, override_date)
);

ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage own date overrides"
  ON date_overrides FOR ALL TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Public can read date overrides"
  ON date_overrides FOR SELECT TO anon, authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_questions_service_id ON booking_questions(service_id);
CREATE INDEX IF NOT EXISTS idx_booking_questions_host_id ON booking_questions(host_id);
CREATE INDEX IF NOT EXISTS idx_booking_answers_booking_id ON booking_answers(booking_id);
CREATE INDEX IF NOT EXISTS idx_date_overrides_host_date ON date_overrides(host_id, override_date);
