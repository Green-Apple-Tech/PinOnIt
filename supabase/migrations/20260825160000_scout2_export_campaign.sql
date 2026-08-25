-- Scout2 GMass campaign tracking (do not touch public.leads).

ALTER TABLE public.scout2_leads
  ADD COLUMN IF NOT EXISTS page_title text,
  ADD COLUMN IF NOT EXISTS exported_at timestamptz,
  ADD COLUMN IF NOT EXISTS export_batch uuid,
  ADD COLUMN IF NOT EXISTS sheet_tab text;

CREATE TABLE IF NOT EXISTS public.scout2_export_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_label text NOT NULL,
  niche text,
  row_count integer NOT NULL DEFAULT 0,
  sheet_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scout2_export_batches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS scout2_leads_email_idx
  ON public.scout2_leads (lower(email));
CREATE INDEX IF NOT EXISTS scout2_leads_export_batch_idx
  ON public.scout2_leads (export_batch);
CREATE INDEX IF NOT EXISTS scout2_export_batches_created_idx
  ON public.scout2_export_batches (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scout2_leads_export_batch_fkey'
  ) THEN
    ALTER TABLE public.scout2_leads
      ADD CONSTRAINT scout2_leads_export_batch_fkey
      FOREIGN KEY (export_batch) REFERENCES public.scout2_export_batches (id);
  END IF;
END $$;
