/*
  # Advanced Features Migration

  ## Summary
  Adds support for four new advanced scheduling features:

  1. **Tentative Bookings**
     - Adds 'tentative' and 'pending_approval' to the bookings status enum
     - Tentative bookings hold a slot without confirmation until approved by the host

  2. **Group Sessions / Classes**
     - Adds `event_type` column to services: 'one_on_one' (default) or 'group'
     - Adds `max_attendees` column to services for capacity limit
     - Adds `group_bookings` join table tracking each attendee in a group session

  3. **Multi-Host Round Robin & Collective Events**
     - Adds `scheduling_type` column to services: 'solo', 'round_robin', 'collective'
     - Adds `team_members` table linking hosts to services for multi-host routing
     - Round robin auto-assigns to the next available host; collective requires all hosts free

  4. **Follow-up Emails**
     - No schema change needed; follow_up type already exists in message_templates
     - Adds a `follow_up_delay_hours` column to services for per-service follow-up timing
*/

-- ── 1. Tentative booking status ──────────────────────────────────────────────

DO $$
BEGIN
  -- Add new values to the booking status check constraint by dropping and re-adding it
  -- First check if 'tentative' already exists as a valid status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'status'
    AND udt_name = 'text'
  ) THEN
    NULL; -- column exists, proceed
  END IF;
END $$;

-- Update the check constraint on bookings.status to include tentative/pending_approval
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('tentative', 'pending_approval', 'confirmed', 'canceled', 'completed', 'no_show'));

-- ── 2. Group sessions columns on services ────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE services ADD COLUMN event_type text NOT NULL DEFAULT 'one_on_one'
      CHECK (event_type IN ('one_on_one', 'group'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'max_attendees'
  ) THEN
    ALTER TABLE services ADD COLUMN max_attendees integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'follow_up_delay_hours'
  ) THEN
    ALTER TABLE services ADD COLUMN follow_up_delay_hours integer DEFAULT NULL;
  END IF;
END $$;

-- ── 3. Multi-host scheduling type on services ────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'scheduling_type'
  ) THEN
    ALTER TABLE services ADD COLUMN scheduling_type text NOT NULL DEFAULT 'solo'
      CHECK (scheduling_type IN ('solo', 'round_robin', 'collective'));
  END IF;
END $$;

-- ── 4. team_members table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(service_id, member_user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view own team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can insert own team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own team members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own team members"
  ON team_members FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- ── 5. group_bookings table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  attendee_name text NOT NULL,
  attendee_email text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'canceled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE group_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view group bookings for their bookings"
  ON group_bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = group_bookings.booking_id
      AND bookings.host_id = auth.uid()
    )
  );

CREATE POLICY "Anon can insert group bookings"
  ON group_bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = group_bookings.booking_id
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_members_service_id ON team_members(service_id);
CREATE INDEX IF NOT EXISTS idx_team_members_host_id ON team_members(host_id);
CREATE INDEX IF NOT EXISTS idx_group_bookings_booking_id ON group_bookings(booking_id);
