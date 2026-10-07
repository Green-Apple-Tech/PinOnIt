-- dispatch-reminders built its URL from vault secret supabase_url.
-- That value is empty, so every run failed before the request was sent
-- and personal texts and calls never left.

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
      url := 'https://adlusgtlwgcfyxgeoias.supabase.co/functions/v1/send-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
          ''
        ),
        'x-cron-secret', COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dispatch_cron_secret' LIMIT 1),
          ''
        )
      ),
      body := '{"dispatch_event_overrides":true,"dispatch_scheduled":true}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
