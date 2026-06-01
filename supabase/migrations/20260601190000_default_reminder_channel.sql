/*
  # Default reminder channel preference

  - profiles.default_reminder_channel: email | sms | whatsapp | voice (default whatsapp)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'default_reminder_channel'
  ) THEN
    ALTER TABLE profiles ADD COLUMN default_reminder_channel text DEFAULT 'whatsapp';
  END IF;
END $$;

UPDATE profiles
SET default_reminder_channel = 'whatsapp'
WHERE default_reminder_channel IS NULL;
