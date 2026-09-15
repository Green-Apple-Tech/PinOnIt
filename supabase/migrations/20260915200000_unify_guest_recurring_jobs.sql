-- Unify guest repeating visits into standing_jobs (pending host confirmation).
-- Guest still cannot INSERT standing_jobs directly; create_guest_booking is SECURITY DEFINER.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS recurrence_interval_days integer;

ALTER TABLE public.standing_jobs
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'host',
  ADD COLUMN IF NOT EXISTS first_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

ALTER TABLE public.standing_jobs DROP CONSTRAINT IF EXISTS standing_jobs_origin_check;
ALTER TABLE public.standing_jobs ADD CONSTRAINT standing_jobs_origin_check
  CHECK (origin IN ('host', 'guest'));

ALTER TABLE public.standing_jobs DROP CONSTRAINT IF EXISTS standing_jobs_status_check;
ALTER TABLE public.standing_jobs ADD CONSTRAINT standing_jobs_status_check
  CHECK (status IN ('active', 'paused', 'ended', 'pending_host_confirmation', 'declined'));

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

  v_want_repeat := COALESCE((p_payload->>'request_repeating')::boolean, false)
    AND COALESCE(v_svc.is_recurring, false)
    AND v_svc.recurrence_frequency IN ('weekly', 'biweekly', 'monthly', 'custom');

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
    CASE WHEN v_want_repeat THEN v_svc.recurrence_frequency ELSE NULL END,
    v_parent,
    v_channels,
    v_times,
    NULLIF(p_payload->>'stripe_payment_id', ''),
    COALESCE((p_payload->>'created_by_host')::boolean, false)
  )
  RETURNING * INTO rec;

  IF v_want_repeat THEN
    v_freq := v_svc.recurrence_frequency;
    v_interval := CASE WHEN v_freq = 'custom' THEN GREATEST(COALESCE(v_svc.recurrence_interval_days, 1), 1) ELSE NULL END;
    v_ends := CASE
      WHEN v_svc.recurrence_end_date IS NOT NULL THEN (v_svc.recurrence_end_date::timestamp + interval '1 day' - interval '1 second') AT TIME ZONE 'UTC'
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
      v_start,
      GREATEST(COALESCE(v_svc.duration_minutes, 60), 1),
      COALESCE(rec.guest_timezone, 'America/New_York'),
      v_ends,
      v_svc.recurrence_end_occurrences,
      GREATEST(COALESCE(v_svc.price_cents, 0), 0),
      'pending_host_confirmation',
      'guest',
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

CREATE OR REPLACE FUNCTION public.confirm_standing_job(p_job_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.standing_jobs;
  created integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO rec FROM public.standing_jobs WHERE id = p_job_id AND host_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF rec.status <> 'pending_host_confirmation' THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.standing_jobs
  SET status = 'active', updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO rec;

  created := public.extend_standing_jobs(p_job_id);
  RETURN json_build_object('job', row_to_json(rec), 'visits_created', created);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_standing_job(p_job_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.standing_jobs;
  bk public.bookings;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO rec FROM public.standing_jobs WHERE id = p_job_id AND host_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF rec.status <> 'pending_host_confirmation' THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.standing_jobs
  SET status = 'declined', updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO rec;

  UPDATE public.bookings
  SET is_recurring = false,
      recurrence_frequency = NULL
  WHERE id = rec.first_booking_id;

  SELECT * INTO bk FROM public.bookings WHERE id = rec.first_booking_id;
  RETURN json_build_object(
    'job', row_to_json(rec),
    'booking_id', rec.first_booking_id,
    'guest_email', COALESCE(bk.guest_email, rec.customer_email),
    'guest_phone', COALESCE(bk.guest_phone, rec.customer_phone),
    'guest_name', COALESCE(bk.guest_name, rec.customer_name)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_standing_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_standing_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_standing_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_standing_job(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_busy_times(
  p_host_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_host_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RETURN json_build_object('bookings', '[]'::json, 'events', '[]'::json);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_host_id AND p.slug IS NOT NULL
  ) THEN
    RETURN json_build_object('bookings', '[]'::json, 'events', '[]'::json);
  END IF;

  RETURN json_build_object(
    'bookings', COALESCE((
      SELECT json_agg(json_build_object(
        'id', b.id,
        'service_id', b.service_id,
        'start_time', b.start_time,
        'end_time', b.end_time,
        'status', b.status,
        'is_recurring', b.is_recurring,
        'parent_booking_id', b.parent_booking_id,
        'standing_job_id', b.standing_job_id
      ) ORDER BY b.start_time)
      FROM public.bookings b
      WHERE b.host_id = p_host_id
        AND b.status = 'confirmed'
        AND b.start_time >= p_from
        AND b.start_time <= p_to
    ), '[]'::json),
    'events', COALESCE((
      SELECT json_agg(json_build_object(
        'start_at', e.start_at,
        'end_at', e.end_at,
        'all_day', e.all_day,
        'show_status', e.show_status,
        'transparency', e.transparency,
        'attendee_self_status', e.attendee_self_status,
        'is_birthday_cal', e.is_birthday_cal,
        'is_holiday_cal', e.is_holiday_cal,
        'title', e.title
      ) ORDER BY e.start_at)
      FROM public.calendar_events e
      WHERE e.host_id = p_host_id
        AND e.start_at >= p_from
        AND e.start_at <= p_to
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_busy_times(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_busy_times(uuid, timestamptz, timestamptz) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
