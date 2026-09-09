-- Multi-party scheduling: extend coordinated_meetings (SMS + phones)
-- with discrete proposed slots, per-participant public tokens, and guest RPCs.
-- Does not replace meeting_polls (email/web heatmap) or the existing
-- open-availability SMS flow (natural-language replies).
--
-- New meetings that propose numbered times use scheduling_mode = 'proposed_slots'.
-- Existing rows stay scheduling_mode = 'open_availability'.

-- ── Meeting: display label + which coordination flow ─────────────────────────

ALTER TABLE public.coordinated_meetings
  ADD COLUMN IF NOT EXISTS context_type text NOT NULL DEFAULT 'meeting';

ALTER TABLE public.coordinated_meetings
  DROP CONSTRAINT IF EXISTS coordinated_meetings_context_type_check;

ALTER TABLE public.coordinated_meetings
  ADD CONSTRAINT coordinated_meetings_context_type_check
  CHECK (context_type IN ('meeting', 'showing', 'consultation', 'other'));

ALTER TABLE public.coordinated_meetings
  ADD COLUMN IF NOT EXISTS scheduling_mode text NOT NULL DEFAULT 'open_availability';

ALTER TABLE public.coordinated_meetings
  DROP CONSTRAINT IF EXISTS coordinated_meetings_scheduling_mode_check;

ALTER TABLE public.coordinated_meetings
  ADD CONSTRAINT coordinated_meetings_scheduling_mode_check
  CHECK (scheduling_mode IN ('open_availability', 'proposed_slots'));

COMMENT ON COLUMN public.coordinated_meetings.context_type IS
  'Display-only label (Meeting / Showing / Consultation / Other). Does not change scheduling behavior.';
COMMENT ON COLUMN public.coordinated_meetings.scheduling_mode IS
  'open_availability = existing NL SMS. proposed_slots = numbered times + /c/:token + reply 1/2.';

-- Optional booking created on lock so NeverMiss (send-reminder) can reuse bookings.
ALTER TABLE public.coordinated_meetings
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

-- ── Participants: public token + response status + nudge ─────────────────────

ALTER TABLE public.coordinated_meeting_participants
  ADD COLUMN IF NOT EXISTS token text;

ALTER TABLE public.coordinated_meeting_participants
  ADD COLUMN IF NOT EXISTS response_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.coordinated_meeting_participants
  DROP CONSTRAINT IF EXISTS coordinated_meeting_participants_response_status_check;

ALTER TABLE public.coordinated_meeting_participants
  ADD CONSTRAINT coordinated_meeting_participants_response_status_check
  CHECK (response_status IN ('pending', 'responded', 'confirmed'));

ALTER TABLE public.coordinated_meeting_participants
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

ALTER TABLE public.coordinated_meeting_participants
  ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz;

UPDATE public.coordinated_meeting_participants
SET token = encode(gen_random_bytes(8), 'hex')
WHERE token IS NULL;

ALTER TABLE public.coordinated_meeting_participants
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(8), 'hex');

ALTER TABLE public.coordinated_meeting_participants
  ALTER COLUMN token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coordinated_meeting_participants_token_uidx
  ON public.coordinated_meeting_participants (token);

CREATE UNIQUE INDEX IF NOT EXISTS coordinated_meeting_participants_meeting_phone_uidx
  ON public.coordinated_meeting_participants (meeting_id, phone);

-- Backfill status from existing flags
UPDATE public.coordinated_meeting_participants
SET response_status = 'confirmed'
WHERE confirmed IS TRUE AND response_status = 'pending';

UPDATE public.coordinated_meeting_participants
SET response_status = 'responded'
WHERE confirmed IS NOT TRUE
  AND response_status = 'pending'
  AND (
    COALESCE(availability_pre_entered, false)
    OR NULLIF(btrim(COALESCE(availability_response, '')), '') IS NOT NULL
  );

-- ── Proposed slots (same shape as meeting_poll_slots; owned by a meeting) ────

CREATE TABLE IF NOT EXISTS public.coordinated_meeting_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.coordinated_meetings(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coordinated_meeting_slots_meeting_id_idx
  ON public.coordinated_meeting_slots (meeting_id, sort_order);

ALTER TABLE public.coordinated_meeting_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Host can manage coordinated meeting slots" ON public.coordinated_meeting_slots;
CREATE POLICY "Host can manage coordinated meeting slots"
  ON public.coordinated_meeting_slots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coordinated_meetings m
      WHERE m.id = meeting_id AND m.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coordinated_meetings m
      WHERE m.id = meeting_id AND m.host_id = auth.uid()
    )
  );

-- ── Per-participant yes/no on a proposed slot ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coordinated_meeting_slot_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.coordinated_meeting_participants(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.coordinated_meeting_slots(id) ON DELETE CASCADE,
  availability text NOT NULL DEFAULT 'yes'
    CHECK (availability IN ('yes', 'maybe', 'no')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, slot_id)
);

CREATE INDEX IF NOT EXISTS coordinated_meeting_slot_votes_slot_id_idx
  ON public.coordinated_meeting_slot_votes (slot_id);

ALTER TABLE public.coordinated_meeting_slot_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Host can view coordinated meeting slot votes" ON public.coordinated_meeting_slot_votes;
CREATE POLICY "Host can view coordinated meeting slot votes"
  ON public.coordinated_meeting_slot_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coordinated_meeting_participants p
      JOIN public.coordinated_meetings m ON m.id = p.meeting_id
      WHERE p.id = participant_id AND m.host_id = auth.uid()
    )
  );

-- Guests never SELECT these tables; they use SECURITY DEFINER RPCs (same as /d/:token).

-- ── 2–5 active participants on proposed-slot meetings (call after inserts) ──

CREATE OR REPLACE FUNCTION public.coordination_assert_participant_count(p_meeting_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_n integer;
  v_mode text;
BEGIN
  SELECT scheduling_mode INTO v_mode
  FROM public.coordinated_meetings
  WHERE id = p_meeting_id;

  IF v_mode IS DISTINCT FROM 'proposed_slots' THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_n
  FROM public.coordinated_meeting_participants
  WHERE meeting_id = p_meeting_id
    AND opted_out IS NOT TRUE;

  IF v_n < 2 OR v_n > 5 THEN
    RAISE EXCEPTION 'proposed_slots meetings need 2 to 5 participants'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── Overlap: slot every active participant marked yes ────────────────────────

CREATE OR REPLACE FUNCTION public.coordination_unanimous_slot_id(p_meeting_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH active AS (
    SELECT p.id
    FROM public.coordinated_meeting_participants p
    WHERE p.meeting_id = p_meeting_id
      AND p.opted_out IS NOT TRUE
  ),
  needed AS (
    SELECT count(*)::int AS n FROM active
  )
  SELECT s.id
  FROM public.coordinated_meeting_slots s
  CROSS JOIN needed
  WHERE s.meeting_id = p_meeting_id
    AND needed.n >= 2
    AND NOT EXISTS (
      SELECT 1 FROM public.coordinated_meeting_participants p
      WHERE p.meeting_id = p_meeting_id
        AND p.opted_out IS NOT TRUE
        AND p.response_status NOT IN ('responded', 'confirmed')
    )
    AND (
      SELECT count(*)
      FROM public.coordinated_meeting_slot_votes v
      JOIN active a ON a.id = v.participant_id
      WHERE v.slot_id = s.id AND v.availability = 'yes'
    ) = needed.n
  ORDER BY s.sort_order, s.start_time
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.coordination_all_active_responded(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE opted_out IS NOT TRUE) > 0
    AND count(*) FILTER (
      WHERE opted_out IS NOT TRUE
        AND response_status NOT IN ('responded', 'confirmed')
    ) = 0
  FROM public.coordinated_meeting_participants
  WHERE meeting_id = p_meeting_id;
$$;

-- ── Guest read (public /c/:token) ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_coordination_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.coordinated_meeting_participants%ROWTYPE;
  v_m public.coordinated_meetings%ROWTYPE;
BEGIN
  IF COALESCE(btrim(p_token), '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_p
  FROM public.coordinated_meeting_participants
  WHERE token = btrim(p_token);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_m
  FROM public.coordinated_meetings
  WHERE id = v_p.meeting_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'meeting', json_build_object(
      'id', v_m.id,
      'title', v_m.title,
      'location', v_m.location,
      'duration_minutes', v_m.duration_minutes,
      'context_type', v_m.context_type,
      'scheduling_mode', v_m.scheduling_mode,
      'status', v_m.status,
      'confirmed_time', v_m.confirmed_time
    ),
    'participant', json_build_object(
      'name', v_p.name,
      'response_status', v_p.response_status,
      'token', v_p.token
    ),
    'slots', COALESCE((
      SELECT json_agg(json_build_object(
        'id', s.id,
        'start_time', s.start_time,
        'end_time', s.end_time,
        'sort_order', s.sort_order,
        'you_said_yes', EXISTS (
          SELECT 1 FROM public.coordinated_meeting_slot_votes v
          WHERE v.participant_id = v_p.id
            AND v.slot_id = s.id
            AND v.availability = 'yes'
        )
      ) ORDER BY s.sort_order, s.start_time)
      FROM public.coordinated_meeting_slots s
      WHERE s.meeting_id = v_m.id
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_coordination_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coordination_by_token(text) TO anon, authenticated;

-- ── Guest vote (page or SMS “2” mapped to slot id in the edge function) ──────

CREATE OR REPLACE FUNCTION public.submit_coordination_slot_votes(
  p_token text,
  p_slot_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.coordinated_meeting_participants%ROWTYPE;
  v_m public.coordinated_meetings%ROWTYPE;
  v_overlap uuid;
  v_all boolean;
BEGIN
  IF COALESCE(btrim(p_token), '') = '' THEN
    RETURN json_build_object('ok', false, 'error', 'missing token');
  END IF;

  SELECT * INTO v_p
  FROM public.coordinated_meeting_participants
  WHERE token = btrim(p_token)
  FOR UPDATE;

  IF NOT FOUND OR v_p.opted_out THEN
    RETURN json_build_object('ok', false, 'error', 'not found');
  END IF;

  SELECT * INTO v_m
  FROM public.coordinated_meetings
  WHERE id = v_p.meeting_id
  FOR UPDATE;

  IF v_m.scheduling_mode IS DISTINCT FROM 'proposed_slots' THEN
    RETURN json_build_object('ok', false, 'error', 'not a proposed-slot meeting');
  END IF;

  IF v_m.status IS DISTINCT FROM 'collecting_availability' THEN
    RETURN json_build_object('ok', false, 'error', 'not collecting');
  END IF;

  IF p_slot_ids IS NOT NULL AND cardinality(p_slot_ids) > 0 AND EXISTS (
    SELECT 1
    FROM unnest(p_slot_ids) AS sid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.coordinated_meeting_slots s
      WHERE s.id = sid AND s.meeting_id = v_m.id
    )
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'invalid slot');
  END IF;

  DELETE FROM public.coordinated_meeting_slot_votes
  WHERE participant_id = v_p.id;

  IF p_slot_ids IS NOT NULL AND cardinality(p_slot_ids) > 0 THEN
    INSERT INTO public.coordinated_meeting_slot_votes (participant_id, slot_id, availability)
    SELECT v_p.id, sid, 'yes'
    FROM unnest(p_slot_ids) AS sid;
  END IF;

  UPDATE public.coordinated_meeting_participants
  SET
    response_status = 'responded',
    responded_at = now(),
    availability_response = COALESCE(availability_response, 'slots')
  WHERE id = v_p.id;

  v_all := public.coordination_all_active_responded(v_m.id);
  v_overlap := CASE
    WHEN v_all THEN public.coordination_unanimous_slot_id(v_m.id)
    ELSE NULL
  END;

  RETURN json_build_object(
    'ok', true,
    'all_responded', v_all,
    'overlap_slot_id', v_overlap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_coordination_slot_votes(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_coordination_slot_votes(text, uuid[]) TO anon, authenticated;

-- ── Host (or auto-lock edge) records the chosen slot ─────────────────────────

CREATE OR REPLACE FUNCTION public.lock_coordination_slot(
  p_meeting_id uuid,
  p_slot_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.coordinated_meetings%ROWTYPE;
  v_slot public.coordinated_meeting_slots%ROWTYPE;
BEGIN
  IF p_meeting_id IS NULL OR p_slot_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid');
  END IF;

  SELECT * INTO v_m
  FROM public.coordinated_meetings
  WHERE id = p_meeting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not found');
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM v_m.host_id) THEN
    RETURN json_build_object('ok', false, 'error', 'not allowed');
  END IF;

  IF v_m.status IN ('confirmed', 'cancelled') THEN
    RETURN json_build_object('ok', false, 'error', 'already closed', 'status', v_m.status);
  END IF;

  SELECT * INTO v_slot
  FROM public.coordinated_meeting_slots
  WHERE id = p_slot_id AND meeting_id = p_meeting_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'invalid slot');
  END IF;

  UPDATE public.coordinated_meetings
  SET
    status = 'confirmed',
    confirmed_time = v_slot.start_time,
    updated_at = now()
  WHERE id = p_meeting_id;

  UPDATE public.coordinated_meeting_participants
  SET
    confirmed = true,
    response_status = 'confirmed'
  WHERE meeting_id = p_meeting_id
    AND opted_out IS NOT TRUE;

  RETURN json_build_object(
    'ok', true,
    'status', 'confirmed',
    'confirmed_time', v_slot.start_time,
    'end_time', v_slot.end_time
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lock_coordination_slot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_coordination_slot(uuid, uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.coordination_assert_participant_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coordination_unanimous_slot_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coordination_all_active_responded(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
