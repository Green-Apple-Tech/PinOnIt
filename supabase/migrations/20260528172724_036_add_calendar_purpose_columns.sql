/*
  # Add calendar purpose columns to connected_calendars

  1. Changes
    - `connected_calendars`
      - Add `use_for_scheduling` (boolean, default true) — whether this calendar is used for conflict-checking
      - Add `use_for_reminders` (boolean, default false) — whether this calendar is used for reminder delivery
    Both columns are independent and can both be true at the same time.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connected_calendars' AND column_name = 'use_for_scheduling'
  ) THEN
    ALTER TABLE connected_calendars ADD COLUMN use_for_scheduling boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connected_calendars' AND column_name = 'use_for_reminders'
  ) THEN
    ALTER TABLE connected_calendars ADD COLUMN use_for_reminders boolean NOT NULL DEFAULT false;
  END IF;
END $$;
