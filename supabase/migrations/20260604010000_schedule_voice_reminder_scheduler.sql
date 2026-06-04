/*
  Schedule voice-reminder-scheduler every 5 minutes.
  Calls hosts with voice_reminder_enabled for confirmed bookings in the next hour.
*/

SELECT cron.schedule(
  'voice-reminder-scheduler',
  '*/5 * * * *',
  $$
    SELECT extensions.http_post(
      url      := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/voice-reminder-scheduler',
      headers  := '{"Content-Type":"application/json","Authorization":"Bearer anon"}',
      content  := '{}',
      content_type := 'application/json'
    );
  $$
);
