-- Event-type guest agreement can be a named PDF from the host library (same files as Send Docs).
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS booking_agreement_file_id uuid REFERENCES public.host_document_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_agreement_file_path text,
  ADD COLUMN IF NOT EXISTS booking_agreement_file_name text;

COMMENT ON COLUMN public.services.booking_agreement_file_id IS
  'Optional host_document_files row used as the booking agreement instead of pasted text.';
COMMENT ON COLUMN public.services.booking_agreement_file_path IS
  'Public document-files storage path so guests can open the PDF without host RLS.';
COMMENT ON COLUMN public.services.booking_agreement_file_name IS
  'Display name for the PDF shown on the public booking form.';

NOTIFY pgrst, 'reload schema';
