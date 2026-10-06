-- Internal Reddit Opportunity Finder. Staff read/update. Search writes with the service role.
-- No automated posting.

CREATE OR REPLACE FUNCTION public.is_pinonit_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) IN ('support@pinonit.com', 'stebbins.peter@gmail.com')
  );
$$;

REVOKE ALL ON FUNCTION public.is_pinonit_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pinonit_staff() TO authenticated;

CREATE TABLE IF NOT EXISTS public.reddit_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_fullname text NOT NULL UNIQUE,
  title text NOT NULL,
  subreddit text NOT NULL,
  permalink text NOT NULL,
  author text,
  posted_at timestamptz,
  snippet text,
  search_query text NOT NULL,
  industry text,
  feature text,
  problem text NOT NULL,
  why_relevant text NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  mention text NOT NULL CHECK (mention IN ('yes', 'maybe', 'no')),
  mention_reason text NOT NULL,
  suggested_response text NOT NULL,
  high_seo_value boolean NOT NULL DEFAULT false,
  rules_note text,
  num_comments integer,
  reddit_score integer,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'review', 'approved', 'responded', 'skip')),
  responded_at timestamptz,
  outcome_upvotes integer,
  outcome_replies integer,
  outcome_signups integer,
  outcome_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reddit_opportunities_score_idx
  ON public.reddit_opportunities (score DESC, posted_at DESC);
CREATE INDEX IF NOT EXISTS reddit_opportunities_status_idx
  ON public.reddit_opportunities (status, score DESC);

ALTER TABLE public.reddit_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reddit_opportunities_staff ON public.reddit_opportunities;
CREATE POLICY reddit_opportunities_staff
  ON public.reddit_opportunities
  FOR ALL
  TO authenticated
  USING (public.is_pinonit_staff())
  WITH CHECK (public.is_pinonit_staff());

CREATE TABLE IF NOT EXISTS public.reddit_subreddit_rules (
  subreddit text PRIMARY KEY,
  rules_text text NOT NULL DEFAULT '',
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reddit_subreddit_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reddit_subreddit_rules_staff ON public.reddit_subreddit_rules;
CREATE POLICY reddit_subreddit_rules_staff
  ON public.reddit_subreddit_rules
  FOR SELECT
  TO authenticated
  USING (public.is_pinonit_staff());

CREATE TABLE IF NOT EXISTS public.reddit_search_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by uuid,
  queries_run integer NOT NULL DEFAULT 0,
  threads_found integer NOT NULL DEFAULT 0,
  threads_saved integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reddit_search_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reddit_search_runs_staff ON public.reddit_search_runs;
CREATE POLICY reddit_search_runs_staff
  ON public.reddit_search_runs
  FOR SELECT
  TO authenticated
  USING (public.is_pinonit_staff());

CREATE TABLE IF NOT EXISTS public.reddit_finder_cursor (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_query_index integer NOT NULL DEFAULT 0
);

INSERT INTO public.reddit_finder_cursor (id, next_query_index)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.reddit_finder_cursor ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reddit_learning_summary()
RETURNS TABLE (
  reddit_visits bigint,
  reddit_signups bigint
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
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reddit_learning_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reddit_learning_summary() TO authenticated;

NOTIFY pgrst, 'reload schema';
