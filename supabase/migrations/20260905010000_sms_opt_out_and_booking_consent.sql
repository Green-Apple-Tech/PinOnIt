-- Durable SMS STOP/START registry + booking-linked consent evidence.
-- Guest booking consent writes move into create_guest_booking (SECURITY DEFINER).

-- 1) Opt-out registry (last-10 digits as stable key)
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  phone_last10 text PRIMARY KEY CHECK (phone_last10 ~ '^\d{10}$'),
  phone_e164 text,
  is_opted_out boolean NOT NULL DEFAULT true,
  opted_out_at timestamptz,
  opted_in_at timestamptz,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_opt_outs_opted_out_idx
  ON public.sms_opt_outs (is_opted_out)
  WHERE is_opted_out = true;

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
-- No public policies: only service_role / SECURITY DEFINER functions touch this.

-- 2) Enrich sms_optins as booking-linked evidence
ALTER TABLE public.sms_optins
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disclosure_text text,
  ADD COLUMN IF NOT EXISTS page_url text;

CREATE INDEX IF NOT EXISTS sms_optins_booking_id_idx ON public.sms_optins(booking_id);
CREATE INDEX IF NOT EXISTS sms_optins_phone_idx ON public.sms_optins(phone);

-- Drop open anon INSERT — guests must go through create_guest_booking / record_sms_optin RPC
DROP POLICY IF EXISTS "Public can submit SMS opt-in" ON public.sms_optins;

-- 3) Phone helpers
CREATE OR REPLACE FUNCTION public.phone_last10(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) >= 10
      THEN right(regexp_replace(p_phone, '\D', '', 'g'), 10)
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.sms_is_opted_out(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sms_opt_outs o
    WHERE o.phone_last10 = public.phone_last10(p_phone)
      AND o.is_opted_out = true
  );
$$;

REVOKE ALL ON FUNCTION public.sms_is_opted_out(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sms_is_opted_out(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_sms_opt_out(p_phone text, p_source text DEFAULT 'inbound_stop')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last10 text := public.phone_last10(p_phone);
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
BEGIN
  IF v_last10 IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.sms_opt_outs (phone_last10, phone_e164, is_opted_out, opted_out_at, source, updated_at)
  VALUES (
    v_last10,
    CASE WHEN left(v_digits, 1) = '1' AND length(v_digits) = 11 THEN '+' || v_digits
         WHEN length(v_digits) = 10 THEN '+1' || v_digits
         ELSE NULLIF(btrim(p_phone), '') END,
    true,
    now(),
    COALESCE(NULLIF(btrim(p_source), ''), 'inbound_stop'),
    now()
  )
  ON CONFLICT (phone_last10) DO UPDATE
    SET is_opted_out = true,
        opted_out_at = now(),
        phone_e164 = COALESCE(EXCLUDED.phone_e164, public.sms_opt_outs.phone_e164),
        source = EXCLUDED.source,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.record_sms_opt_in(p_phone text, p_source text DEFAULT 'inbound_start')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last10 text := public.phone_last10(p_phone);
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
BEGIN
  IF v_last10 IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.sms_opt_outs (phone_last10, phone_e164, is_opted_out, opted_in_at, source, updated_at)
  VALUES (
    v_last10,
    CASE WHEN left(v_digits, 1) = '1' AND length(v_digits) = 11 THEN '+' || v_digits
         WHEN length(v_digits) = 10 THEN '+1' || v_digits
         ELSE NULLIF(btrim(p_phone), '') END,
    false,
    now(),
    COALESCE(NULLIF(btrim(p_source), ''), 'inbound_start'),
    now()
  )
  ON CONFLICT (phone_last10) DO UPDATE
    SET is_opted_out = false,
        opted_in_at = now(),
        phone_e164 = COALESCE(EXCLUDED.phone_e164, public.sms_opt_outs.phone_e164),
        source = EXCLUDED.source,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_sms_opt_out(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_sms_opt_in(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sms_opt_out(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_sms_opt_in(text, text) TO service_role;

-- Standalone consent page still needs an RPC (no longer direct INSERT)
CREATE OR REPLACE FUNCTION public.record_sms_optin_public(
  p_name text,
  p_phone text,
  p_source text DEFAULT 'sms_consent_page',
  p_user_agent text DEFAULT NULL,
  p_disclosure_text text DEFAULT NULL,
  p_page_url text DEFAULT NULL,
  p_booking_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_phone text := NULLIF(btrim(p_phone), '');
BEGIN
  IF v_phone IS NULL OR public.phone_last10(v_phone) IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.sms_optins (
    name, phone, consent, source, user_agent, disclosure_text, page_url, booking_id
  ) VALUES (
    NULLIF(btrim(p_name), ''),
    v_phone,
    true,
    COALESCE(NULLIF(btrim(p_source), ''), 'sms_consent_page'),
    NULLIF(btrim(p_user_agent), ''),
    NULLIF(p_disclosure_text, ''),
    NULLIF(btrim(p_page_url), ''),
    p_booking_id
  )
  RETURNING id INTO v_id;

  -- Explicit page opt-in clears a prior STOP
  PERFORM public.record_sms_opt_in(v_phone, COALESCE(NULLIF(btrim(p_source), ''), 'sms_consent_page'));

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_sms_optin_public(text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sms_optin_public(text, text, text, text, text, text, uuid) TO anon, authenticated;

-- 4) create_guest_booking: write consent evidence inside the RPC
CREATE OR REPLACE FUNCTION public.create_guest_booking(p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
  v_service uuid;
  v_parent uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_name text;
  v_channels text[];
  v_times text[];
  v_notify text[];
  v_phone text;
  rec public.bookings;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'P0001';
  END IF;

  v_host := (p_payload->>'host_id')::uuid;
  v_service := (p_payload->>'service_id')::uuid;
  v_start := (p_payload->>'start_time')::timestamptz;
  v_end := (p_payload->>'end_time')::timestamptz;
  v_name := btrim(COALESCE(p_payload->>'guest_name', ''));
  IF v_host IS NULL OR v_service IS NULL OR v_start IS NULL OR v_end IS NULL OR v_end <= v_start OR v_name = '' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'P0001';
  END IF;

  v_parent := NULLIF(p_payload->>'parent_booking_id', '')::uuid;
  IF v_parent IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.id = v_parent AND b.host_id = v_host
  ) THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.host_plan_is_active(v_host) THEN
    RAISE EXCEPTION 'host_inactive' USING ERRCODE = 'P0001';
  END IF;

  IF public.guest_is_blocked(v_host, p_payload->>'guest_email') THEN
    RAISE EXCEPTION 'guest_blocked' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.services s
    JOIN public.profiles p ON p.id = s.host_id
    WHERE s.id = v_service
      AND s.host_id = v_host
      AND s.is_active = true
      AND p.slug IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'invalid_service' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_payload->>'reminder_channels', '') <> '' AND jsonb_typeof(p_payload->'reminder_channels') = 'array' THEN
    v_channels := ARRAY(SELECT jsonb_array_elements_text(p_payload->'reminder_channels'));
  ELSE
    v_channels := ARRAY['email']::text[];
  END IF;
  IF v_channels IS NULL OR cardinality(v_channels) < 1 THEN
    v_channels := ARRAY['email']::text[];
  END IF;

  IF jsonb_typeof(p_payload->'reminder_times') = 'array' THEN
    v_times := ARRAY(SELECT jsonb_array_elements_text(p_payload->'reminder_times'));
  ELSE
    v_times := ARRAY['24hour', '1hour']::text[];
  END IF;
  IF v_times IS NULL OR cardinality(v_times) < 1 THEN
    v_times := ARRAY['24hour', '1hour']::text[];
  END IF;

  IF jsonb_typeof(p_payload->'notify_via') = 'array' THEN
    v_notify := ARRAY(SELECT jsonb_array_elements_text(p_payload->'notify_via'));
    IF cardinality(v_notify) < 1 THEN
      v_notify := NULL;
    END IF;
  ELSE
    v_notify := NULL;
  END IF;

  v_phone := NULLIF(btrim(p_payload->>'guest_phone'), '');

  -- Consent required for sms/whatsapp in notify_via
  IF v_notify IS NOT NULL AND 'sms' = ANY (v_notify) THEN
    IF v_phone IS NULL OR public.phone_last10(v_phone) IS NULL THEN
      v_notify := array_remove(v_notify, 'sms');
    ELSIF COALESCE((p_payload->>'sms_consent')::boolean, false) IS NOT TRUE THEN
      v_notify := array_remove(v_notify, 'sms');
    END IF;
  END IF;
  IF v_notify IS NOT NULL AND 'whatsapp' = ANY (v_notify) THEN
    IF v_phone IS NULL OR public.phone_last10(v_phone) IS NULL THEN
      v_notify := array_remove(v_notify, 'whatsapp');
    ELSIF COALESCE((p_payload->>'whatsapp_consent')::boolean, false) IS NOT TRUE
      AND COALESCE((p_payload->>'sms_consent')::boolean, false) IS NOT TRUE THEN
      -- WhatsApp uses same phone consent gate when dedicated flag absent
      v_notify := array_remove(v_notify, 'whatsapp');
    END IF;
  END IF;
  IF v_notify IS NOT NULL AND cardinality(v_notify) < 1 THEN
    v_notify := NULL;
  END IF;

  INSERT INTO public.bookings (
    service_id,
    host_id,
    guest_name,
    guest_email,
    guest_phone,
    guest_address,
    notify_via,
    guest_timezone,
    start_time,
    end_time,
    notes,
    status,
    is_recurring,
    recurrence_frequency,
    parent_booking_id,
    reminder_channels,
    reminder_times,
    stripe_payment_id
  ) VALUES (
    v_service,
    v_host,
    v_name,
    NULLIF(btrim(p_payload->>'guest_email'), ''),
    v_phone,
    NULLIF(btrim(p_payload->>'guest_address'), ''),
    v_notify,
    COALESCE(NULLIF(btrim(p_payload->>'guest_timezone'), ''), 'America/New_York'),
    v_start,
    v_end,
    COALESCE(p_payload->>'notes', ''),
    'confirmed',
    COALESCE((p_payload->>'is_recurring')::boolean, false),
    NULLIF(p_payload->>'recurrence_frequency', ''),
    v_parent,
    v_channels,
    v_times,
    NULLIF(p_payload->>'stripe_payment_id', '')
  )
  RETURNING * INTO rec;

  -- Durable consent evidence when SMS was granted
  IF v_notify IS NOT NULL AND 'sms' = ANY (v_notify) AND v_phone IS NOT NULL THEN
    INSERT INTO public.sms_optins (
      name, phone, consent, source, user_agent, disclosure_text, page_url, booking_id
    ) VALUES (
      v_name,
      v_phone,
      true,
      COALESCE(NULLIF(btrim(p_payload->>'sms_consent_source'), ''), 'booking'),
      NULLIF(btrim(p_payload->>'sms_consent_user_agent'), ''),
      NULLIF(p_payload->>'sms_consent_disclosure', ''),
      NULLIF(btrim(p_payload->>'sms_consent_page_url'), ''),
      rec.id
    );
    -- Fresh booking opt-in clears a prior STOP for this number
    PERFORM public.record_sms_opt_in(v_phone, 'booking_consent');
  END IF;

  RETURN row_to_json(rec);
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_booking(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_booking(jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
