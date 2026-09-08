-- Quote-by-Text follow-up reminders (unanswered quotes only).
-- Payment reminders are host-triggered; never scheduled here.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quote_followup_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quote_followup_days integer[] NOT NULL DEFAULT ARRAY[3, 7]::integer[];

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS quote_followup_sent_days integer[] NOT NULL DEFAULT ARRAY[]::integer[];

DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-quote-followups');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-quote-followups',
  '17 * * * *',
  $$
    SELECT extensions.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
             || '/functions/v1/dispatch-quote-reminders',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1
        )
      )::text,
      content := '{"dispatch":true}',
      content_type := 'application/json'
    );
  $$
);
