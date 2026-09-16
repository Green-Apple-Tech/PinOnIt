-- Recurring jobs: Tue & Fri, first Monday of the month, etc.

ALTER TABLE public.standing_jobs
  ADD COLUMN IF NOT EXISTS weekdays integer[],
  ADD COLUMN IF NOT EXISTS month_nth integer;

ALTER TABLE public.standing_jobs DROP CONSTRAINT IF EXISTS standing_jobs_weekdays_check;
ALTER TABLE public.standing_jobs ADD CONSTRAINT standing_jobs_weekdays_check
  CHECK (weekdays IS NULL OR weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]);

ALTER TABLE public.standing_jobs DROP CONSTRAINT IF EXISTS standing_jobs_month_nth_check;
ALTER TABLE public.standing_jobs ADD CONSTRAINT standing_jobs_month_nth_check
  CHECK (month_nth IS NULL OR month_nth IN (-1, 1, 2, 3, 4));

CREATE OR REPLACE FUNCTION public.standing_job_nth_weekday(p_month date, p_dow integer, p_nth integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  first date := date_trunc('month', p_month)::date;
  last date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  d date;
BEGIN
  IF p_nth = -1 THEN
    d := last;
    WHILE EXTRACT(DOW FROM d)::int <> p_dow LOOP
      d := d - 1;
    END LOOP;
    RETURN d;
  END IF;
  IF p_nth < 1 OR p_nth > 4 THEN
    RETURN NULL;
  END IF;
  d := first;
  WHILE EXTRACT(DOW FROM d)::int <> p_dow LOOP
    d := d + 1;
  END LOOP;
  d := d + ((p_nth - 1) * 7);
  IF d > last THEN RETURN NULL; END IF;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.standing_job_matches_local_date(
  p_local date,
  p_start_local timestamp,
  p_freq text,
  p_interval_days integer,
  p_weekdays integer[],
  p_month_nth integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  start_day date := p_start_local::date;
  dows integer[];
  start_week date;
  cur_week date;
  dim integer;
  want integer;
  wd integer;
  target date;
BEGIN
  IF p_local < start_day THEN
    RETURN false;
  END IF;

  IF p_freq = 'custom' THEN
    RETURN ((p_local - start_day) % GREATEST(COALESCE(p_interval_days, 1), 1)) = 0;
  END IF;

  IF p_weekdays IS NULL OR cardinality(p_weekdays) < 1 THEN
    dows := ARRAY[EXTRACT(DOW FROM p_start_local)::int];
  ELSE
    dows := p_weekdays;
  END IF;

  IF p_freq = 'weekly' THEN
    RETURN EXTRACT(DOW FROM p_local)::int = ANY (dows);
  END IF;

  IF p_freq = 'biweekly' THEN
    IF NOT (EXTRACT(DOW FROM p_local)::int = ANY (dows)) THEN
      RETURN false;
    END IF;
    start_week := start_day - EXTRACT(DOW FROM p_start_local)::int;
    cur_week := p_local - EXTRACT(DOW FROM p_local)::int;
    RETURN ((cur_week - start_week) / 7) % 2 = 0;
  END IF;

  IF p_month_nth IS NOT NULL AND p_month_nth <> 0 THEN
    wd := dows[1];
    target := public.standing_job_nth_weekday(p_local, wd, p_month_nth);
    RETURN target IS NOT NULL AND p_local = target;
  END IF;

  dim := EXTRACT(DAY FROM (date_trunc('month', p_local) + interval '1 month' - interval '1 day')::date)::int;
  want := LEAST(EXTRACT(DAY FROM p_start_local)::int, dim);
  RETURN EXTRACT(DAY FROM p_local)::int = want;
END;
$$;

CREATE OR REPLACE FUNCTION public.extend_standing_jobs(p_job_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.standing_jobs;
  cur timestamptz;
  horizon timestamptz := now() + interval '90 days';
  created integer := 0;
  existing integer;
  channels text[];
  times text[];
  notify text[];
  tz text;
  local_ts timestamp;
  horizon_local date;
  d date;
BEGIN
  FOR rec IN
    SELECT *
    FROM public.standing_jobs j
    WHERE j.status = 'active'
      AND (p_job_id IS NULL OR j.id = p_job_id)
      AND (
        p_job_id IS NOT NULL
        OR auth.uid() IS NULL
        OR j.host_id = auth.uid()
      )
      AND (p_job_id IS NULL OR auth.uid() IS NULL OR j.host_id = auth.uid())
  LOOP
    IF p_job_id IS NOT NULL AND auth.uid() IS NOT NULL AND rec.host_id <> auth.uid() THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    channels := rec.reminder_channels;
    IF channels IS NULL OR cardinality(channels) < 1 THEN
      channels := ARRAY['email']::text[];
    END IF;
    times := rec.reminder_times;
    IF times IS NULL OR cardinality(times) < 1 THEN
      times := ARRAY['24hour', '1hour']::text[];
    END IF;
    notify := rec.notify_via;
    IF rec.sms_consent IS NOT TRUE THEN
      notify := array_remove(COALESCE(notify, ARRAY[]::text[]), 'sms');
    END IF;

    tz := COALESCE(NULLIF(rec.timezone, ''), 'America/New_York');
    local_ts := rec.starts_at AT TIME ZONE tz;
    horizon_local := (horizon AT TIME ZONE tz)::date;

    FOR d IN
      SELECT gs::date
      FROM generate_series(local_ts::date, horizon_local, interval '1 day') gs
    LOOP
      IF NOT public.standing_job_matches_local_date(
        d, local_ts, rec.frequency, rec.interval_days, rec.weekdays, rec.month_nth
      ) THEN
        CONTINUE;
      END IF;

      cur := (d::timestamp + local_ts::time) AT TIME ZONE tz;

      IF rec.ends_at IS NOT NULL AND cur > rec.ends_at THEN
        EXIT;
      END IF;
      SELECT count(*) INTO existing
      FROM public.bookings b
      WHERE b.standing_job_id = rec.id
        AND b.status <> 'canceled';
      IF rec.occurrence_count IS NOT NULL AND existing >= rec.occurrence_count THEN
        EXIT;
      END IF;

      IF cur >= now() - interval '1 hour' THEN
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
          standing_job_id,
          reminder_channels,
          reminder_times,
          created_by_host
        )
        SELECT
          rec.service_id,
          rec.host_id,
          rec.customer_name,
          rec.customer_email,
          rec.customer_phone,
          rec.customer_address,
          notify,
          rec.timezone,
          cur,
          cur + make_interval(mins => rec.duration_minutes),
          rec.notes,
          'confirmed',
          false,
          rec.id,
          channels,
          times,
          true
        WHERE NOT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.standing_job_id = rec.id
            AND b.start_time = cur
            AND b.status <> 'canceled'
        );
        GET DIAGNOSTICS existing = ROW_COUNT;
        created := created + existing;
      END IF;
    END LOOP;
  END LOOP;

  RETURN created;
END;
$$;

DROP FUNCTION IF EXISTS public.standing_job_change_forward(
  uuid, timestamptz, timestamptz, text, integer, timestamptz, integer, integer, uuid, integer, boolean
);

CREATE OR REPLACE FUNCTION public.standing_job_change_forward(
  p_job_id uuid,
  p_from timestamptz,
  p_starts_at timestamptz DEFAULT NULL,
  p_frequency text DEFAULT NULL,
  p_interval_days integer DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,
  p_occurrence_count integer DEFAULT NULL,
  p_price_cents integer DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_clear_end boolean DEFAULT false,
  p_weekdays integer[] DEFAULT NULL,
  p_month_nth integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.standing_jobs;
  from_at timestamptz;
BEGIN
  SELECT * INTO rec FROM public.standing_jobs WHERE id = p_job_id;
  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF rec.host_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  from_at := COALESCE(p_from, now());

  UPDATE public.standing_jobs
  SET
    starts_at = COALESCE(p_starts_at, starts_at),
    frequency = COALESCE(p_frequency, frequency),
    interval_days = CASE
      WHEN p_frequency = 'custom' THEN COALESCE(p_interval_days, interval_days)
      WHEN p_frequency IS NOT NULL THEN NULL
      ELSE interval_days
    END,
    weekdays = CASE WHEN p_frequency IS NOT NULL THEN p_weekdays ELSE COALESCE(p_weekdays, weekdays) END,
    month_nth = CASE WHEN p_frequency IS NOT NULL THEN p_month_nth ELSE COALESCE(p_month_nth, month_nth) END,
    ends_at = CASE WHEN p_clear_end THEN NULL ELSE COALESCE(p_ends_at, ends_at) END,
    occurrence_count = CASE WHEN p_clear_end THEN NULL ELSE COALESCE(p_occurrence_count, occurrence_count) END,
    price_cents = COALESCE(p_price_cents, price_cents),
    service_id = COALESCE(p_service_id, service_id),
    duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
    updated_at = now()
  WHERE id = p_job_id;

  DELETE FROM public.bookings
  WHERE standing_job_id = p_job_id
    AND start_time >= from_at
    AND status IN ('confirmed', 'tentative', 'pending_approval');

  RETURN public.extend_standing_jobs(p_job_id);
END;
$$;

REVOKE ALL ON FUNCTION public.extend_standing_jobs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_standing_jobs(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.standing_job_change_forward(
  uuid, timestamptz, timestamptz, text, integer, timestamptz, integer, integer, uuid, integer, boolean, integer[], integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.standing_job_change_forward(
  uuid, timestamptz, timestamptz, text, integer, timestamptz, integer, integer, uuid, integer, boolean, integer[], integer
) TO authenticated;

REVOKE ALL ON FUNCTION public.standing_job_nth_weekday(date, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.standing_job_nth_weekday(date, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.standing_job_matches_local_date(date, timestamp, text, integer, integer[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.standing_job_matches_local_date(date, timestamp, text, integer, integer[], integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
