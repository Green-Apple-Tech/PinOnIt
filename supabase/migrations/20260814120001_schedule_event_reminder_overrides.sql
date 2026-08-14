-- Dispatch extra event reminders (SMS / WhatsApp / email) every 5 minutes.

SELECT cron.schedule(
  'dispatch-event-reminder-overrides',
  '*/5 * * * *',
  $$
    SELECT extensions.http_post(
      url      := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/send-reminder',
      headers  := '{"Content-Type":"application/json","Authorization":"Bearer anon"}',
      content  := '{"dispatch_event_overrides":true}',
      content_type := 'application/json'
    );
  $$
);
