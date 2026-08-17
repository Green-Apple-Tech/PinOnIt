-- Health-monitor cron must send the service-role JWT after the function
-- started rejecting anonymous pings.

DO $$
BEGIN
  PERFORM cron.unschedule('health-monitor-ping');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'health-monitor-ping',
  '*/5 * * * *',
  $$
    SELECT extensions.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
             || '/functions/v1/health-monitor',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1
        )
      )::text,
      content := '{}',
      content_type := 'application/json'
    );
  $$
);
