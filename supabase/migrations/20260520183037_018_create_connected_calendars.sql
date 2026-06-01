/*
  # Create connected_calendars and calendar_events tables

  1. New Tables
    - `connected_calendars`
      - id, host_id, provider (google/outlook/apple/caldav/ical), provider_account_email
      - calendar_name, sync_enabled, last_synced_at, token_expires_at
      - access_token, refresh_token (encrypted at rest by Postgres)
      - caldav_url, caldav_username, caldav_password (for Apple/CalDAV)
      - ical_url (for iCal feed subscriptions)
    - `calendar_events`
      - id, calendar_id, host_id, external_id, title, start_time, end_time

  2. Security
    - RLS enabled on both tables
    - Users can only read/write their own rows
*/

CREATE TABLE IF NOT EXISTS connected_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'outlook', 'apple', 'caldav', 'ical')),
  provider_account_email text NOT NULL DEFAULT '',
  calendar_name text NOT NULL DEFAULT '',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz DEFAULT NULL,
  token_expires_at timestamptz DEFAULT NULL,
  access_token text DEFAULT NULL,
  refresh_token text DEFAULT NULL,
  caldav_url text DEFAULT NULL,
  caldav_username text DEFAULT NULL,
  caldav_password text DEFAULT NULL,
  ical_url text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS connected_calendars_host_id_idx ON connected_calendars(host_id);

ALTER TABLE connected_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own connected calendars"
  ON connected_calendars FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Users can insert own connected calendars"
  ON connected_calendars FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can update own connected calendars"
  ON connected_calendars FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can delete own connected calendars"
  ON connected_calendars FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- Calendar events cache
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES connected_calendars(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calendar_id, external_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_host_id_idx ON calendar_events(host_id);
CREATE INDEX IF NOT EXISTS calendar_events_calendar_id_idx ON calendar_events(calendar_id);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Users can insert own calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);
