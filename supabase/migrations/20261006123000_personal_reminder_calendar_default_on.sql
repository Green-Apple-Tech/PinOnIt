-- Personal reminders add to Google/Outlook unless the host turns that off.

ALTER TABLE public.profiles
  ALTER COLUMN personal_reminder_add_to_calendar SET DEFAULT true;

UPDATE public.profiles
SET personal_reminder_add_to_calendar = true
WHERE personal_reminder_add_to_calendar = false;

COMMENT ON COLUMN public.profiles.personal_reminder_add_to_calendar IS
  'When true, new personal reminders start with Google/Outlook calendar write-back checked.';
