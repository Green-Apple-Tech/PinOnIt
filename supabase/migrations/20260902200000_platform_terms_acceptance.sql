-- Record when a user explicitly accepts platform Terms + Privacy (signup / trial).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform_terms_version text;

COMMENT ON COLUMN public.profiles.platform_terms_accepted_at IS
  'When the user agreed to PinOnIt Terms of Service and Privacy Policy.';
COMMENT ON COLUMN public.profiles.platform_terms_version IS
  'Terms version string at time of acceptance (see platformLegal.ts).';
