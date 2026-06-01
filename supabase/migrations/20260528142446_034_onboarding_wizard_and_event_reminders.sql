/*
  # Onboarding Wizard & Event Reminder Overrides

  ## Changes

  ### profiles table
  - Add `onboarding_completed` boolean: tracks if user finished the wizard
  - Add `onboarding_step` integer: last step reached (for resume)

  ### services table
  - Add `booking_calendar_ids` uuid[]: which connected_calendars to write bookings to

  ### New table: event_reminder_overrides
  - Per-event reminder overrides linked to a booking id
  - Allows custom reminder rules that override the default reminder settings
  - Fields: id, booking_id, host_id, channel, offset_minutes, message, created_at

  ## Security
  - RLS enabled on event_reminder_overrides
  - Authenticated host can CRUD their own overrides
*/

-- ── profiles: onboarding tracking ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_step'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_step integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── services: multi-calendar booking target ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'booking_calendar_ids'
  ) THEN
    ALTER TABLE services ADD COLUMN booking_calendar_ids uuid[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- ── event_reminder_overrides table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_reminder_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  offset_minutes integer NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_reminder_overrides_booking_id_idx ON event_reminder_overrides(booking_id);
CREATE INDEX IF NOT EXISTS event_reminder_overrides_host_id_idx ON event_reminder_overrides(host_id);

ALTER TABLE event_reminder_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can select own reminder overrides"
  ON event_reminder_overrides FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Host can insert own reminder overrides"
  ON event_reminder_overrides FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update own reminder overrides"
  ON event_reminder_overrides FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can delete own reminder overrides"
  ON event_reminder_overrides FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);
