-- Link exported leads to ramp send batches.

ALTER TABLE public.scout2_leads
  ADD COLUMN IF NOT EXISTS send_batch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scout2_leads_send_batch_fkey'
  ) THEN
    ALTER TABLE public.scout2_leads
      ADD CONSTRAINT scout2_leads_send_batch_fkey
      FOREIGN KEY (send_batch_id) REFERENCES public.scout2_send_batches (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS scout2_leads_send_batch_idx
  ON public.scout2_leads (send_batch_id);
