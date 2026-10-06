-- Fallback discovery stores the same opportunities as the Reddit API path.
-- opened = the reply was copied and the thread was opened, and is waiting for you to post.

ALTER TABLE public.reddit_opportunities DROP CONSTRAINT IF EXISTS reddit_opportunities_status_check;
ALTER TABLE public.reddit_opportunities
  ADD CONSTRAINT reddit_opportunities_status_check
  CHECK (status IN ('new', 'review', 'approved', 'responded', 'skip', 'opened'));

ALTER TABLE public.reddit_opportunities
  ADD COLUMN IF NOT EXISTS customer_opportunity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_opportunity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_mode text NOT NULL DEFAULT 'api',
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS search_rank integer;

ALTER TABLE public.reddit_finder_settings
  ADD COLUMN IF NOT EXISTS last_digest_on date;
