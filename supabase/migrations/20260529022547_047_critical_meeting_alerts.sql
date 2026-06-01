/*
  # Critical Meeting Alerts

  Adds critical meeting flag to bookings and an emergency contacts table.

  1. New columns
    - `bookings.is_critical` (boolean, default false) — marks a booking as a critical
      meeting that will trigger host SMS alerts 5 and 1 minute before start time.

  2. New table `emergency_contacts`
    - Stores up to 3 backup contacts per host who also receive critical alerts.
    - Columns: id, host_id, label, phone, sort_order, created_at.

  3. Security
    - RLS enabled on emergency_contacts.
    - Only the authenticated owner can read/write their own contacts.
*/

-- 1. Add is_critical column to bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'is_critical'
  ) THEN
    ALTER TABLE bookings ADD COLUMN is_critical boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Track which critical alerts have already been sent (prevents duplicate fires)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'critical_alert_sent_5m'
  ) THEN
    ALTER TABLE bookings ADD COLUMN critical_alert_sent_5m boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'critical_alert_sent_1m'
  ) THEN
    ALTER TABLE bookings ADD COLUMN critical_alert_sent_1m boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Emergency contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select emergency contacts"
  ON emergency_contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Owner can insert emergency contacts"
  ON emergency_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Owner can update emergency contacts"
  ON emergency_contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Owner can delete emergency contacts"
  ON emergency_contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- Index for fast host lookups
CREATE INDEX IF NOT EXISTS emergency_contacts_host_id_idx ON emergency_contacts(host_id);
CREATE INDEX IF NOT EXISTS bookings_critical_idx ON bookings(is_critical, start_time) WHERE is_critical = true;
