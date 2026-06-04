/*
  Repair: profiles.phone / whatsapp_number missing on production despite
  20260520180657 being recorded. Idempotent re-add + PostgREST schema reload.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'default_reminder_channel'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN default_reminder_channel text DEFAULT 'whatsapp';
  END IF;
END $$;

UPDATE public.profiles
SET default_reminder_channel = 'whatsapp'
WHERE default_reminder_channel IS NULL;

NOTIFY pgrst, 'reload schema';
