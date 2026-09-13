-- Soft-archive named PDF templates so hosts can hide unused uploads without deleting the file.

ALTER TABLE public.host_document_files
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS host_document_files_host_active_idx
  ON public.host_document_files (host_id, created_at DESC)
  WHERE archived_at IS NULL;

NOTIFY pgrst, 'reload schema';
