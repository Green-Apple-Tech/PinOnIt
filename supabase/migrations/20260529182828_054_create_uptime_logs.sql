/*
  # Create uptime_logs table for status monitoring

  ## Overview
  Stores health check results for the Pin on It status monitoring system.
  The health-monitor edge function pings all services every 5 minutes and
  records results here. The public /status page reads from this table.

  ## New Tables
  - `uptime_logs`
    - `id` (uuid, primary key)
    - `checked_at` (timestamptz) — when the check ran
    - `service_name` (text) — which service was checked (e.g. "Booking Page")
    - `status` (text) — 'ok', 'degraded', or 'down'
    - `response_time_ms` (int) — HTTP response time in milliseconds
    - `error_message` (text, nullable) — error detail if status != ok
    - `is_restart_attempt` (boolean) — true if this entry logs a restart attempt

  ## Security
  - RLS enabled
  - Anonymous users can SELECT (status page is public)
  - Only service_role can INSERT/UPDATE/DELETE (written by edge functions)

  ## Indexes
  - checked_at DESC for efficient time-range queries
  - service_name for per-service filtering
*/

CREATE TABLE IF NOT EXISTS uptime_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  service_name text NOT NULL DEFAULT 'App',
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'degraded', 'down')),
  response_time_ms integer,
  error_message text,
  is_restart_attempt boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS uptime_logs_checked_at_idx ON uptime_logs (checked_at DESC);
CREATE INDEX IF NOT EXISTS uptime_logs_service_name_idx ON uptime_logs (service_name);

ALTER TABLE uptime_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read uptime logs"
  ON uptime_logs FOR SELECT
  TO anon, authenticated
  USING (true);
