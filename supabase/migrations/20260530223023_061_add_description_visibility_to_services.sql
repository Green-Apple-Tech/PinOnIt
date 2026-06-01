/*
  # Add description visibility flags to services

  1. Changes
    - `services` table: add two boolean columns
      - `show_description_on_booking_page` (default true) — controls whether the
        description appears on the host's public booking page (/{username})
      - `show_description_on_paid_booking` (default true) — controls whether the
        description appears on the paid booking page (/smith-photo or similar)

  2. Notes
    - Both columns default to true so existing services retain their current
      behaviour (descriptions show everywhere) without requiring a data migration.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'show_description_on_booking_page'
  ) THEN
    ALTER TABLE services ADD COLUMN show_description_on_booking_page boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'show_description_on_paid_booking'
  ) THEN
    ALTER TABLE services ADD COLUMN show_description_on_paid_booking boolean NOT NULL DEFAULT true;
  END IF;
END $$;
