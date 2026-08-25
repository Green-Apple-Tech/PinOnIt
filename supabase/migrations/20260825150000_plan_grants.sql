-- Complimentary Pro for emails you choose. Stripe cannot take it away.
-- Add a row here, then they get Pro on signup (or immediately if they already have an account).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_override text
  CHECK (plan_override IS NULL OR plan_override = 'pro');

CREATE TABLE IF NOT EXISTS public.plan_grants (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.normalize_grant_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_grant_email ON public.plan_grants;
CREATE TRIGGER trg_normalize_grant_email
  BEFORE INSERT OR UPDATE OF email ON public.plan_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_grant_email();

CREATE OR REPLACE FUNCTION public.sync_plan_grant_to_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET plan_override = NULL
    WHERE lower(email) = OLD.email;
    RETURN OLD;
  END IF;
  UPDATE public.profiles
  SET plan_override = 'pro',
      plan = 'pro'
  WHERE lower(email) = NEW.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_plan_grant_to_profiles ON public.plan_grants;
CREATE TRIGGER trg_sync_plan_grant_to_profiles
  AFTER INSERT OR UPDATE OF email ON public.plan_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_plan_grant_to_profiles();

DROP TRIGGER IF EXISTS trg_clear_plan_grant_on_delete ON public.plan_grants;
CREATE TRIGGER trg_clear_plan_grant_on_delete
  AFTER DELETE ON public.plan_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_plan_grant_to_profiles();

CREATE OR REPLACE FUNCTION public.apply_plan_grant_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.plan_grants g WHERE g.email = lower(trim(NEW.email))
  ) THEN
    NEW.plan_override := 'pro';
    NEW.plan := 'pro';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_plan_grant_on_profile ON public.profiles;
CREATE TRIGGER trg_apply_plan_grant_on_profile
  BEFORE INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_plan_grant_on_profile();

CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.plan := OLD.plan;
    NEW.plan_override := OLD.plan_override;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.gmail_access_token := OLD.gmail_access_token;
    NEW.gmail_refresh_token := OLD.gmail_refresh_token;
  END IF;
  -- Complimentary Pro stays Pro even if Stripe writes free.
  IF NEW.plan_override = 'pro' THEN
    NEW.plan := 'pro';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW public.public_host_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  slug,
  full_name,
  bio,
  avatar_url,
  brand_color,
  timezone,
  booking_page_header,
  paid_booking_theme,
  paid_booking_settings,
  global_require_terms,
  global_terms_text,
  calendar_conflict_settings,
  CASE WHEN plan_override = 'pro' THEN 'pro' ELSE plan END AS plan
FROM public.profiles
WHERE slug IS NOT NULL;

GRANT SELECT ON public.public_host_profiles TO anon, authenticated;

INSERT INTO public.plan_grants (email, note)
VALUES ('carole@propertiesofmiami.com', 'Complimentary Pro')
ON CONFLICT (email) DO NOTHING;
