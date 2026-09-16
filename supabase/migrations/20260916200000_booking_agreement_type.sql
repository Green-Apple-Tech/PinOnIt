-- Guest booking agreement is not NDA-only: host picks waiver / NDA / contract / approval / other.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS booking_agreement_type text,
  ADD COLUMN IF NOT EXISTS booking_agreement_text text;

COMMENT ON COLUMN public.services.booking_agreement_type IS
  'When require_nda is true: waiver, nda, contract, approval, or other.';

COMMENT ON COLUMN public.services.booking_agreement_text IS
  'Agreement body shown on the public booking form when require_nda is true.';
