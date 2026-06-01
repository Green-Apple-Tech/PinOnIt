-- Optional host-entered availability (skip SMS for these participants)

ALTER TABLE coordinated_meeting_participants
  ADD COLUMN IF NOT EXISTS availability_pre_entered boolean NOT NULL DEFAULT false;
