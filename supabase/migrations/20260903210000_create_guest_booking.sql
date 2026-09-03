-- Guests must get the new booking row back (id, action_token) without a wide
-- anon SELECT on bookings. INSERT … RETURNING is blocked by RLS for anon.

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
    v_times := ARRAY[]::text[];
  END IF;

  IF jsonb_typeof(p_payload->'notify_via') = 'array' THEN
    v_notify := ARRAY(SELECT jsonb_array_elements_text(p_payload->'notify_via'));
    IF cardinality(v_notify) < 1 THEN
      v_notify := NULL;
    END IF;
  ELSE
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
    NULLIF(btrim(p_payload->>'guest_phone'), ''),
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

  RETURN row_to_json(rec);
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_booking(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_booking(jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
