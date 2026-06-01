/*
  # Set default_link_expiry_days column default to 7

  1. Changes
    - Alters the `default_link_expiry_days` column on `profiles` to have a default of 7
      so new users automatically get a 7-day link expiry instead of NULL (never)
    - Existing rows with NULL are left unchanged (they will continue to show as NULL
      until the user explicitly saves their settings, at which point the UI default of
      7 kicks in)
*/

DO $$
BEGIN
  ALTER TABLE profiles ALTER COLUMN default_link_expiry_days SET DEFAULT 7;
END $$;
