-- Once-per-account acknowledgment that Sign-by-Text is for single-signature business docs only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sign_by_text_scope_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.sign_by_text_scope_accepted_at IS
  'When the host acknowledged Sign-by-Text scope (single-signature business docs; excluded instrument types).';

NOTIFY pgrst, 'reload schema';
