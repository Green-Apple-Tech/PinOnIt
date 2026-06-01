/*
  # Add wizard_active column to profiles

  Tracks whether the onboarding wizard was in progress when the user
  was redirected away (e.g., OAuth calendar connect). On return to /dashboard
  the wizard is reopened at the saved onboarding_step.

  1. Changes
    - `profiles.wizard_active` (boolean, default false) — set true before
      any OAuth redirect from inside the wizard, cleared when wizard
      completes, is dismissed, or advances past the calendar step.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wizard_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wizard_active boolean NOT NULL DEFAULT false;
  END IF;
END $$;
