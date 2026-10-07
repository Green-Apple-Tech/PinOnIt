-- Place on a personal reminder, and the standard ping plan:
-- email the day before, text 1 hour before, text 10 minutes before.

ALTER TABLE public.personal_reminders
  ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE public.profiles
  ALTER COLUMN personal_reminder_defaults
  SET DEFAULT '{"day_before":["email"],"hour_before":["sms"],"ten_min":["sms"]}'::jsonb;

UPDATE public.profiles
SET personal_reminder_defaults = '{"day_before":["email"],"hour_before":["sms"],"ten_min":["sms"]}'::jsonb
WHERE personal_reminder_defaults = '{"day_before":["email"],"hour_before":["email"],"ten_min":["sms"]}'::jsonb;
