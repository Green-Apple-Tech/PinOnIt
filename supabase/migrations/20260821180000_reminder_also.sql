-- Extra Super Reminder recipients (coworkers / others). Email, SMS, WhatsApp only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_also jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
