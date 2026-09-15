-- First-party marketing pageviews (SEO / ChatGPT search). No PII.

CREATE TABLE IF NOT EXISTS public.marketing_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer_host text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_visits_created_idx ON public.marketing_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_visits_source_idx ON public.marketing_visits (utm_source, path);

ALTER TABLE public.marketing_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_visits_insert_anon ON public.marketing_visits;
CREATE POLICY marketing_visits_insert_anon
  ON public.marketing_visits
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS marketing_visits_no_select ON public.marketing_visits;
-- Selects go through staff RPC only.

CREATE OR REPLACE FUNCTION public.marketing_visit_report()
RETURNS TABLE (
  path text,
  utm_source text,
  visits bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.path,
    COALESCE(v.utm_source, '(none)') AS utm_source,
    count(*)::bigint AS visits
  FROM public.marketing_visits v
  WHERE v.created_at > now() - interval '90 days'
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND lower(u.email) IN ('support@pinonit.com')
    )
  GROUP BY v.path, COALESCE(v.utm_source, '(none)')
  ORDER BY visits DESC;
$$;

REVOKE ALL ON FUNCTION public.marketing_visit_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_visit_report() TO authenticated;

NOTIFY pgrst, 'reload schema';
