-- Guest self-reschedule via /r/{token} (SMS reply "2" / email link)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reschedule_cutoff_hours integer NOT NULL DEFAULT 4;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_reschedule_cutoff_hours_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reschedule_cutoff_hours_check
  CHECK (reschedule_cutoff_hours >= 0 AND reschedule_cutoff_hours <= 168);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE TABLE IF NOT EXISTS public.reschedule_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  new_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS reschedule_tokens_booking_id_idx
  ON public.reschedule_tokens (booking_id);
CREATE INDEX IF NOT EXISTS reschedule_tokens_expires_at_idx
  ON public.reschedule_tokens (expires_at);

ALTER TABLE public.reschedule_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages reschedule tokens" ON public.reschedule_tokens;
CREATE POLICY "Service role manages reschedule tokens"
  ON public.reschedule_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.generate_url_token_32()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, extensions
AS $$
  SELECT translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_');
$$;

REVOKE ALL ON FUNCTION public.generate_url_token_32() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ensure_reschedule_token(p_booking_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_token text;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'pending_approval', 'tentative') THEN
    RETURN NULL;
  END IF;

  IF v_booking.start_time <= now() THEN
    RETURN NULL;
  END IF;

  SELECT rt.token INTO v_token
  FROM public.reschedule_tokens rt
  WHERE rt.booking_id = p_booking_id
    AND rt.used_at IS NULL
    AND rt.expires_at > now()
  ORDER BY rt.created_at DESC
  LIMIT 1;

  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  v_expires := LEAST(now() + interval '48 hours', v_booking.start_time);
  IF v_expires <= now() THEN
    RETURN NULL;
  END IF;

  v_token := public.generate_url_token_32();

  INSERT INTO public.reschedule_tokens (token, booking_id, expires_at)
  VALUES (v_token, p_booking_id, v_expires);

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_reschedule_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_reschedule_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_reschedule_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rt public.reschedule_tokens%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_host public.profiles%ROWTYPE;
  v_cutoff integer;
  v_reason text;
  v_contact jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_rt
  FROM public.reschedule_tokens
  WHERE token = trim(p_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = v_rt.booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_host FROM public.profiles WHERE id = v_booking.host_id;
  SELECT * INTO v_service FROM public.services WHERE id = v_booking.service_id;
  v_cutoff := COALESCE(v_host.reschedule_cutoff_hours, 4);

  v_contact := jsonb_build_object(
    'name', COALESCE(v_host.full_name, 'the host'),
    'email', COALESCE(NULLIF(v_host.notification_email, ''), v_host.email),
    'phone', v_host.phone,
    'slug', v_host.slug
  );

  IF v_rt.used_at IS NOT NULL THEN
    v_reason := 'used';
  ELSIF v_rt.expires_at <= now() THEN
    v_reason := 'expired';
  ELSIF v_booking.status NOT IN ('confirmed', 'pending_approval', 'tentative') THEN
    v_reason := 'used';
  ELSIF v_booking.start_time <= now() THEN
    v_reason := 'expired';
  ELSIF COALESCE(v_service.allow_reschedule, true) IS NOT TRUE THEN
    v_reason := 'not_allowed';
  ELSIF v_booking.start_time < now() + make_interval(hours => v_cutoff) THEN
    v_reason := 'cutoff';
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason, 'contact', v_contact);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_rt.token,
    'booking_id', v_booking.id,
    'start_time', v_booking.start_time,
    'guest_name', v_booking.guest_name,
    'guest_email', v_booking.guest_email,
    'guest_phone', v_booking.guest_phone,
    'guest_timezone', v_booking.guest_timezone,
    'contact', v_contact,
    'host', jsonb_build_object(
      'id', v_host.id,
      'slug', v_host.slug,
      'full_name', v_host.full_name,
      'email', v_host.email,
      'bio', v_host.bio,
      'avatar_url', v_host.avatar_url,
      'brand_color', v_host.brand_color,
      'timezone', v_host.timezone,
      'booking_page_header', v_host.booking_page_header,
      'paid_booking_theme', v_host.paid_booking_theme,
      'paid_booking_settings', v_host.paid_booking_settings,
      'calendar_conflict_settings', v_host.calendar_conflict_settings,
      'global_require_terms', v_host.global_require_terms,
      'global_terms_text', v_host.global_terms_text,
      'phone', v_host.phone
    ),
    'service', to_jsonb(v_service)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_reschedule_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reschedule_session(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_guest_reschedule(
  p_token text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_guest_timezone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rt public.reschedule_tokens%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_host public.profiles%ROWTYPE;
  v_cutoff integer;
  v_new_id uuid;
  v_duration interval;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'invalid_slot';
  END IF;
  IF p_start_time <= now() THEN
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  SELECT * INTO v_rt
  FROM public.reschedule_tokens
  WHERE token = trim(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_rt.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'used';
  END IF;
  IF v_rt.expires_at <= now() THEN
    RAISE EXCEPTION 'expired';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_rt.booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_booking.status NOT IN ('confirmed', 'pending_approval', 'tentative') THEN
    RAISE EXCEPTION 'used';
  END IF;

  SELECT * INTO v_service FROM public.services WHERE id = v_booking.service_id;
  SELECT * INTO v_host FROM public.profiles WHERE id = v_booking.host_id;
  v_cutoff := COALESCE(v_host.reschedule_cutoff_hours, 4);

  IF COALESCE(v_service.allow_reschedule, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF v_booking.start_time < now() + make_interval(hours => v_cutoff) THEN
    RAISE EXCEPTION 'cutoff';
  END IF;

  v_duration := make_interval(mins => COALESCE(v_service.duration_minutes, 30));
  IF abs(extract(epoch FROM (p_end_time - p_start_time)) - extract(epoch FROM v_duration)) > 60 THEN
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.host_id = v_booking.host_id
      AND b.id <> v_booking.id
      AND b.status IN ('confirmed', 'pending_approval', 'tentative')
      AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'slot_taken';
  END IF;

  INSERT INTO public.bookings (
    service_id, host_id, guest_name, guest_email, guest_phone, notify_via,
    guest_timezone, start_time, end_time, status, notes,
    stripe_payment_id, paypal_order_id, payment_provider,
    reminder_channels, reminder_times, parent_booking_id
  ) VALUES (
    v_booking.service_id,
    v_booking.host_id,
    v_booking.guest_name,
    v_booking.guest_email,
    v_booking.guest_phone,
    v_booking.notify_via,
    COALESCE(NULLIF(trim(p_guest_timezone), ''), v_booking.guest_timezone),
    p_start_time,
    p_end_time,
    'confirmed',
    v_booking.notes,
    v_booking.stripe_payment_id,
    v_booking.paypal_order_id,
    v_booking.payment_provider,
    CASE
      WHEN v_booking.reminder_channels IS NULL OR cardinality(v_booking.reminder_channels) = 0
        THEN ARRAY['email']::text[]
      ELSE v_booking.reminder_channels
    END,
    CASE
      WHEN v_booking.reminder_times IS NULL OR cardinality(v_booking.reminder_times) = 0
        THEN ARRAY['1hour']::text[]
      ELSE v_booking.reminder_times
    END,
    v_booking.id
  )
  RETURNING id INTO v_new_id;

  UPDATE public.bookings
  SET
    status = 'canceled',
    cancel_reason = 'rescheduled_by_invitee',
    updated_at = now()
  WHERE id = v_booking.id;

  UPDATE public.reschedule_tokens
  SET used_at = now(), new_booking_id = v_new_id
  WHERE id = v_rt.id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_booking_id', v_new_id,
    'old_booking_id', v_booking.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_guest_reschedule(text, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_guest_reschedule(text, timestamptz, timestamptz, text) TO anon, authenticated, service_role;
