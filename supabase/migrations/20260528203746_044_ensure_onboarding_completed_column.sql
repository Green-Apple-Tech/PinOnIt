/*
  # Ensure onboarding_completed column exists on profiles

  1. Changes
    - Add onboarding_completed boolean column to profiles if it doesn't already exist
    - Defaults to false for new users
    - Set to true for any existing user who has a connected calendar, active subscription, or services
      so they are never shown the wizard again

  2. Notes
    - Safe to run multiple times (IF NOT EXISTS)
    - Existing Pro/active users are auto-completed so the wizard never loops for them
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_completed boolean DEFAULT false;
  END IF;
END $$;

-- Mark completed for any user who already has a paid/trialing subscription
UPDATE profiles p
SET onboarding_completed = true
WHERE onboarding_completed = false
  AND EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.user_id = p.id
      AND s.plan != 'free'
      AND s.status NOT IN ('canceled', 'incomplete_expired')
  );

-- Mark completed for any user who already has a connected calendar
UPDATE profiles p
SET onboarding_completed = true
WHERE onboarding_completed = false
  AND EXISTS (
    SELECT 1 FROM connected_calendars cc WHERE cc.host_id = p.id
  );

-- Mark completed for any user who has a slug set (has been through setup)
UPDATE profiles p
SET onboarding_completed = true
WHERE onboarding_completed = false
  AND p.slug IS NOT NULL
  AND p.slug != '';
