-- Directory scrapers (chamber / thumbtack / bark) + night session.
-- Do not touch public.leads (website capture).

ALTER TABLE public.scout2_leads
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS calendly_detected text;

UPDATE public.scout2_leads
SET calendly_detected = 'yes'
WHERE calendly_detected IS NULL;

UPDATE public.scout2_leads
SET source = 'serp'
WHERE source IS NULL OR btrim(source) = '';

NOTIFY pgrst, 'reload schema';
