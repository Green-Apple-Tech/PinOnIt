-- Public SMS opt-in records (Twilio/TCR verifiable CTA on /sms-consent)
CREATE TABLE IF NOT EXISTS public.sms_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  phone text NOT NULL,
  consent boolean NOT NULL DEFAULT false,
  source text DEFAULT 'sms_consent_page',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_optins ENABLE ROW LEVEL SECURITY;

-- Anyone (including logged-out visitors) may submit an opt-in, but only with
-- explicit consent and a non-empty phone number. No SELECT/UPDATE/DELETE
-- policies are defined, so the data is not publicly readable.
DROP POLICY IF EXISTS "Public can submit SMS opt-in" ON public.sms_optins;
CREATE POLICY "Public can submit SMS opt-in"
  ON public.sms_optins
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (consent = true AND length(trim(phone)) > 0);

CREATE INDEX IF NOT EXISTS sms_optins_created_at_idx ON public.sms_optins(created_at DESC);
