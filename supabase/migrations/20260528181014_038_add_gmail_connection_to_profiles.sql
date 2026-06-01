/*
  # Add Gmail connection columns to profiles

  Stores Gmail OAuth tokens and connection state per user so the contacts import
  flow can persist the access/refresh tokens and track connected state.

  1. Modified Tables
    - `profiles`
      - `gmail_connected` (boolean, default false) — whether Gmail is connected
      - `gmail_access_token` (text) — current OAuth access token
      - `gmail_refresh_token` (text) — OAuth refresh token (long-lived)
      - `gmail_contacts_count` (integer, default 0) — last known import count
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gmail_connected'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gmail_connected boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gmail_access_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gmail_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gmail_refresh_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gmail_refresh_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gmail_contacts_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gmail_contacts_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;
