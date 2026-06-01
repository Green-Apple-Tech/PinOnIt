/*
  # Add schedule breaks and meeting buffer to profiles

  ## Changes

  ### Modified Tables
  - `profiles`
    - `schedule_breaks` (jsonb, default []): Array of break windows, e.g.
      [{ "id": "lunch", "label": "Lunch break", "start": "12:00", "end": "13:00", "enabled": true }]
    - `meeting_buffer_minutes` (integer, default 0): Buffer time added between consecutive meetings.

  ## Notes
  - Both columns are nullable/defaulted so existing rows are unaffected.
  - schedule_breaks stores break periods that block booking slots within a working day.
  - meeting_buffer_minutes is a global buffer applied to all event types when computing available slots.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'schedule_breaks'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN schedule_breaks jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'meeting_buffer_minutes'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN meeting_buffer_minutes integer DEFAULT 0;
  END IF;
END $$;
