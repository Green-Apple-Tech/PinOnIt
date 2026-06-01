/*
  # Add show_wizard_button column to profiles

  Lets users hide the "Wizard Setup" button from the dashboard header via Settings.

  1. Changes
    - `profiles.show_wizard_button` (boolean, default true) — when false the
      Wizard Setup button is hidden from the Scheduling page header.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'show_wizard_button'
  ) THEN
    ALTER TABLE profiles ADD COLUMN show_wizard_button boolean NOT NULL DEFAULT true;
  END IF;
END $$;
