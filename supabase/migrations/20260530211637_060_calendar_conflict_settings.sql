/*
  # Calendar Conflict Settings

  1. New columns on `calendar_events`
    - `show_status` (text, nullable) — "busy" | "free" | "tentative" | "oof" (out-of-office)
      Populated from Google `status`/`transparency`, Outlook `showAs`, iCal `TRANSP`
    - `transparency` (text, nullable) — "opaque" (busy) | "transparent" (free)
      Direct mapping of the iCal/Google TRANSP property
    - `attendee_self_status` (text, nullable) — "accepted" | "declined" | "tentative" | "needsAction"
      The authenticated user's own RSVP on the event
    - `is_birthday_cal` (boolean, default false) — marks events from a birthdays calendar
    - `is_holiday_cal` (boolean, default false) — marks events from a holidays/public calendar

  2. New column on `profiles`
    - `calendar_conflict_settings` (jsonb, nullable)
      Stores per-host toggles:
        block_all_day_busy      boolean  default true
        block_free_all_day      boolean  default false
        block_declined          boolean  default false
        block_tentative         boolean  default false

  3. Notes
    - Existing rows get NULL for the new event columns (treated as unknown = block conservatively)
    - No RLS changes needed; calendar_events inherits existing policies
*/

-- calendar_events additions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'show_status') THEN
    ALTER TABLE calendar_events ADD COLUMN show_status text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'transparency') THEN
    ALTER TABLE calendar_events ADD COLUMN transparency text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'attendee_self_status') THEN
    ALTER TABLE calendar_events ADD COLUMN attendee_self_status text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'is_birthday_cal') THEN
    ALTER TABLE calendar_events ADD COLUMN is_birthday_cal boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'is_holiday_cal') THEN
    ALTER TABLE calendar_events ADD COLUMN is_holiday_cal boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- profiles addition
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'calendar_conflict_settings') THEN
    ALTER TABLE profiles ADD COLUMN calendar_conflict_settings jsonb DEFAULT NULL;
  END IF;
END $$;
