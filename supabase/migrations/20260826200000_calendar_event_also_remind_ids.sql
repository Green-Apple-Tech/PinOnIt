-- Per-event coworker copies for synced Google/Outlook calendar events.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS also_remind_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN calendar_events.also_remind_ids IS
  'Roster person ids (profiles.reminder_also[].id) who get reminder copies for this calendar event only.';
