/*
  # Meeting Types, Meeting Polls, and Analytics Support

  ## Changes

  1. New column on `services`
     - `meeting_type` (text) — discriminates: 'one_on_one' | 'group' | 'round_robin' | 'collective' | 'one_off'
     - `max_invitees` (int) — for group events: max participants
     - `is_one_off` (boolean) — marks one-off / single-use event types

  2. New Table: `meeting_polls`
     - Scheduling polls where invitees vote on their preferred times
     - `id`, `host_id`, `title`, `description`, `duration_minutes`, `location`, `location_type`
     - `status`: 'open' | 'closed' | 'confirmed'
     - `confirmed_slot_start` / `confirmed_slot_end` — set when host confirms
     - `expires_at` — auto-close date

  3. New Table: `meeting_poll_slots`
     - Time options offered in a poll
     - `id`, `poll_id`, `start_time`, `end_time`

  4. New Table: `meeting_poll_responses`
     - Invitee votes on poll slots
     - `id`, `poll_id`, `invitee_name`, `invitee_email`, `token` (unique per invitee)
     - `created_at`

  5. New Table: `meeting_poll_votes`
     - Per-slot vote (yes/maybe/no) from an invitee
     - `id`, `response_id`, `slot_id`, `availability` ('yes'|'maybe'|'no')

  6. RLS enabled on all new tables
*/

-- Add meeting_type support to services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'meeting_type'
  ) THEN
    ALTER TABLE services ADD COLUMN meeting_type text NOT NULL DEFAULT 'one_on_one'
      CHECK (meeting_type IN ('one_on_one', 'group', 'round_robin', 'collective', 'one_off'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'max_invitees'
  ) THEN
    ALTER TABLE services ADD COLUMN max_invitees int DEFAULT NULL;
  END IF;
END $$;

-- Meeting polls
CREATE TABLE IF NOT EXISTS meeting_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  duration_minutes int NOT NULL DEFAULT 30,
  location text NOT NULL DEFAULT '',
  location_type text NOT NULL DEFAULT 'video' CHECK (location_type IN ('video', 'phone', 'in_person', 'custom')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'confirmed')),
  confirmed_slot_start timestamptz DEFAULT NULL,
  confirmed_slot_end timestamptz DEFAULT NULL,
  expires_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can view own polls"
  ON meeting_polls FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Host can insert own polls"
  ON meeting_polls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update own polls"
  ON meeting_polls FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can delete own polls"
  ON meeting_polls FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- Public read for poll voting (anon needs to see poll details)
CREATE POLICY "Anyone can view open polls"
  ON meeting_polls FOR SELECT
  TO anon
  USING (status = 'open');

-- Poll slots (time options)
CREATE TABLE IF NOT EXISTS meeting_poll_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES meeting_polls(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_poll_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage own poll slots"
  ON meeting_poll_slots FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM meeting_polls WHERE id = poll_id AND host_id = auth.uid())
  );

CREATE POLICY "Host can insert poll slots"
  ON meeting_poll_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_polls WHERE id = poll_id AND host_id = auth.uid())
  );

CREATE POLICY "Host can delete poll slots"
  ON meeting_poll_slots FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM meeting_polls WHERE id = poll_id AND host_id = auth.uid())
  );

CREATE POLICY "Anyone can view poll slots"
  ON meeting_poll_slots FOR SELECT
  TO anon
  USING (
    EXISTS (SELECT 1 FROM meeting_polls WHERE id = poll_id AND status = 'open')
  );

-- Poll responses (one per invitee)
CREATE TABLE IF NOT EXISTS meeting_poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES meeting_polls(id) ON DELETE CASCADE,
  invitee_name text NOT NULL DEFAULT '',
  invitee_email text NOT NULL DEFAULT '',
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can view poll responses"
  ON meeting_poll_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM meeting_polls WHERE id = poll_id AND host_id = auth.uid())
  );

CREATE POLICY "Anyone can insert poll response"
  ON meeting_poll_responses FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert poll response"
  ON meeting_poll_responses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Poll votes (per slot per response)
CREATE TABLE IF NOT EXISTS meeting_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES meeting_poll_responses(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES meeting_poll_slots(id) ON DELETE CASCADE,
  availability text NOT NULL DEFAULT 'yes' CHECK (availability IN ('yes', 'maybe', 'no')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (response_id, slot_id)
);

ALTER TABLE meeting_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can view poll votes"
  ON meeting_poll_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meeting_poll_responses r
      JOIN meeting_polls p ON p.id = r.poll_id
      WHERE r.id = response_id AND p.host_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert vote"
  ON meeting_poll_votes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert vote"
  ON meeting_poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_polls_host_id ON meeting_polls(host_id);
CREATE INDEX IF NOT EXISTS idx_meeting_poll_slots_poll_id ON meeting_poll_slots(poll_id);
CREATE INDEX IF NOT EXISTS idx_meeting_poll_responses_poll_id ON meeting_poll_responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_meeting_poll_votes_response_id ON meeting_poll_votes(response_id);
CREATE INDEX IF NOT EXISTS idx_meeting_poll_votes_slot_id ON meeting_poll_votes(slot_id);
