-- SMS / WhatsApp multi-party coordination (Align & Book Attendees)

CREATE TABLE IF NOT EXISTS coordinated_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'collecting_availability',
  proposed_window_start timestamptz,
  proposed_window_end timestamptz,
  confirmed_time timestamptz,
  selected_dates date[],
  preferred_times jsonb DEFAULT '[]'::jsonb,
  industry_template text DEFAULT 'general',
  reminder_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coordinated_meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES coordinated_meetings(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  role text DEFAULT '',
  masked_twilio_number text,
  availability_response text,
  parsed_slots jsonb,
  opted_out boolean NOT NULL DEFAULT false,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coordinated_meetings_host_id_idx
  ON coordinated_meetings(host_id);

CREATE INDEX IF NOT EXISTS coordinated_meeting_participants_meeting_id_idx
  ON coordinated_meeting_participants(meeting_id);

CREATE INDEX IF NOT EXISTS coordinated_meeting_participants_phone_idx
  ON coordinated_meeting_participants(phone);

ALTER TABLE coordinated_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinated_meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own coordinated meetings"
  ON coordinated_meetings
  FOR ALL
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Host can manage coordinated meeting participants"
  ON coordinated_meeting_participants
  FOR ALL
  USING (
    meeting_id IN (
      SELECT id FROM coordinated_meetings WHERE host_id = auth.uid()
    )
  )
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM coordinated_meetings WHERE host_id = auth.uid()
    )
  );
