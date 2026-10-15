-- Creator partner program (draft). Not the $1 customer referral program.
-- Do not apply until the proposed settings are approved.
-- Applying this file does not grant complimentary access and does not pay anyone.
-- Existing plan_grants rows stay kind = complimentary and are not message-capped.

ALTER TABLE public.plan_grants
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'complimentary'
    CHECK (kind IN ('complimentary', 'creator')),
  ADD COLUMN IF NOT EXISTS creator_id uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS outbound_message_limit integer,
  ADD COLUMN IF NOT EXISTS outbound_messages_used integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.creator_program_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  commission_bps integer NOT NULL DEFAULT 4000,
  hold_days integer NOT NULL DEFAULT 30,
  attribution_days integer NOT NULL DEFAULT 30,
  proposed_grant_duration_days integer NOT NULL DEFAULT 90,
  proposed_outbound_message_limit integer NOT NULL DEFAULT 200,
  rounding text NOT NULL DEFAULT 'half-up',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.creator_program_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.creator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  profile_url text NOT NULL,
  topics text NOT NULL,
  audience text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

CREATE TABLE IF NOT EXISTS public.creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.creator_applications(id),
  user_id uuid,
  email text NOT NULL,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'disabled')),
  commission_eligible boolean NOT NULL DEFAULT false,
  terms_accepted_version integer,
  terms_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS creators_email_idx ON public.creators (lower(email));

CREATE TABLE IF NOT EXISTS public.creator_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id),
  referred_user_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  first_touch_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id),
  attribution_id uuid REFERENCES public.creator_attributions(id),
  stripe_event_id text NOT NULL UNIQUE,
  stripe_invoice_id text NOT NULL,
  stripe_refund_id text,
  kind text NOT NULL CHECK (kind IN ('earn', 'refund', 'dispute', 'adjustment')),
  basis_cents integer NOT NULL,
  amount_cents integer NOT NULL,
  rate_bps integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'payable', 'paid', 'void')),
  reason text,
  available_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_commission_earn_invoice_idx
  ON public.creator_commission_entries (stripe_invoice_id)
  WHERE kind = 'earn';

CREATE UNIQUE INDEX IF NOT EXISTS creator_commission_refund_idx
  ON public.creator_commission_entries (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  paid_on date NOT NULL,
  reference text NOT NULL CHECK (length(btrim(reference)) > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.creator_payout_items (
  payout_id uuid NOT NULL REFERENCES public.creator_payouts(id) ON DELETE RESTRICT,
  entry_id uuid NOT NULL UNIQUE REFERENCES public.creator_commission_entries(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  PRIMARY KEY (payout_id, entry_id)
);

CREATE TABLE IF NOT EXISTS public.creator_terms_versions (
  version integer PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  published_at timestamptz
);

INSERT INTO public.creator_terms_versions (version, title, body, published_at)
VALUES (
  1,
  'PinOnIt creator partner terms (draft)',
  'Unpublished draft. Commissions stay off until a creator accepts a published version.',
  NULL
)
ON CONFLICT (version) DO NOTHING;

ALTER TABLE public.creator_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_terms_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_settings_staff_read ON public.creator_program_settings;
CREATE POLICY creator_settings_staff_read ON public.creator_program_settings
  FOR SELECT TO authenticated USING (public.is_pinonit_staff());

DROP POLICY IF EXISTS creator_applications_public_insert ON public.creator_applications;
CREATE POLICY creator_applications_public_insert ON public.creator_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS creator_applications_staff ON public.creator_applications;
CREATE POLICY creator_applications_staff ON public.creator_applications
  FOR ALL TO authenticated
  USING (public.is_pinonit_staff())
  WITH CHECK (public.is_pinonit_staff());

DROP POLICY IF EXISTS creators_own_read ON public.creators;
CREATE POLICY creators_own_read ON public.creators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS creators_staff ON public.creators;
CREATE POLICY creators_staff ON public.creators
  FOR ALL TO authenticated
  USING (public.is_pinonit_staff())
  WITH CHECK (public.is_pinonit_staff());

DROP POLICY IF EXISTS creator_attributions_own ON public.creator_attributions;
CREATE POLICY creator_attributions_own ON public.creator_attributions
  FOR SELECT TO authenticated
  USING (
    referred_user_id = auth.uid()
    OR creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
    OR public.is_pinonit_staff()
  );

DROP POLICY IF EXISTS creator_entries_own ON public.creator_commission_entries;
CREATE POLICY creator_entries_own ON public.creator_commission_entries
  FOR SELECT TO authenticated
  USING (
    creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
    OR public.is_pinonit_staff()
  );

DROP POLICY IF EXISTS creator_payouts_own ON public.creator_payouts;
CREATE POLICY creator_payouts_own ON public.creator_payouts
  FOR SELECT TO authenticated
  USING (
    creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
    OR public.is_pinonit_staff()
  );

DROP POLICY IF EXISTS creator_payout_items_own ON public.creator_payout_items;
CREATE POLICY creator_payout_items_own ON public.creator_payout_items
  FOR SELECT TO authenticated
  USING (
    payout_id IN (
      SELECT id FROM public.creator_payouts
      WHERE creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
         OR public.is_pinonit_staff()
    )
  );

DROP POLICY IF EXISTS creator_terms_staff_read ON public.creator_terms_versions;
CREATE POLICY creator_terms_staff_read ON public.creator_terms_versions
  FOR SELECT TO authenticated USING (public.is_pinonit_staff() OR published_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.creator_commission_cents(basis integer, bps integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN basis IS NULL OR basis <= 0 OR bps IS NULL OR bps <= 0 THEN 0
    ELSE ((basis::bigint * bps + 5000) / 10000)::integer
  END;
$$;

CREATE OR REPLACE FUNCTION public.claim_creator_attribution(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_creator public.creators%ROWTYPE;
  v_existing public.creator_attributions%ROWTYPE;
  v_days integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;
  SELECT lower(email) INTO v_email FROM public.profiles WHERE id = v_user;
  SELECT * INTO v_creator FROM public.creators
    WHERE code = lower(trim(p_code)) AND status = 'approved';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;
  IF v_creator.user_id = v_user OR lower(v_creator.email) = coalesce(v_email, '') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;
  -- Customer referral rewards stay open through 2026-11-15 04:59:59.999+00 (end of Nov 14, 2026 US Eastern).
  IF now() <= '2026-11-15T04:59:59.999Z'::timestamptz
     AND (
       EXISTS (SELECT 1 FROM public.referrals r WHERE r.referred_user_id = v_user)
       OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_user AND p.referred_by IS NOT NULL)
     ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'customer_referral_present');
  END IF;
  SELECT attribution_days INTO v_days FROM public.creator_program_settings WHERE id = 1;
  SELECT * INTO v_existing FROM public.creator_attributions WHERE referred_user_id = v_user;
  IF FOUND AND v_existing.expires_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'kept_first_touch', 'creator_id', v_existing.creator_id, 'code', v_existing.code);
  END IF;
  IF FOUND THEN
    DELETE FROM public.creator_attributions WHERE id = v_existing.id;
  END IF;
  INSERT INTO public.creator_attributions (creator_id, referred_user_id, code, first_touch_at, expires_at)
  VALUES (v_creator.id, v_user, v_creator.code, now(), now() + make_interval(days => coalesce(v_days, 30)));
  RETURN jsonb_build_object('ok', true, 'reason', 'claimed', 'creator_id', v_creator.id, 'code', v_creator.code);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_creator_attribution(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_creator_attribution(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.checkout_creator_metadata(p_user_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.creator_attributions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  SELECT * INTO v_row FROM public.creator_attributions
    WHERE referred_user_id = p_user_id AND expires_at > now();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_attribution');
  END IF;
  IF p_code IS NOT NULL AND lower(trim(p_code)) IS DISTINCT FROM v_row.code THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'kept_first_touch', 'creator_id', v_row.creator_id, 'code', v_row.code);
  END IF;
  RETURN jsonb_build_object('ok', true, 'creator_id', v_row.creator_id, 'code', v_row.code);
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_creator_metadata(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_creator_metadata(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_creator_outbound_message(p_host_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_grant public.plan_grants%ROWTYPE;
BEGIN
  SELECT lower(email) INTO v_email FROM public.profiles WHERE id = p_host_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_profile');
  END IF;
  SELECT * INTO v_grant
  FROM public.plan_grants
  WHERE email = v_email AND kind = 'creator'
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'not_creator_grant');
  END IF;
  IF v_grant.expires_at IS NOT NULL AND v_grant.expires_at <= now() THEN
    IF NOT EXISTS (SELECT 1 FROM public.plan_grants g WHERE g.email = v_email AND g.kind <> 'creator') THEN
      UPDATE public.profiles SET plan_override = NULL WHERE id = p_host_id AND plan_override = 'pro';
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'creator_grant_expired');
  END IF;
  IF v_grant.outbound_message_limit IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'creator_unlimited');
  END IF;
  UPDATE public.plan_grants
  SET outbound_messages_used = outbound_messages_used + 1
  WHERE email = v_grant.email AND kind = 'creator'
    AND outbound_message_limit IS NOT NULL
    AND outbound_messages_used < outbound_message_limit;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'creator_message_limit', 'remaining', 0);
  END IF;
  RETURN jsonb_build_object('ok', true, 'reason', 'reserved');
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_creator_outbound_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_creator_outbound_message(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_creator_outbound_message(p_host_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM public.profiles WHERE id = p_host_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_profile');
  END IF;
  UPDATE public.plan_grants
  SET outbound_messages_used = GREATEST(0, outbound_messages_used - 1)
  WHERE email = v_email AND kind = 'creator' AND outbound_message_limit IS NOT NULL;
  RETURN jsonb_build_object('ok', true, 'reason', 'released');
END;
$$;

REVOKE ALL ON FUNCTION public.release_creator_outbound_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_creator_outbound_message(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_creator_commission(
  p_creator_id uuid,
  p_event_id text,
  p_invoice_id text,
  p_kind text,
  p_basis_cents integer,
  p_amount_cents integer,
  p_rate_bps integer,
  p_refund_id text,
  p_available_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.creator_program_settings WHERE id = 1;
  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'program_draft');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.creators c
    JOIN public.creator_terms_versions t ON t.version = c.terms_accepted_version
    WHERE c.id = p_creator_id
      AND t.published_at IS NOT NULL
      AND t.version = (
        SELECT version FROM public.creator_terms_versions
        WHERE published_at IS NOT NULL
        ORDER BY version DESC
        LIMIT 1
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'terms_not_accepted');
  END IF;
  IF EXISTS (SELECT 1 FROM public.creator_commission_entries WHERE stripe_event_id = p_event_id) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'duplicate');
  END IF;
  IF p_kind = 'earn' AND EXISTS (
    SELECT 1 FROM public.creator_commission_entries WHERE stripe_invoice_id = p_invoice_id AND kind = 'earn'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'duplicate');
  END IF;
  INSERT INTO public.creator_commission_entries (
    creator_id, stripe_event_id, stripe_invoice_id, stripe_refund_id, kind,
    basis_cents, amount_cents, rate_bps, status, available_at
  ) VALUES (
    p_creator_id, p_event_id, p_invoice_id, p_refund_id, p_kind,
    p_basis_cents, p_amount_cents, p_rate_bps,
    CASE WHEN p_available_at <= now() THEN 'payable' ELSE 'pending' END,
    p_available_at
  );
  RETURN jsonb_build_object('ok', true, 'reason', 'recorded');
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', true, 'reason', 'duplicate');
END;
$$;

REVOKE ALL ON FUNCTION public.record_creator_commission(uuid, text, text, text, integer, integer, integer, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_creator_commission(uuid, text, text, text, integer, integer, integer, text, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.approve_creator_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.creator_applications%ROWTYPE;
  v_code text;
  v_id uuid;
BEGIN
  IF NOT public.is_pinonit_staff() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_app FROM public.creator_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  SELECT id, code INTO v_id, v_code FROM public.creators WHERE lower(email) = lower(trim(v_app.email)) LIMIT 1;
  IF v_id IS NULL THEN
    v_code := substr(md5(gen_random_uuid()::text), 1, 8);
    INSERT INTO public.creators (application_id, email, code, commission_eligible)
    VALUES (v_app.id, lower(trim(v_app.email)), v_code, false)
    RETURNING id INTO v_id;
  END IF;
  UPDATE public.creator_applications
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_application_id;
  RETURN jsonb_build_object('ok', true, 'creator_id', v_id, 'code', v_code, 'commission_eligible', false, 'grant', false);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_creator_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_creator_application(uuid) TO authenticated;

-- Refuses while the program is draft, so review cannot create a live complimentary grant.
CREATE OR REPLACE FUNCTION public.grant_creator_access(p_creator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_days integer;
  v_limit integer;
  v_email text;
BEGIN
  IF NOT public.is_pinonit_staff() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT status, proposed_grant_duration_days, proposed_outbound_message_limit
    INTO v_status, v_days, v_limit
    FROM public.creator_program_settings WHERE id = 1;
  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'program_draft');
  END IF;
  SELECT lower(email) INTO v_email FROM public.creators WHERE id = p_creator_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  INSERT INTO public.plan_grants (email, note, kind, creator_id, expires_at, outbound_message_limit)
  VALUES (
    v_email,
    'Creator partner grant',
    'creator',
    p_creator_id,
    now() + make_interval(days => v_days),
    v_limit
  )
  ON CONFLICT (email) DO UPDATE
    SET kind = 'creator',
        creator_id = EXCLUDED.creator_id,
        expires_at = EXCLUDED.expires_at,
        outbound_message_limit = EXCLUDED.outbound_message_limit,
        note = EXCLUDED.note
    WHERE public.plan_grants.kind = 'creator';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'existing_complimentary_grant');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_creator_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_creator_access(uuid) TO authenticated;

-- A refund or dispute after a payout keeps the payout row and writes a negative payable balance.
CREATE OR REPLACE FUNCTION public.apply_creator_reversal(
  p_event_id text,
  p_invoice_id text,
  p_kind text,
  p_refund_id text,
  p_refund_cents integer,
  p_charge_cents integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earn public.creator_commission_entries%ROWTYPE;
  v_reversed integer;
  v_reversed_basis integer;
  v_remaining integer;
  v_remaining_basis integer;
  v_basis integer;
  v_claw integer;
  v_charge integer;
  v_status text;
  v_reason text;
BEGIN
  IF p_kind NOT IN ('refund', 'dispute') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_kind');
  END IF;
  IF EXISTS (SELECT 1 FROM public.creator_commission_entries WHERE stripe_event_id = p_event_id) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'duplicate');
  END IF;
  IF p_kind = 'refund' AND p_refund_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.creator_commission_entries WHERE stripe_refund_id = p_refund_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'duplicate');
  END IF;
  IF p_kind = 'dispute' AND EXISTS (
    SELECT 1 FROM public.creator_commission_entries
    WHERE stripe_invoice_id = p_invoice_id AND kind = 'dispute'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'duplicate');
  END IF;

  SELECT * INTO v_earn
  FROM public.creator_commission_entries
  WHERE stripe_invoice_id = p_invoice_id AND kind = 'earn'
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_reverse');
  END IF;

  SELECT COALESCE(SUM(ABS(amount_cents)), 0), COALESCE(SUM(basis_cents), 0)
    INTO v_reversed, v_reversed_basis
  FROM public.creator_commission_entries
  WHERE stripe_invoice_id = p_invoice_id AND kind <> 'earn';

  v_remaining := GREATEST(0, v_earn.amount_cents - v_reversed);
  v_remaining_basis := GREATEST(0, v_earn.basis_cents - v_reversed_basis);
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_reverse');
  END IF;

  IF p_kind = 'dispute' THEN
    v_basis := v_remaining_basis;
    v_claw := v_remaining;
  ELSE
    v_charge := CASE WHEN p_charge_cents IS NULL OR p_charge_cents <= 0 THEN v_earn.basis_cents ELSE p_charge_cents END;
    v_basis := LEAST(
      v_remaining_basis,
      GREATEST(0, ((p_refund_cents::bigint * v_earn.basis_cents + (v_charge / 2)) / v_charge)::integer)
    );
    v_claw := LEAST(v_remaining, public.creator_commission_cents(v_basis, v_earn.rate_bps));
  END IF;
  IF v_claw <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_reverse');
  END IF;

  IF v_earn.status = 'paid' THEN
    v_status := 'payable';
    v_reason := 'recoverable_after_payout';
  ELSIF p_kind = 'dispute' THEN
    v_status := 'payable';
    v_reason := 'dispute';
  ELSE
    v_status := v_earn.status;
    v_reason := 'refund';
  END IF;

  INSERT INTO public.creator_commission_entries (
    creator_id, stripe_event_id, stripe_invoice_id, stripe_refund_id, kind,
    basis_cents, amount_cents, rate_bps, status, reason, available_at
  ) VALUES (
    v_earn.creator_id, p_event_id, p_invoice_id, p_refund_id, p_kind,
    v_basis, -v_claw, v_earn.rate_bps, v_status, v_reason, now()
  );
  RETURN jsonb_build_object('ok', true, 'reason', v_reason, 'amount_cents', -v_claw);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', true, 'reason', 'duplicate');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_creator_reversal(text, text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_creator_reversal(text, text, text, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_creator_terms(p_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator public.creators%ROWTYPE;
  v_published integer;
  v_program text;
BEGIN
  SELECT version INTO v_published
  FROM public.creator_terms_versions
  WHERE published_at IS NOT NULL
  ORDER BY version DESC
  LIMIT 1;
  IF v_published IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'terms_not_published');
  END IF;
  IF p_version IS DISTINCT FROM v_published THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'stale_terms');
  END IF;

  SELECT * INTO v_creator
  FROM public.creators
  WHERE user_id = auth.uid()
     OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  ORDER BY (user_id = auth.uid()) DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT status INTO v_program FROM public.creator_program_settings WHERE id = 1;
  UPDATE public.creators
  SET terms_accepted_version = v_published,
      terms_accepted_at = now(),
      user_id = COALESCE(user_id, auth.uid()),
      commission_eligible = (v_program = 'active')
  WHERE id = v_creator.id;
  RETURN jsonb_build_object(
    'ok', true,
    'version', v_published,
    'commission_eligible', v_program = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_creator_terms(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_creator_terms(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_creator_payout(
  p_creator_id uuid,
  p_paid_on date,
  p_amount_cents integer,
  p_reference text,
  p_entry_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum integer;
  v_count integer;
  v_payout uuid;
BEGIN
  IF NOT public.is_pinonit_staff() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_reference IS NULL OR length(btrim(p_reference)) = 0 OR p_paid_on IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reference_required');
  END IF;
  IF p_entry_ids IS NULL OR cardinality(p_entry_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'entry_ids');
  END IF;

  PERFORM 1
  FROM public.creator_commission_entries
  WHERE id = ANY (p_entry_ids)
  FOR UPDATE;

  SELECT COUNT(*), COALESCE(SUM(amount_cents), 0)
    INTO v_count, v_sum
  FROM public.creator_commission_entries
  WHERE id = ANY (p_entry_ids)
    AND creator_id = p_creator_id
    AND kind = 'earn'
    AND status = 'payable'
    AND amount_cents > 0;
  IF v_count IS DISTINCT FROM cardinality(p_entry_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_payable_earning');
  END IF;
  IF v_sum IS DISTINCT FROM p_amount_cents THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.creator_payout_items WHERE entry_id = ANY (p_entry_ids)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;

  INSERT INTO public.creator_payouts (creator_id, amount_cents, paid_on, reference, created_by)
  VALUES (p_creator_id, p_amount_cents, p_paid_on, btrim(p_reference), auth.uid())
  RETURNING id INTO v_payout;

  INSERT INTO public.creator_payout_items (payout_id, entry_id, amount_cents)
  SELECT v_payout, id, amount_cents
  FROM public.creator_commission_entries
  WHERE id = ANY (p_entry_ids);

  UPDATE public.creator_commission_entries
  SET status = 'paid'
  WHERE id = ANY (p_entry_ids);

  RETURN jsonb_build_object('ok', true, 'payout_id', v_payout);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
END;
$$;

REVOKE ALL ON FUNCTION public.record_creator_payout(uuid, date, integer, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_creator_payout(uuid, date, integer, text, uuid[]) TO authenticated;
