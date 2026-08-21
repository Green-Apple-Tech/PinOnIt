-- Scout2 leads table (run in Supabase SQL editor or via migration)
-- Project: PinOnIt / adlusgtlwgcfyxgeoias (or a dedicated scout project)

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  email text,
  email_rank integer,
  niche text,
  employees_bucket text CHECK (
    employees_bucket IS NULL
    OR employees_bucket IN ('1', '2-10', '11+')
  ),
  calendly_url text,
  source text,
  mx_valid boolean,
  status text NOT NULL DEFAULT 'discovered',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads (status);
CREATE INDEX IF NOT EXISTS leads_niche_idx ON public.leads (niche);
CREATE INDEX IF NOT EXISTS leads_source_idx ON public.leads (source);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no anon policies on purpose (internal pipeline).
