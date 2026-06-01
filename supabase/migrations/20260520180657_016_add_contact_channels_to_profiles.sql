/*
  # Add contact channel fields to profiles

  1. Changes
    - `profiles` table: add `phone` (text) and `whatsapp_number` (text) columns
      - phone is used for SMS reminders
      - whatsapp_number is used for WhatsApp reminders (may differ from phone)
  2. Notes
    - Both columns are nullable — users fill them in as needed
    - No RLS changes needed; profiles already has per-user RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN whatsapp_number text DEFAULT NULL;
  END IF;
END $$;
