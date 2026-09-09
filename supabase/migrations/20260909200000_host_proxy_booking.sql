-- Host-proxy bookings: same bookings row as self-serve, tagged so the dashboard
-- can show "Booked by you" without a separate table.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS created_by_host boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.created_by_host IS
  'True when the host booked this slot on the guest''s behalf (phone / in-person).';

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
    stripe_payment_id,
    created_by_host
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
    NULLIF(p_payload->>'stripe_payment_id', ''),
    COALESCE((p_payload->>'created_by_host')::boolean, false)
  )
  RETURNING * INTO rec;

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
    PERFORM public.record_sms_opt_in(v_phone, 'booking_consent');
  END IF;

  RETURN row_to_json(rec);
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_booking(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_booking(jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
