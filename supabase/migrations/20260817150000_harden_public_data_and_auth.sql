-- Harden public profile reads, freeze privileged profile columns, local trial RPC,
-- tighter single-use link SELECT, and slower reminder cron.

-- 1) Public host view (no tokens, phones, Stripe IDs)
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
  plan
FROM public.profiles
WHERE slug IS NOT NULL;

GRANT SELECT ON public.public_host_profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read profiles by slug" ON public.profiles;

-- 2) Clients cannot change plan, Stripe customer, or Gmail tokens.
-- Not SECURITY DEFINER: current_user stays authenticated/anon for client writes,
-- while service_role and start_local_trial (owner) can still update plan.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.plan := OLD.plan;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.gmail_access_token := OLD.gmail_access_token;
    NEW.gmail_refresh_token := OLD.gmail_refresh_token;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_privileged_profile_columns ON public.profiles;
CREATE TRIGGER protect_privileged_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_privileged_profile_columns();

-- 3) Local trial without letting the client set plan
CREATE OR REPLACE FUNCTION public.start_local_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  iso_end timestamptz := now() + interval '14 days';
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = uid
      AND stripe_customer_id LIKE 'cus_%'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at, trial_source, stripe_customer_id)
  VALUES (uid, 'pro', 'trialing', iso_end, 'free_trial', 'trial_local')
  ON CONFLICT (user_id) DO UPDATE
  SET
    plan = CASE
      WHEN public.subscriptions.stripe_customer_id LIKE 'cus_%' THEN public.subscriptions.plan
      ELSE 'pro'
    END,
    status = CASE
      WHEN public.subscriptions.stripe_customer_id LIKE 'cus_%' THEN public.subscriptions.status
      ELSE 'trialing'
    END,
    trial_ends_at = CASE
      WHEN public.subscriptions.stripe_customer_id LIKE 'cus_%' THEN public.subscriptions.trial_ends_at
      ELSE iso_end
    END,
    trial_source = CASE
      WHEN public.subscriptions.stripe_customer_id LIKE 'cus_%' THEN public.subscriptions.trial_source
      ELSE 'free_trial'
    END;

  UPDATE public.profiles
  SET plan = 'pro'
  WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.start_local_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_local_trial() TO authenticated;

-- 4) Single-use links: stop listing every token to anon
DROP POLICY IF EXISTS "Anyone can read single use link by token" ON public.single_use_links;

CREATE OR REPLACE FUNCTION public.get_single_use_link(p_token text)
RETURNS TABLE (
  id uuid,
  host_id uuid,
  service_id uuid,
  token text,
  used boolean,
  used_at timestamptz,
  expires_at timestamptz,
  booking_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, host_id, service_id, token, used, used_at, expires_at, booking_id
  FROM public.single_use_links
  WHERE token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_single_use_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_single_use_link(text) TO anon, authenticated;

-- 5) Reminder cron every 5 minutes (was every minute)
DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-reminders',
  '*/5 * * * *',
  $$
    SELECT extensions.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
             || '/functions/v1/send-reminder',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1
        )
      )::text,
      content := '{"dispatch_event_overrides":true,"dispatch_scheduled":true}',
      content_type := 'application/json'
    );
  $$
);
