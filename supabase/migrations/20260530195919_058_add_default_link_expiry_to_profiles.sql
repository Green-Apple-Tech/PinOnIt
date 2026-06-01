/*
  # Add default_link_expiry_days to profiles

  1. Changes
    - Adds `default_link_expiry_days` (integer, nullable) to `profiles`
      - NULL means "never expire" (no expiry)
      - Integer value = number of days before the shared link expires
      - Default is NULL (no expiry) so existing users are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'default_link_expiry_days'
  ) THEN
    ALTER TABLE profiles ADD COLUMN default_link_expiry_days integer DEFAULT NULL;
  END IF;
END $$;
