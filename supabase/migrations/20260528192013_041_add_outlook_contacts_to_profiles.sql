/*
  # Add Outlook contacts sync columns to profiles

  ## Summary
  Mirrors the existing Gmail contacts sync columns so Outlook contacts can be
  tracked the same way. The actual access token for Outlook is already stored
  in the connected_calendars table; we only need a connected flag and a count.

  ## Changes
  - `profiles` table gains two new columns:
    - `outlook_contacts_connected` (boolean, default false) — whether Outlook
      contacts sync has been authorised (Contacts.Read scope granted)
    - `outlook_contacts_count` (integer, default 0) — last known imported count

  All additions use IF NOT EXISTS to be re-run safe.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'outlook_contacts_connected'
  ) THEN
    ALTER TABLE profiles ADD COLUMN outlook_contacts_connected boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'outlook_contacts_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN outlook_contacts_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;
