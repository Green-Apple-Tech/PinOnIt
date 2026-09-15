-- Standing jobs: host-created series. Visits are normal bookings.standing_job_id
-- rows. parent_booking_id stays for guest recurring + reschedule chains only.

CREATE TABLE IF NOT EXISTS public.standing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_address text,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
  interval_days integer,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  timezone text NOT NULL DEFAULT 'America/New_York',
  ends_at timestamptz,
  occurrence_count integer CHECK (occurrence_count IS NULL OR occurrence_count > 0),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  sms_consent boolean NOT NULL DEFAULT false,
  whatsapp_consent boolean NOT NULL DEFAULT false,
  notify_via text[],
  reminder_channels text[] NOT NULL DEFAULT ARRAY['email']::text[],
  reminder_times text[] NOT NULL DEFAULT ARRAY['24hour', '1hour']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT standing_jobs_custom_interval CHECK (
    frequency <> 'custom' OR (interval_days IS NOT NULL AND interval_days >= 1)
  )
);

CREATE INDEX IF NOT EXISTS standing_jobs_host_idx ON public.standing_jobs (host_id, status);
CREATE INDEX IF NOT EXISTS standing_jobs_customer_idx ON public.standing_jobs (host_id, lower(customer_name));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS standing_job_id uuid REFERENCES public.standing_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_standing_job_id_idx ON public.bookings (standing_job_id);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_standing_job_start_uidx
  ON public.bookings (standing_job_id, start_time)
  WHERE standing_job_id IS NOT NULL AND status <> 'canceled';

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('tentative', 'pending_approval', 'confirmed', 'canceled', 'completed', 'no_show', 'skipped'));

ALTER TABLE public.standing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS standing_jobs_host_all ON public.standing_jobs;
CREATE POLICY standing_jobs_host_all
  ON public.standing_jobs
  FOR ALL
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

CREATE OR REPLACE FUNCTION public.standing_job_next_at(
  p_at timestamptz,
  p_freq text,
  p_interval_days integer
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_freq = 'weekly' THEN
    RETURN p_at + interval '7 days';
  ELSIF p_freq = 'biweekly' THEN
    RETURN p_at + interval '14 days';
  ELSIF p_freq = 'monthly' THEN
    RETURN p_at + interval '1 month';
  ELSE
    RETURN p_at + make_interval(days => GREATEST(COALESCE(p_interval_days, 1), 1));
  END IF;
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

    cur := rec.starts_at;
    WHILE cur <= horizon LOOP
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

      cur := public.standing_job_next_at(cur, rec.frequency, rec.interval_days);
      EXIT WHEN cur <= rec.starts_at;
    END LOOP;
  END LOOP;

  RETURN created;
END;
$$;

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
  p_clear_end boolean DEFAULT false
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
  uuid, timestamptz, timestamptz, text, integer, timestamptz, integer, integer, uuid, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.standing_job_change_forward(
  uuid, timestamptz, timestamptz, text, integer, timestamptz, integer, integer, uuid, integer, boolean
) TO authenticated;

REVOKE ALL ON FUNCTION public.standing_job_next_at(timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.standing_job_next_at(timestamptz, text, integer) TO authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('extend-standing-jobs');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'extend-standing-jobs',
  '15 6 * * *',
  $$SELECT public.extend_standing_jobs();$$
);

NOTIFY pgrst, 'reload schema';
