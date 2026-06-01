/*
  # Schedule health-monitor edge function every 5 minutes

  Uses pg_cron (already enabled) to call the health-monitor edge function
  every 5 minutes via net.http_post from the pg_net extension.

  The function checks all services and logs results to uptime_logs,
  sending SMS alerts via Twilio on status changes.
*/

SELECT cron.schedule(
  'health-monitor-ping',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/health-monitor',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
