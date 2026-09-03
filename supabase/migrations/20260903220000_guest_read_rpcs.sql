-- Guest booking/poll pages cannot SELECT bookings, calendar_events, or poll
-- responses (RLS). These RPCs return only the fields those pages need.

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
        'start_time', b.start_time,
        'end_time', b.end_time,
        'status', b.status
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

CREATE OR REPLACE FUNCTION public.get_booking_for_guest_action(
  p_booking_id uuid,
  p_action_token text
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec json;
BEGIN
  IF p_booking_id IS NULL OR COALESCE(btrim(p_action_token), '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', b.id,
    'start_time', b.start_time,
    'end_time', b.end_time,
    'meet_link', b.meet_link,
    'status', b.status,
    'action_token', b.action_token,
    'services', json_build_object(
      'name', s.name,
      'color', s.color,
      'duration_minutes', s.duration_minutes
    ),
    'profiles', json_build_object(
      'full_name', p.full_name,
      'slug', p.slug
    )
  )
  INTO rec
  FROM public.bookings b
  LEFT JOIN public.services s ON s.id = b.service_id
  LEFT JOIN public.profiles p ON p.id = b.host_id
  WHERE b.id = p_booking_id
    AND b.action_token = p_action_token;

  RETURN rec;
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_for_guest_action(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_for_guest_action(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_may_answer_booking(p_booking_id uuid, p_question_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.booking_questions bq
      ON bq.id = p_question_id
     AND bq.service_id = b.service_id
    WHERE b.id = p_booking_id
      AND b.status IN ('pending', 'confirmed', 'tentative')
  );
$$;

REVOKE ALL ON FUNCTION public.guest_may_answer_booking(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_may_answer_booking(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Guests insert answers for own bookings" ON public.booking_answers;
CREATE POLICY "Guests insert answers for own bookings"
  ON public.booking_answers FOR INSERT TO anon, authenticated
  WITH CHECK (public.guest_may_answer_booking(booking_id, question_id));

CREATE OR REPLACE FUNCTION public.submit_meeting_poll_response(
  p_poll_id uuid,
  p_name text,
  p_email text,
  p_slot_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
  rec public.meeting_poll_responses;
BEGIN
  v_name := btrim(COALESCE(p_name, ''));
  v_email := lower(btrim(COALESCE(p_email, '')));
  IF p_poll_id IS NULL OR v_name = '' OR v_email = '' OR position('@' IN v_email) = 0
     OR p_slot_ids IS NULL OR cardinality(p_slot_ids) < 1 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_polls m
    WHERE m.id = p_poll_id AND m.status = 'open'
  ) THEN
    RAISE EXCEPTION 'poll_closed' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_slot_ids) AS sid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.meeting_poll_slots s
      WHERE s.id = sid AND s.poll_id = p_poll_id
    )
  ) THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.meeting_poll_responses (poll_id, invitee_name, invitee_email)
  VALUES (p_poll_id, v_name, v_email)
  RETURNING * INTO rec;

  INSERT INTO public.meeting_poll_votes (response_id, slot_id, availability)
  SELECT rec.id, sid, 'yes'
  FROM unnest(p_slot_ids) AS sid;

  RETURN row_to_json(rec);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_meeting_poll_response(uuid, text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_meeting_poll_response(uuid, text, text, uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_meeting_poll_tally(p_poll_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_poll_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.meeting_polls m WHERE m.id = p_poll_id AND m.status IN ('open', 'closed', 'confirmed')
  ) THEN
    RETURN json_build_object('total_responses', 0, 'votes', '[]'::json);
  END IF;

  RETURN json_build_object(
    'total_responses', (
      SELECT count(*)::int FROM public.meeting_poll_responses r WHERE r.poll_id = p_poll_id
    ),
    'votes', COALESCE((
      SELECT json_agg(json_build_object(
        'slot_id', v.slot_id,
        'availability', v.availability
      ))
      FROM public.meeting_poll_votes v
      JOIN public.meeting_poll_slots s ON s.id = v.slot_id
      WHERE s.poll_id = p_poll_id
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_meeting_poll_tally(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meeting_poll_tally(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
