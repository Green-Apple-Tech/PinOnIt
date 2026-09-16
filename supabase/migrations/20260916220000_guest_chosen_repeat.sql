-- Guests (and Book-for-someone) can request repeating without the event type
-- being flagged is_recurring. They send frequency / weekdays on the payload.
-- Host-created repeats start active and fill the next 90 days.

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
  v_svc public.services;
  v_job uuid;
  v_want_repeat boolean;
  v_freq text;
  v_interval integer;
  v_ends timestamptz;
  v_weekdays integer[];
  v_month_nth integer;
  v_host_created boolean;
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

  SELECT s.* INTO v_svc
  FROM public.services s
  JOIN public.profiles p ON p.id = s.host_id
  WHERE s.id = v_service
    AND s.host_id = v_host
    AND s.is_active = true
    AND p.slug IS NOT NULL;

  IF NOT FOUND THEN
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

  v_host_created := COALESCE((p_payload->>'created_by_host')::boolean, false);
  v_freq := lower(btrim(COALESCE(
    p_payload->>'repeat_frequency',
    p_payload->>'recurrence_frequency',
    v_svc.recurrence_frequency::text,
    ''
  )));
  IF v_freq NOT IN ('weekly', 'biweekly', 'monthly', 'custom') THEN
    v_freq := NULL;
  END IF;
  IF COALESCE((p_payload->>'request_repeating')::boolean, false) AND v_freq IS NULL THEN
    v_freq := 'weekly';
  END IF;
  v_want_repeat := COALESCE((p_payload->>'request_repeating')::boolean, false) AND v_freq IS NOT NULL;

  IF jsonb_typeof(p_payload->'repeat_weekdays') = 'array' THEN
    SELECT ARRAY_AGG(x ORDER BY x) INTO v_weekdays
    FROM (
      SELECT DISTINCT (jsonb_array_elements_text(p_payload->'repeat_weekdays'))::int AS x
    ) q
    WHERE x BETWEEN 0 AND 6;
  END IF;
  IF v_weekdays IS NULL OR cardinality(v_weekdays) < 1 THEN
    v_weekdays := ARRAY[EXTRACT(DOW FROM v_start AT TIME ZONE COALESCE(NULLIF(btrim(p_payload->>'guest_timezone'), ''), 'America/New_York'))::int];
  END IF;

  IF p_payload ? 'repeat_month_nth' AND NULLIF(p_payload->>'repeat_month_nth', '') IS NOT NULL THEN
    v_month_nth := (p_payload->>'repeat_month_nth')::int;
    IF v_month_nth IS DISTINCT FROM -1 AND (v_month_nth < 1 OR v_month_nth > 4) THEN
      v_month_nth := NULL;
    END IF;
  END IF;
  IF v_freq <> 'monthly' THEN
    v_month_nth := NULL;
  END IF;

  IF v_freq = 'custom' THEN
    v_interval := GREATEST(COALESCE((p_payload->>'repeat_interval_days')::int, v_svc.recurrence_interval_days, 1), 1);
  ELSE
    v_interval := NULL;
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
    v_want_repeat,
    CASE WHEN v_want_repeat THEN v_freq ELSE NULL END,
    v_parent,
    v_channels,
    v_times,
    NULLIF(p_payload->>'stripe_payment_id', ''),
    v_host_created
  )
  RETURNING * INTO rec;

  IF v_want_repeat THEN
    v_ends := CASE
      WHEN v_svc.recurrence_end_date IS NOT NULL AND NOT v_host_created
        THEN (v_svc.recurrence_end_date::timestamp + interval '1 day' - interval '1 second') AT TIME ZONE 'UTC'
      ELSE NULL
    END;

    INSERT INTO public.standing_jobs (
      host_id,
      service_id,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      frequency,
      interval_days,
      weekdays,
      month_nth,
      starts_at,
      duration_minutes,
      timezone,
      ends_at,
      occurrence_count,
      price_cents,
      status,
      origin,
      first_booking_id,
      sms_consent,
      whatsapp_consent,
      notify_via,
      reminder_channels,
      reminder_times
    ) VALUES (
      v_host,
      v_service,
      v_name,
      rec.guest_email,
      rec.guest_phone,
      rec.guest_address,
      v_freq,
      v_interval,
      CASE
        WHEN v_freq IN ('weekly', 'biweekly') OR (v_freq = 'monthly' AND v_month_nth IS NOT NULL) THEN v_weekdays
        ELSE NULL
      END,
      v_month_nth,
      v_start,
      GREATEST(COALESCE(v_svc.duration_minutes, 60), 1),
      COALESCE(rec.guest_timezone, 'America/New_York'),
      v_ends,
      CASE WHEN v_host_created THEN NULL ELSE v_svc.recurrence_end_occurrences END,
      GREATEST(COALESCE(v_svc.price_cents, 0), 0),
      CASE WHEN v_host_created THEN 'active' ELSE 'pending_host_confirmation' END,
      CASE WHEN v_host_created THEN 'host' ELSE 'guest' END,
      rec.id,
      COALESCE((p_payload->>'sms_consent')::boolean, false),
      COALESCE((p_payload->>'whatsapp_consent')::boolean, false),
      v_notify,
      v_channels,
      v_times
    )
    RETURNING id INTO v_job;

    UPDATE public.bookings
    SET standing_job_id = v_job
    WHERE id = rec.id
    RETURNING * INTO rec;

    IF v_host_created THEN
      PERFORM public.extend_standing_jobs(v_job);
      SELECT * INTO rec FROM public.bookings WHERE id = rec.id;
    END IF;
  END IF;

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
