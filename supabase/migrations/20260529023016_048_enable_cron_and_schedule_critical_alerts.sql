/*
  # Enable pg_cron + pg_net and schedule critical meeting alert job

  Enables the cron and HTTP extensions, then schedules the critical-alert
  edge function to fire every minute. The function checks for confirmed
  critical bookings starting in ~5 minutes or ~1 minute and sends SMS alerts
  to the host and their emergency contacts via Twilio.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the critical-alert edge function every minute.
-- Uses the project's anon key for authorization (the function itself uses the
-- service-role key stored as a Supabase secret, so no sensitive data here).
SELECT cron.schedule(
  'critical-meeting-alerts',
  '* * * * *',
  $$
    SELECT extensions.http_post(
      url      := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/critical-alert',
      headers  := '{"Content-Type":"application/json","Authorization":"Bearer anon"}',
      content  := '{}',
      content_type := 'application/json'
    );
  $$
);
