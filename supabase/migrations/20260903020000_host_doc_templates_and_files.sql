-- Per-host Doc Center template overrides + named reusable PDFs.

CREATE TABLE IF NOT EXISTS public.host_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  document_type text NOT NULL,
  full_text text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT host_document_templates_type_check CHECK (document_type IN (
    'nda', 'contract', 'waiver', 'quote', 'invoice', 'receipt'
  )),
  CONSTRAINT host_document_templates_host_type_unique UNIQUE (host_id, document_type)
);

CREATE INDEX IF NOT EXISTS host_document_templates_host_idx
  ON public.host_document_templates (host_id);

ALTER TABLE public.host_document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own document templates" ON public.host_document_templates;
CREATE POLICY "Hosts manage own document templates"
  ON public.host_document_templates
  FOR ALL
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Backfill waiver overrides from profiles.waiver_template when present.
INSERT INTO public.host_document_templates (host_id, document_type, full_text)
SELECT p.id, 'waiver', p.waiver_template
FROM public.profiles p
WHERE p.waiver_template IS NOT NULL
  AND NULLIF(btrim(p.waiver_template), '') IS NOT NULL
ON CONFLICT (host_id, document_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.host_document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT host_document_files_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS host_document_files_host_idx
  ON public.host_document_files (host_id, created_at DESC);

ALTER TABLE public.host_document_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own document files" ON public.host_document_files;
CREATE POLICY "Hosts manage own document files"
  ON public.host_document_files
  FOR ALL
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Align storage bucket limit with 5MB product rule (PDF-only already set).
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'document-files';

NOTIFY pgrst, 'reload schema';
