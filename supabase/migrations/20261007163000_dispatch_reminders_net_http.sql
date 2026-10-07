-- dispatch-reminders was calling extensions.http_post, which is not installed,
-- so personal and booking reminders never left the database.
-- net.http_post is the helper this database actually has.

DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-reminders',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
             || '/functions/v1/send-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
          ''
        )
      ),
      body := '{"dispatch_event_overrides":true,"dispatch_scheduled":true}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
