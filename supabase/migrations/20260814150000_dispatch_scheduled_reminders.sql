-- Timed SMS/WhatsApp/email reminders were saved on reminder_rules but never
-- dispatched. Extra reminders also used a 15-minute catch window and a cron
-- Authorization value that is not a JWT.
-- Allow activity-log rows for test sends (no booking).

ALTER TABLE public.message_log
  ALTER COLUMN booking_id DROP NOT NULL;

DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-event-reminder-overrides');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-reminders',
  '* * * * *',
  $$
    SELECT extensions.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
             || '/functions/v1/send-reminder',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1),
          'anon'
        )
      )::text,
      content := '{"dispatch_event_overrides":true,"dispatch_scheduled":true}',
      content_type := 'application/json'
    );
  $$
);
