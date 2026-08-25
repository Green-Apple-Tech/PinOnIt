-- Directory scrapers (chamber / thumbtack / bark) + night session.
-- Safe to re-run. Does not drop or recreate scout2_leads.

ALTER TABLE public.scout2_leads
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS calendly_detected text;

-- Existing pipeline leads were Places/seedlist Calendly finds.
UPDATE public.scout2_leads
SET calendly_detected = 'yes'
WHERE calendly_detected IS NULL;

UPDATE public.scout2_leads
SET source = 'serp'
WHERE source IS NULL OR btrim(source) = '';
