-- Track Google/Outlook event IDs written when bookings or personal reminders sync out.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS external_calendar_events jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN bookings.external_calendar_events IS
  'Provider event refs, e.g. [{"connected_calendar_id":"…","provider":"google","provider_event_id":"…"}].';

ALTER TABLE personal_reminders
  ADD COLUMN IF NOT EXISTS external_calendar_events jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN personal_reminders.external_calendar_events IS
  'Provider event refs when reminder was added to Google/Outlook.';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS personal_reminder_add_to_calendar boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.personal_reminder_add_to_calendar IS
  'Default: also add personal reminders to connected Google/Outlook calendars.';
