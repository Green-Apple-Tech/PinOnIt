-- Scoring / fingerprint columns. Safe to re-run.

ALTER TABLE public.scout2_leads
  ADD COLUMN IF NOT EXISTS scheduler_name text,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS email_provider text,
  ADD COLUMN IF NOT EXISTS zoom_links boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teams_links boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS practice_type text,
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS segment text;

CREATE INDEX IF NOT EXISTS scout2_leads_segment_idx ON public.scout2_leads (segment);
CREATE INDEX IF NOT EXISTS scout2_leads_score_idx ON public.scout2_leads (lead_score);
