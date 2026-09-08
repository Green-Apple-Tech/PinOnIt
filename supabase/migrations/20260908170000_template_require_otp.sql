-- Per-template SMS OTP (require_otp). Quotes/invoices default off.
-- Signing still requires ESIGN consent + signature; OTP is optional attribution.

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS require_otp boolean;

ALTER TABLE public.host_document_templates
  ADD COLUMN IF NOT EXISTS require_otp boolean;

COMMENT ON COLUMN public.document_templates.require_otp IS
  'Default SMS one-time-code requirement for this built-in template. NULL = use type default.';
COMMENT ON COLUMN public.host_document_templates.require_otp IS
  'Host override for SMS OTP. NULL = use built-in template / type default.';

UPDATE public.document_templates
SET require_otp = CASE
  WHEN document_type IN (
    'nda', 'waiver', 'contract', 'quick_addendum', 'consent_form',
    'photo_video_release', 'rental_agreement', 'service_agreement',
    'credit_card_authorization', 'recurring_service_authorization',
    'property_access_authorization', 'upload'
  ) THEN true
  ELSE false
END
WHERE require_otp IS NULL;

CREATE OR REPLACE FUNCTION public.issue_document_otp(p_token text, p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.documents%ROWTYPE;
  v_code text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token required');
  END IF;

  SELECT * INTO v_row
  FROM public.documents
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not found');
  END IF;

  IF COALESCE(v_row.verification_required, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SMS verification is not required for this document', 'send', false);
  END IF;

  IF v_row.status = 'signed' OR v_row.status = 'paid' OR v_row.otp_verified THEN
    RETURN jsonb_build_object('ok', true, 'already_verified', true, 'send', false);
  END IF;

  IF p_force AND v_row.otp_issued_at IS NOT NULL AND v_row.otp_issued_at > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please wait a few seconds before requesting a new code');
  END IF;

  IF NOT p_force
     AND v_row.otp_code IS NOT NULL
     AND v_row.otp_expires_at IS NOT NULL
     AND v_row.otp_expires_at > now() THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_verified', false,
      'send', false,
      'recipient_name', v_row.recipient_name
    );
  END IF;

  v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');

  UPDATE public.documents
  SET
    otp_code = v_code,
    otp_expires_at = now() + interval '10 minutes',
    otp_issued_at = now(),
    otp_attempts = 0
  WHERE token = p_token;

  RETURN jsonb_build_object(
    'ok', true,
    'already_verified', false,
    'send', true,
    'code', v_code,
    'recipient_name', v_row.recipient_name,
    'recipient_phone', v_row.recipient_phone
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_document_event(
  p_token text,
  p_action text,
  p_signature_data text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_esign_consent_text text DEFAULT NULL,
  p_document_snapshot_text text DEFAULT NULL,
  p_document_sha256 text DEFAULT NULL,
  p_timezone text DEFAULT NULL
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

  -- OTP only when this send asked for it. Never treat skipped OTP as verified.
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
    timezone_at_sign = COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), timezone_at_sign)
  WHERE token = p_token
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'status', 'signed', 'id', v_row.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_document_otp(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text, text, text, text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
