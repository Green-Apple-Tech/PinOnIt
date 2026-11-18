-- Stop the Reddit finder schedule. The finder is no longer part of the app.
-- Existing rows stay in place.

DO $$
BEGIN
  PERFORM cron.unschedule('reddit-opportunity-finder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
