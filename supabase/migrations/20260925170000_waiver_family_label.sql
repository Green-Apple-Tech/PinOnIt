-- Rename the family waiver template and cap one signature at 10 people.

UPDATE public.document_templates
SET
  name = 'Waiver (family)',
  summary_text = 'One signature covers up to 10 people. Add each name and birthday.'
WHERE document_type = 'parental_consent_waiver'
  AND name = 'Waiver with Parental Consent';

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

  IF COALESCE(v_row.verification_required, false) AND NOT v_row.otp_verified THEN
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

  IF v_row.document_type = 'parental_consent_waiver' AND p_participants IS NOT NULL THEN
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

  RETURN jsonb_build_object('ok', true, 'status', 'signed', 'id', v_row.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text, text, text, text, text, text, text, text, jsonb)
  TO anon, authenticated;
