-- Host calendar sync and off-hours bypass for coordinated meetings

ALTER TABLE coordinated_meetings
  ADD COLUMN IF NOT EXISTS check_host_calendar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_off_hours boolean NOT NULL DEFAULT false;
