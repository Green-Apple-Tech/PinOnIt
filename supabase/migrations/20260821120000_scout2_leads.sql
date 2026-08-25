-- Scout2 pipeline table. Separate from public.leads (PinOnIt website lead capture).

CREATE TABLE IF NOT EXISTS public.scout2_leads (
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

CREATE INDEX IF NOT EXISTS scout2_leads_status_idx ON public.scout2_leads (status);
CREATE INDEX IF NOT EXISTS scout2_leads_niche_idx ON public.scout2_leads (niche);
CREATE INDEX IF NOT EXISTS scout2_leads_source_idx ON public.scout2_leads (source);

ALTER TABLE public.scout2_leads ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no anon policies (internal pipeline).
NOTIFY pgrst, 'reload schema';
