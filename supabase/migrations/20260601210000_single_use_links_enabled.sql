/*
  # Add single_use_links_enabled to profiles

  Controls whether single-use link expiry settings are active.
  default_link_expiry_days is only applied when this is true.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'single_use_links_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN single_use_links_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;
