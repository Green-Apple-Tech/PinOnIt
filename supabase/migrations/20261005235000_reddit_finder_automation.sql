-- Automation settings, founder OAuth, and alert queue for the Reddit finder.
-- Auto-posting stays off. Reddit's Responsible Builder Policy blocks commercial auto-comments.

ALTER TABLE public.reddit_opportunities
  ADD COLUMN IF NOT EXISTS band text NOT NULL DEFAULT 'yellow' CHECK (band IN ('green', 'yellow', 'red')),
  ADD COLUMN IF NOT EXISTS thread_context text,
  ADD COLUMN IF NOT EXISTS band_reason text;

CREATE TABLE IF NOT EXISTS public.reddit_finder_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_post_enabled boolean NOT NULL DEFAULT false,
  min_green_score integer NOT NULL DEFAULT 80,
  min_keep_score integer NOT NULL DEFAULT 45,
  max_comments_per_day integer NOT NULL DEFAULT 3,
  max_mentions_per_day integer NOT NULL DEFAULT 2,
  max_per_subreddit_per_day integer NOT NULL DEFAULT 1,
  cooldown_hours integer NOT NULL DEFAULT 8,
  allow_subreddits text[] NOT NULL DEFAULT '{}',
  block_subreddits text[] NOT NULL DEFAULT '{}',
  allow_keywords text[] NOT NULL DEFAULT '{}',
  block_keywords text[] NOT NULL DEFAULT ARRAY['notary', 'hipaa', 'election', 'suicide'],
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.reddit_finder_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.reddit_finder_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reddit_finder_settings_staff ON public.reddit_finder_settings;
CREATE POLICY reddit_finder_settings_staff
  ON public.reddit_finder_settings
  FOR ALL
  TO authenticated
  USING (public.is_pinonit_staff())
  WITH CHECK (public.is_pinonit_staff());

CREATE TABLE IF NOT EXISTS public.reddit_oauth_tokens (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  reddit_username text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  connected_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reddit_oauth_tokens ENABLE ROW LEVEL SECURITY;
-- No client policy. The service role used by the edge functions is the only reader.

CREATE TABLE IF NOT EXISTS public.reddit_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  message text NOT NULL,
  opportunity_id uuid REFERENCES public.reddit_opportunities (id) ON DELETE SET NULL,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reddit_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reddit_alerts_staff ON public.reddit_alerts;
CREATE POLICY reddit_alerts_staff
  ON public.reddit_alerts
  FOR SELECT
  TO authenticated
  USING (public.is_pinonit_staff());

CREATE OR REPLACE FUNCTION public.reddit_connection_status()
RETURNS TABLE (
  connected boolean,
  reddit_username text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_pinonit_staff() THEN
    RETURN;
  END IF;
  SELECT (t.refresh_token IS NOT NULL), t.reddit_username
    INTO connected, reddit_username
  FROM public.reddit_oauth_tokens t
  WHERE t.id = 1;
  IF NOT FOUND THEN
    connected := false;
    reddit_username := NULL;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reddit_connection_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reddit_connection_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.reddit_learning_summary()
RETURNS TABLE (
  reddit_visits bigint,
  reddit_signups bigint,
  reddit_trials bigint,
  reddit_paid bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_pinonit_staff() THEN
    RETURN;
  END IF;

  reddit_visits := (
    SELECT count(*)::bigint
    FROM public.marketing_visits v
    WHERE v.created_at > now() - interval '180 days'
      AND (
        lower(COALESCE(v.utm_source, '')) = 'reddit'
        OR lower(COALESCE(v.referrer_host, '')) LIKE '%reddit.com'
      )
  );
  reddit_signups := (
    SELECT count(*)::bigint
    FROM public.profiles p
    WHERE lower(COALESCE(p.signup_attribution->>'utm_source', '')) = 'reddit'
  );
  reddit_trials := (
    SELECT count(*)::bigint
    FROM public.profiles p
    JOIN public.subscriptions s ON s.user_id = p.id
    WHERE lower(COALESCE(p.signup_attribution->>'utm_source', '')) = 'reddit'
      AND s.status = 'trialing'
  );
  reddit_paid := (
    SELECT count(*)::bigint
    FROM public.profiles p
    JOIN public.subscriptions s ON s.user_id = p.id
    WHERE lower(COALESCE(p.signup_attribution->>'utm_source', '')) = 'reddit'
      AND s.status = 'active'
      AND s.plan IN ('pro', 'enterprise')
  );
  RETURN NEXT;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('reddit-opportunity-finder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reddit-opportunity-finder',
  '15 */6 * * *',
  $$
    SELECT extensions.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
             || '/functions/v1/reddit-opportunity-search',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
          'anon'
        )
      )::text,
      content := '{"scheduled":true}',
      content_type := 'application/json'
    );
  $$
);

NOTIFY pgrst, 'reload schema';
