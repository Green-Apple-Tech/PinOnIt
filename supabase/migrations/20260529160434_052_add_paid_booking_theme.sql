/*
  # Add paid_booking_theme to profiles

  ## Summary
  Adds a `paid_booking_theme` column to profiles so users can pick
  one of three visual themes for their public paid booking page:
  - 'clean'  — light minimal (white background, green buttons)
  - 'bold'   — dark dramatic (near-black background, high contrast)
  - 'warm'   — soft earthy (cream background, muted accent colors)

  ## Changes
  - `profiles.paid_booking_theme` text NOT NULL DEFAULT 'clean'

  ## Security
  Existing RLS policies on profiles cover the new column automatically.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'paid_booking_theme'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN paid_booking_theme text NOT NULL DEFAULT 'clean';
  END IF;
END $$;
