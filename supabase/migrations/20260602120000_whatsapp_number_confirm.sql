/*
  Ensure whatsapp_number column exists on profiles (idempotent).
  Used when WhatsApp is on a separate device from the primary phone.
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN whatsapp_number text;
  END IF;
END $$;
