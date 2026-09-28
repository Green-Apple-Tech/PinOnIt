-- Store extra people on a boat waiver, and keep the same link open for the next guest.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS parent_guardian_name text,
  ADD COLUMN IF NOT EXISTS parent_guardian_email text,
  ADD COLUMN IF NOT EXISTS parental_consent_text text;



CREATE TABLE IF NOT EXISTS public.document_waiver_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_waiver_participants_doc_idx
  ON public.document_waiver_participants (document_id);

ALTER TABLE public.document_waiver_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_waiver_participants FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.document_waiver_participants TO service_role;

DROP FUNCTION IF EXISTS public.record_document_event(text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.record_document_event(
  p_token text,
  p_action text,
  p_signature_data text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_esign_consent_text text DEFAULT NULL,
  p_document_snapshot_text text DEFAULT NULL,
  p_document_sha256 text DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_parent_guardian_name text DEFAULT NULL,
  p_parent_guardian_email text DEFAULT NULL,
  p_parental_consent_text text DEFAULT NULL,
  p_participants jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.documents%ROWTYPE;
  v_confirm text;
  v_ip text;
  v_ua text;
  v_consent text;
  v_snapshot text;
  v_hash text;
  v_reason text;
  v_part jsonb;
  v_name text;
  v_dob date;
  v_idx int := 0;
  v_copy_id uuid;
  v_signer text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token required');
  END IF;

  IF p_action NOT IN ('viewed', 'signed', 'declined') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid action');
  END IF;

  SELECT * INTO v_row
  FROM public.documents
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not found');
  END IF;

  SELECT t.confirmation_type INTO v_confirm
  FROM public.document_templates t
  WHERE t.id = v_row.template_id;

  v_ip := COALESCE(public.document_request_ip(), NULLIF(btrim(COALESCE(p_ip, '')), ''));
  v_ua := NULLIF(btrim(COALESCE(p_user_agent, '')), '');

  IF p_action = 'viewed' THEN
    IF v_row.status = 'pending' THEN
      UPDATE public.documents
      SET
        status = 'viewed',
        viewed_at = now(),
        ip_address = COALESCE(v_ip, ip_address),
        user_agent = COALESCE(v_ua, user_agent)
      WHERE token = p_token;
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', CASE WHEN v_row.status = 'pending' THEN 'viewed' ELSE v_row.status END);
  END IF;

  IF v_row.status IN ('signed', 'paid') AND p_action = 'signed' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_row.status, 'id', v_row.id);
  END IF;

  IF v_row.status = 'declined' AND p_action = 'declined' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'declined', 'id', v_row.id);
  END IF;

  IF v_row.valid_until IS NOT NULL AND v_row.valid_until < now() AND p_action = 'signed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote expired');
  END IF;

  IF p_action = 'declined' THEN
    IF v_row.status IN ('signed', 'paid') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already approved');
    END IF;
    v_reason := NULLIF(btrim(COALESCE(p_signature_data, '')), '');
    UPDATE public.documents
    SET
      status = 'declined',
      declined_at = now(),
      decline_reason = v_reason,
      ip_address = COALESCE(v_ip, ip_address),
      user_agent = COALESCE(v_ua, user_agent)
    WHERE token = p_token;
    RETURN jsonb_build_object('ok', true, 'status', 'declined');
  END IF;

  -- A boat link is shared. Each guest types their name and signs. No code to one phone.
  IF COALESCE(v_row.verification_required, false)
     AND NOT v_row.otp_verified
     AND v_row.document_type IS DISTINCT FROM 'boat_waiver' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone verification required');
  END IF;

  v_consent := NULLIF(btrim(COALESCE(p_esign_consent_text, '')), '');
  IF v_consent IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'electronic consent required');
  END IF;

  IF v_confirm IS DISTINCT FROM 'confirm_receipt'
     AND (p_signature_data IS NULL OR btrim(p_signature_data) = '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'signature required');
  END IF;

  IF v_row.document_type = 'parental_consent_waiver' THEN
    IF NULLIF(btrim(COALESCE(p_parent_guardian_name, '')), '') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'parent name required');
    END IF;
    IF p_participants IS NULL OR jsonb_typeof(p_participants) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_participants) < 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'at least one person is required');
    END IF;
    IF jsonb_array_length(p_participants) > 10 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'too many people');
    END IF;
  END IF;

  IF v_row.document_type = 'boat_waiver'
     AND p_participants IS NOT NULL
     AND jsonb_typeof(p_participants) = 'array'
     AND jsonb_array_length(p_participants) > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too many people');
  END IF;

  v_snapshot := NULLIF(btrim(COALESCE(p_document_snapshot_text, '')), '');
  v_hash := lower(NULLIF(btrim(COALESCE(p_document_sha256, '')), ''));

  UPDATE public.documents
  SET
    status = 'signed',
    signed_at = now(),
    document_agreed_at = now(),
    signature_data = COALESCE(NULLIF(btrim(p_signature_data), ''), signature_data, 'confirmed'),
    ip_address = COALESCE(v_ip, ip_address),
    user_agent = COALESCE(v_ua, user_agent),
    esign_consent_text = COALESCE(v_consent, esign_consent_text),
    esign_consent_at = CASE WHEN v_consent IS NOT NULL THEN now() ELSE esign_consent_at END,
    document_snapshot_text = COALESCE(v_snapshot, document_snapshot_text),
    document_sha256 = COALESCE(v_hash, document_sha256),
    timezone_at_sign = COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), timezone_at_sign),
    parent_guardian_name = COALESCE(NULLIF(btrim(COALESCE(p_parent_guardian_name, '')), ''), parent_guardian_name),
    parent_guardian_email = COALESCE(NULLIF(btrim(COALESCE(p_parent_guardian_email, '')), ''), parent_guardian_email),
    parental_consent_text = COALESCE(NULLIF(btrim(COALESCE(p_parental_consent_text, '')), ''), parental_consent_text)
  WHERE token = p_token
  RETURNING * INTO v_row;

  IF v_row.document_type IN ('parental_consent_waiver', 'boat_waiver')
     AND p_participants IS NOT NULL
     AND jsonb_typeof(p_participants) = 'array'
     AND jsonb_array_length(p_participants) > 0 THEN
    DELETE FROM public.document_waiver_participants WHERE document_id = v_row.id;
    FOR v_part IN SELECT value FROM jsonb_array_elements(p_participants)
    LOOP
      v_name := NULLIF(btrim(COALESCE(v_part->>'full_name', v_part->>'fullName', '')), '');
      BEGIN
        v_dob := NULLIF(btrim(COALESCE(v_part->>'date_of_birth', v_part->>'dateOfBirth', '')), '')::date;
      EXCEPTION WHEN others THEN
        v_dob := NULL;
      END;
      IF v_name IS NULL OR v_dob IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'each person needs a name and date of birth');
      END IF;
      INSERT INTO public.document_waiver_participants (document_id, full_name, date_of_birth, sort_order)
      VALUES (v_row.id, v_name, v_dob, v_idx);
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  -- One boat link stays open. This signature is saved as its own copy.
  -- The next person, if they are not in this group, uses the same link.
  IF v_row.document_type = 'boat_waiver'
     AND COALESCE(v_row.document_type_custom, '') IS DISTINCT FROM 'boat-waiver-signed-copy' THEN
    v_copy_id := gen_random_uuid();
    v_signer := NULLIF(substring(COALESCE(v_row.document_snapshot_text, '') from 'Participant/Guest Full Name: ([^\r\n]+)'), '');
    INSERT INTO public.documents
    SELECT (jsonb_populate_record(
      NULL::public.documents,
      to_jsonb(v_row) || jsonb_build_object(
        'id', v_copy_id,
        'token', encode(extensions.gen_random_bytes(16), 'hex'),
        'recipient_name', COALESCE(v_signer, v_row.recipient_name),
        'document_type_custom', 'boat-waiver-signed-copy',
        'created_at', now()
      )
    )).*;

    UPDATE public.document_waiver_participants
    SET document_id = v_copy_id
    WHERE document_id = v_row.id;

    UPDATE public.documents
    SET
      status = 'pending',
      signed_at = NULL,
      signature_data = NULL,
      document_snapshot_text = NULL,
      document_sha256 = NULL,
      viewed_at = NULL,
      otp_verified = false,
      otp_verified_at = NULL,
      otp_code = NULL,
      otp_expires_at = NULL,
      otp_issued_at = NULL,
      otp_attempts = 0,
      document_agreed_at = NULL,
      esign_consent_text = NULL,
      esign_consent_at = NULL,
      ip_address = NULL,
      user_agent = NULL,
      timezone_at_sign = NULL,
      parent_guardian_name = NULL,
      parent_guardian_email = NULL,
      parental_consent_text = NULL
    WHERE id = v_row.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'signed', 'id', COALESCE(v_copy_id, v_row.id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text, text, text, text, text, text, text, text, jsonb)
  TO anon, authenticated;

-- Older app builds call the 9-argument version. Keep that path working.
CREATE OR REPLACE FUNCTION public.record_document_event(
  p_token text,
  p_action text,
  p_signature_data text,
  p_ip text,
  p_user_agent text,
  p_esign_consent_text text,
  p_document_snapshot_text text,
  p_document_sha256 text,
  p_timezone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.record_document_event(
    p_token,
    p_action,
    p_signature_data,
    p_ip,
    p_user_agent,
    p_esign_consent_text,
    p_document_snapshot_text,
    p_document_sha256,
    p_timezone,
    NULL,
    NULL,
    NULL,
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text, text, text, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_document_waiver_participants(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT sender_id INTO v_sender
  FROM public.documents
  WHERE id = p_document_id;

  IF v_sender IS NULL OR v_sender IS DISTINCT FROM auth.uid() THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'full_name', full_name,
    'date_of_birth', date_of_birth,
    'sort_order', sort_order
  ) ORDER BY sort_order), '[]'::jsonb)
  INTO v_out
  FROM public.document_waiver_participants
  WHERE document_id = p_document_id;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_waiver_participants(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
