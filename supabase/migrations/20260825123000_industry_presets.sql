-- Industry presets: specific business types, default tax, quote line starters, work region.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_tax_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_line_defaults jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS business_region text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_business_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_type_check
  CHECK (
    business_type IS NULL OR business_type IN (
      'landscaper',
      'plumber',
      'dentist',
      'real_estate',
      'mobile_trade',
      'personal_services',
      'professional_services',
      'other'
    )
  );

COMMENT ON COLUMN public.profiles.default_tax_percent IS 'Starting tax % on new quotes; host can change per quote';
COMMENT ON COLUMN public.profiles.quote_line_defaults IS 'Starter line items for Quote/Invoice, from onboarding industry';
COMMENT ON COLUMN public.profiles.business_region IS 'US state code used to seed default_tax_percent';
