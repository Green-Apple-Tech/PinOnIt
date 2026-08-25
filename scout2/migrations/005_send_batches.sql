-- Ramp send batches for GMass daily warmup exports.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.scout2_send_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number integer NOT NULL,
  send_date date NOT NULL,
  niche text NOT NULL,
  target_count integer NOT NULL,
  actual_count integer NOT NULL DEFAULT 0,
  tab_name text NOT NULL,
  sheet_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (niche, send_date)
);

CREATE INDEX IF NOT EXISTS scout2_send_batches_niche_day_idx
  ON public.scout2_send_batches (niche, day_number);
CREATE INDEX IF NOT EXISTS scout2_send_batches_send_date_idx
  ON public.scout2_send_batches (send_date DESC);

ALTER TABLE public.scout2_send_batches ENABLE ROW LEVEL SECURITY;
