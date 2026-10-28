-- Zip Owners Pro. A verified subscriber gets Pro with no extra trial.
-- Does not convert complimentary or creator grants.
-- Does not change a Stripe subscription, including a card trial.
-- Applying this file grants nobody until zip-owners-sync is called.

ALTER TABLE public.plan_grants
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'complimentary';

ALTER TABLE public.plan_grants
  ADD COLUMN IF NOT EXISTS zip_owners_subscriber_id text;

ALTER TABLE public.plan_grants DROP CONSTRAINT IF EXISTS plan_grants_kind_check;
ALTER TABLE public.plan_grants
  ADD CONSTRAINT plan_grants_kind_check
  CHECK (kind IN ('complimentary', 'creator', 'zip_owners'));

CREATE UNIQUE INDEX IF NOT EXISTS plan_grants_zip_owners_subscriber_id_key
  ON public.plan_grants (zip_owners_subscriber_id)
  WHERE zip_owners_subscriber_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_zip_owners_membership(
  p_email text,
  p_subscriber_id text,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(COALESCE(p_email, '')));
  v_subscriber text := left(trim(COALESCE(p_subscriber_id, '')), 80);
  v_kind text;
BEGIN
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(v_email) > 320 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;
  IF v_subscriber = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_subscriber');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.subscriptions s ON s.user_id = p.id
    WHERE lower(p.email) = v_email
      AND s.stripe_customer_id LIKE 'cus_%'
      AND s.stripe_subscription_id IS NOT NULL
      AND s.status IN ('active', 'trialing', 'past_due')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'paid_subscription');
  END IF;

  SELECT g.kind INTO v_kind
  FROM public.plan_grants g
  WHERE g.email = v_email;

  IF v_kind IN ('complimentary', 'creator') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'existing_grant');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_grants g
    WHERE g.zip_owners_subscriber_id = v_subscriber
      AND g.email <> v_email
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscriber_taken');
  END IF;

  IF NOT COALESCE(p_active, false) THEN
    DELETE FROM public.plan_grants
    WHERE email = v_email AND kind = 'zip_owners';

    UPDATE public.subscriptions s
    SET plan = 'expired',
        status = 'canceled',
        trial_ends_at = now()
    FROM public.profiles p
    WHERE p.id = s.user_id
      AND lower(p.email) = v_email
      AND s.trial_source = 'zip_owners'
      AND s.stripe_subscription_id IS NULL
      AND COALESCE(s.stripe_customer_id, '') NOT LIKE 'cus_%';

    UPDATE public.profiles
    SET plan = 'expired'
    WHERE lower(email) = v_email
      AND plan_override IS DISTINCT FROM 'pro';

    RETURN jsonb_build_object('ok', true, 'action', 'end');
  END IF;

  INSERT INTO public.plan_grants (email, note, kind, zip_owners_subscriber_id)
  VALUES (v_email, 'Zip Owners', 'zip_owners', v_subscriber)
  ON CONFLICT (email) DO UPDATE
  SET note = EXCLUDED.note,
      kind = 'zip_owners',
      zip_owners_subscriber_id = EXCLUDED.zip_owners_subscriber_id
  WHERE public.plan_grants.kind = 'zip_owners';

  -- The grant is the Pro. End a no-card local trial so the days do not stack.
  UPDATE public.subscriptions s
  SET plan = 'pro',
      status = 'active',
      trial_ends_at = now(),
      trial_source = 'zip_owners'
  FROM public.profiles p
  WHERE p.id = s.user_id
    AND lower(p.email) = v_email
    AND s.stripe_subscription_id IS NULL
    AND COALESCE(s.stripe_customer_id, '') NOT LIKE 'cus_%'
    AND COALESCE(s.trial_source, '') IN ('local', 'signup', 'free_trial', 'zip_owners');

  RETURN jsonb_build_object('ok', true, 'action', 'grant');
END;
$$;

REVOKE ALL ON FUNCTION public.sync_zip_owners_membership(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_zip_owners_membership(text, text, boolean) TO service_role;

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
    SELECT 1
    FROM public.profiles p
    JOIN public.plan_grants g ON g.email = lower(p.email)
    WHERE p.id = uid AND g.kind = 'zip_owners'
  ) THEN
    RETURN;
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
