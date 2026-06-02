/*
  # Global Terms & Conditions settings

  - profiles.global_require_terms: show T&C on all bookings when true (default off)
  - profiles.global_terms_text: editable terms copy
  - services.require_terms: per-event override (default false)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'global_require_terms'
  ) THEN
    ALTER TABLE profiles ADD COLUMN global_require_terms boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'global_terms_text'
  ) THEN
    ALTER TABLE profiles ADD COLUMN global_terms_text text NOT NULL DEFAULT 'By booking this appointment you agree to our cancellation policy. Cancellations must be made at least 24 hours in advance. No-shows may be charged the full session fee. Payment is due at time of booking.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'require_terms'
  ) THEN
    ALTER TABLE services ADD COLUMN require_terms boolean NOT NULL DEFAULT false;
  ELSE
    ALTER TABLE services ALTER COLUMN require_terms SET DEFAULT false;
  END IF;
END $$;
