-- The scheduled job was calling extensions.http_post, which is not installed.
-- net.http_post is the helper this database actually has.

DO $$
BEGIN
  PERFORM cron.unschedule('reddit-opportunity-finder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reddit-opportunity-finder',
  '15 */6 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
             || '/functions/v1/reddit-opportunity-search',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reddit_finder_cron' LIMIT 1),
          ''
        )
      ),
      body := '{"scheduled":true}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
