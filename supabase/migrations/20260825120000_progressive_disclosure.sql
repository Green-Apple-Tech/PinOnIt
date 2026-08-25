-- Progressive disclosure: simple/advanced UI, revealed tools, business type.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_mode text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS revealed_tools text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS business_type text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_ui_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ui_mode_check
  CHECK (ui_mode IN ('simple', 'advanced'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_business_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_type_check
  CHECK (
    business_type IS NULL OR business_type IN (
      'mobile_trade',
      'personal_services',
      'professional_services',
      'other'
    )
  );

COMMENT ON COLUMN public.profiles.ui_mode IS 'simple = progressive disclosure; advanced = show all tools';
COMMENT ON COLUMN public.profiles.revealed_tools IS 'Tool ids permanently surfaced in the sidebar after a trigger fires';
COMMENT ON COLUMN public.profiles.business_type IS 'Onboarding work type used to preset event types, reminders, and revealed tools';
