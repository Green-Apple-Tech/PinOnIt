/*
  # Add single_use_links and link_expiry to profiles

  Canonical settings for single-use booking links (alongside legacy columns).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'single_use_links'
  ) THEN
    ALTER TABLE profiles ADD COLUMN single_use_links boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'link_expiry'
  ) THEN
    ALTER TABLE profiles ADD COLUMN link_expiry text NOT NULL DEFAULT '1_booking';
  END IF;
END $$;

-- Backfill from legacy columns where present
UPDATE profiles
SET
  single_use_links = COALESCE(single_use_links_enabled, false),
  link_expiry = CASE
    WHEN default_link_expiry_days = 1 THEN '24_hours'
    WHEN default_link_expiry_days = 7 THEN '7_days'
    WHEN default_link_expiry_days = 30 THEN '30_days'
    ELSE '1_booking'
  END
WHERE single_use_links = false AND single_use_links_enabled = true;
