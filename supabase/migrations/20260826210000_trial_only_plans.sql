-- Trial-only billing: plan enum ('trial','pro','expired'). No free tier.

-- 1) Drop legacy CHECK constraints (names vary by migration history)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- 2) Migrate existing rows
UPDATE public.profiles SET plan = 'expired' WHERE plan IN ('free', 'enterprise');
UPDATE public.profiles SET plan = 'pro' WHERE plan_override = 'pro';

UPDATE public.subscriptions SET plan = 'expired' WHERE plan IN ('free', 'enterprise');
UPDATE public.subscriptions SET plan = 'trial'
WHERE status = 'trialing' AND plan NOT IN ('pro');
UPDATE public.subscriptions SET plan = 'pro'
WHERE status IN ('active', 'past_due') AND plan NOT IN ('trial', 'expired');

-- Expire local trials that already passed end date
UPDATE public.subscriptions
SET plan = 'expired', status = 'canceled'
WHERE plan = 'trial'
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at < now()
  AND (stripe_customer_id IS NULL OR stripe_customer_id LIKE 'trial_%');

UPDATE public.profiles p
SET plan = 'expired'
FROM public.subscriptions s
WHERE s.user_id = p.id
  AND s.plan = 'expired'
  AND p.plan_override IS NULL
  AND p.plan <> 'expired';

-- 3) New constraints + defaults
ALTER TABLE public.profiles
  ALTER COLUMN plan SET DEFAULT 'trial';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('trial', 'pro', 'expired'));

ALTER TABLE public.subscriptions
  ALTER COLUMN plan SET DEFAULT 'trial';

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('trial', 'pro', 'expired'));

-- 4) Host accepts bookings / sends reminders when trial or pro (or complimentary override)
CREATE OR REPLACE FUNCTION public.host_plan_is_active(p_host_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.subscriptions s ON s.user_id = p.id
    WHERE p.id = p_host_id
      AND (
        p.plan_override = 'pro'
        OR p.plan IN ('trial', 'pro')
        OR s.plan IN ('trial', 'pro')
      )
      AND NOT (
        COALESCE(s.plan, p.plan) = 'trial'
        AND s.trial_ends_at IS NOT NULL
        AND s.trial_ends_at < now()
        AND (s.stripe_customer_id IS NULL OR s.stripe_customer_id LIKE 'trial_%')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.host_plan_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_plan_is_active(uuid) TO anon, authenticated, service_role;

-- 5) Expire stale local trials (called from cron + send-reminder)
CREATE OR REPLACE FUNCTION public.expire_stale_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.subscriptions
  SET plan = 'expired', status = 'canceled'
  WHERE plan = 'trial'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now()
    AND (stripe_customer_id IS NULL OR stripe_customer_id LIKE 'trial_%');

  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.profiles p
  SET plan = 'expired'
  FROM public.subscriptions s
  WHERE s.user_id = p.id
    AND s.plan = 'expired'
    AND p.plan_override IS NULL
    AND p.plan IN ('trial', 'pro');

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_trials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_trials() TO service_role;

-- 6) Signup: 14-day trial on every new account
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_base text;
  v_slug text;
  v_attempt int := 0;
  v_full_name text;
  v_trial_end timestamptz := now() + interval '14 days';
BEGIN
  v_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );

  v_base := lower(regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);

  IF length(v_base) < 3 THEN
    v_base := 'user-' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE p.slug = v_slug) LOOP
    v_attempt := v_attempt + 1;
    v_slug := v_base || v_attempt::text;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    slug,
    plan,
    default_reminder_channel,
    voice_reminder_enabled
  )
  VALUES (
    NEW.id,
    v_email,
    v_full_name,
    v_slug,
    'trial',
    'email',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at, trial_source, stripe_customer_id)
  VALUES (NEW.id, 'trial', 'trialing', v_trial_end, 'signup', 'trial_local')
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.attribute_scout2_lead_on_signup(NEW.id, v_email);

  RETURN NEW;
END;
$$;

-- 7) Local trial RPC (Billing re-activation / Calendly fallback)
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
      AND status IN ('active', 'trialing', 'past_due')
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at, trial_source, stripe_customer_id)
  VALUES (uid, 'trial', 'trialing', iso_end, 'free_trial', 'trial_local')
  ON CONFLICT (user_id) DO UPDATE
  SET
    plan = CASE
      WHEN public.subscriptions.stripe_customer_id LIKE 'cus_%'
        AND public.subscriptions.status IN ('active', 'trialing', 'past_due')
      THEN public.subscriptions.plan
      ELSE 'trial'
    END,
    status = CASE
      WHEN public.subscriptions.stripe_customer_id LIKE 'cus_%'
        AND public.subscriptions.status IN ('active', 'trialing', 'past_due')
      THEN public.subscriptions.status
      ELSE 'trialing'
    END,
    trial_ends_at = CASE
      WHEN public.subscriptions.stripe_customer_id LIKE 'cus_%'
        AND public.subscriptions.status IN ('active', 'trialing', 'past_due')
      THEN public.subscriptions.trial_ends_at
      ELSE iso_end
    END,
    trial_source = CASE
      WHEN public.subscriptions.stripe_customer_id LIKE 'cus_%'
        AND public.subscriptions.status IN ('active', 'trialing', 'past_due')
      THEN public.subscriptions.trial_source
      ELSE 'free_trial'
    END;

  UPDATE public.profiles
  SET plan = 'trial'
  WHERE id = uid
    AND plan_override IS NULL;
END;
$$;

-- 8) Public host view
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

-- 9) Block new bookings for expired hosts
DROP POLICY IF EXISTS "Guests can create bookings for active services" ON public.bookings;

CREATE POLICY "Guests can create bookings for active services"
  ON public.bookings FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.host_plan_is_active(host_id)
    AND EXISTS (
      SELECT 1 FROM public.services s
      JOIN public.profiles p ON p.id = s.host_id
      WHERE s.id = service_id
        AND s.host_id = host_id
        AND s.is_active = true
        AND p.slug IS NOT NULL
    )
  );

-- 10) Cron: expire trials every 15 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('expire-stale-trials');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'expire-stale-trials',
  '*/15 * * * *',
  $$SELECT public.expire_stale_trials();$$
);
