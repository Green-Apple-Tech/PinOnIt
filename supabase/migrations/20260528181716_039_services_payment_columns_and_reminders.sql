/*
  # Services payment columns, service_reminders table, and default event types

  1. Modified Tables
    - `services`: adds payment_provider, paypal_client_id, paypal_currency columns

  2. New Tables
    - `service_reminders`: per-service reminder rules
      - channel (email/sms/whatsapp), timing_offset_minutes, label, is_active

  3. Default event types
    - Seeds "15 Min Quick Call", "30 Min Consultation", "60 Min Deep Dive" for all existing users
    - Trigger seeds them on new profile creation
*/

-- ── Payment columns on services ──────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='payment_provider') THEN
    ALTER TABLE services ADD COLUMN payment_provider text NOT NULL DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='paypal_client_id') THEN
    ALTER TABLE services ADD COLUMN paypal_client_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='paypal_currency') THEN
    ALTER TABLE services ADD COLUMN paypal_currency text NOT NULL DEFAULT 'USD';
  END IF;
END $$;

-- ── service_reminders table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_reminders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id            uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  channel               text NOT NULL DEFAULT 'email',
  timing_offset_minutes integer NOT NULL DEFAULT -1440,
  label                 text NOT NULL DEFAULT '1 day before',
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE service_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_reminders' AND policyname='Hosts select own service reminders') THEN
    CREATE POLICY "Hosts select own service reminders"
      ON service_reminders FOR SELECT TO authenticated
      USING (auth.uid() = host_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_reminders' AND policyname='Hosts insert own service reminders') THEN
    CREATE POLICY "Hosts insert own service reminders"
      ON service_reminders FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = host_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_reminders' AND policyname='Hosts update own service reminders') THEN
    CREATE POLICY "Hosts update own service reminders"
      ON service_reminders FOR UPDATE TO authenticated
      USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_reminders' AND policyname='Hosts delete own service reminders') THEN
    CREATE POLICY "Hosts delete own service reminders"
      ON service_reminders FOR DELETE TO authenticated
      USING (auth.uid() = host_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS service_reminders_service_id_idx ON service_reminders(service_id);
CREATE INDEX IF NOT EXISTS service_reminders_host_id_idx ON service_reminders(host_id);

-- ── Function: seed default event types for a host ─────────────────────────────

CREATE OR REPLACE FUNCTION seed_default_event_types(p_host_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM services WHERE host_id = p_host_id AND name = '15 Min Quick Call') THEN
    INSERT INTO services (host_id, name, duration_minutes, price_cents, color, is_active, location_type, meeting_type, buffer_before_minutes, buffer_after_minutes, min_notice_hours, booking_window_days, slot_increment_minutes, allow_cancellation, allow_reschedule, payment_provider, paypal_currency)
    VALUES (p_host_id, '15 Min Quick Call', 15, 0, '#10b981', true, 'video', 'one_on_one', 0, 0, 1, 60, 15, true, true, 'none', 'USD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM services WHERE host_id = p_host_id AND name = '30 Min Consultation') THEN
    INSERT INTO services (host_id, name, duration_minutes, price_cents, color, is_active, location_type, meeting_type, buffer_before_minutes, buffer_after_minutes, min_notice_hours, booking_window_days, slot_increment_minutes, allow_cancellation, allow_reschedule, payment_provider, paypal_currency)
    VALUES (p_host_id, '30 Min Consultation', 30, 0, '#1a56db', true, 'video', 'one_on_one', 0, 0, 1, 60, 30, true, true, 'none', 'USD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM services WHERE host_id = p_host_id AND name = '60 Min Deep Dive') THEN
    INSERT INTO services (host_id, name, duration_minutes, price_cents, color, is_active, location_type, meeting_type, buffer_before_minutes, buffer_after_minutes, min_notice_hours, booking_window_days, slot_increment_minutes, allow_cancellation, allow_reschedule, payment_provider, paypal_currency)
    VALUES (p_host_id, '60 Min Deep Dive', 60, 0, '#f59e0b', true, 'video', 'one_on_one', 0, 0, 1, 60, 30, true, true, 'none', 'USD');
  END IF;
END;
$$;

-- ── Seed defaults for all existing users ─────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles LOOP
    PERFORM seed_default_event_types(r.id);
  END LOOP;
END $$;

-- ── Trigger: seed defaults on new profile creation ───────────────────────────

CREATE OR REPLACE FUNCTION trigger_seed_default_event_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_default_event_types(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_seed_event_types ON profiles;
CREATE TRIGGER on_profile_seed_event_types
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_seed_default_event_types();
