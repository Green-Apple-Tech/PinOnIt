-- Per-booking coworker reminder copies (references ids in profiles.reminder_also roster).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS also_remind_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN bookings.also_remind_ids IS
  'Roster person ids (profiles.reminder_also[].id) who get reminder copies for this booking only.';
