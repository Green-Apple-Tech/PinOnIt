/*
  # Add referral_banner_dismissed to profiles

  Adds a boolean flag so users can permanently dismiss the referral earnings
  banner on the scheduling dashboard. The flag persists across devices/sessions.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'referral_banner_dismissed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referral_banner_dismissed boolean NOT NULL DEFAULT false;
  END IF;
END $$;
