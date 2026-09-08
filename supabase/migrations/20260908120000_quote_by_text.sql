-- Quote-by-Text: expiry, declined/paid, pay mode, logo on public RPC.
-- Guest path stays SECURITY DEFINER (get_document_by_token / record_document_event).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_quote_valid_days integer NOT NULL DEFAULT 30;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS pay_mode text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS pay_amount_cents integer;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_pay_mode_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_pay_mode_check
  CHECK (pay_mode IN ('off', 'full', 'deposit'));

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.documents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      AND pg_get_constraintdef(c.oid) ILIKE '%pending%'
      AND pg_get_constraintdef(c.oid) ILIKE '%viewed%'
  LOOP
    EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('pending', 'viewed', 'signed', 'declined', 'paid'));

CREATE OR REPLACE FUNCTION public.get_document_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', d.id,
    'token', d.token,
    'recipient_name', d.recipient_name,
    'document_type', d.document_type,
    'document_type_custom', d.document_type_custom,
    'template_id', d.template_id,
    'topic', d.topic,
    'status', d.status,
    'otp_verified', d.otp_verified,
    'created_at', d.created_at,
    'viewed_at', d.viewed_at,
    'signed_at', d.signed_at,
    'confirmation_type', t.confirmation_type,
    'template_name', t.name,
    'summary_text', t.summary_text,
    'full_text', COALESCE(NULLIF(btrim(d.custom_text), ''), t.full_text),
    'verification_required', d.verification_required,
    'line_items', d.line_items,
    'tax_percent', d.tax_percent,
    'notes', d.notes,
    'pay_elsewhere_url', d.pay_elsewhere_url,
    'pay_elsewhere_label', d.pay_elsewhere_label,
    'pay_mode', d.pay_mode,
    'pay_amount_cents', d.pay_amount_cents,
    'currency', d.currency,
    'valid_until', d.valid_until,
    'expired', (d.valid_until IS NOT NULL AND d.valid_until < now()),
    'file_path', d.file_path,
    'file_name', d.file_name,
    'file_size_bytes', d.file_size_bytes,
    'plain_language_summary', CASE
      WHEN d.file_path IS NOT NULL THEN NULL
      ELSE NULLIF(btrim(d.plain_language_summary), '')
    END,
    'plain_language_truncated', CASE
      WHEN d.file_path IS NOT NULL THEN false
      ELSE COALESCE(d.plain_language_truncated, false)
    END,
    'sender_business_name', COALESCE(
      NULLIF(btrim(pr.business_name), ''),
      NULLIF(btrim(pr.paid_booking_settings->>'display_name'), ''),
      NULLIF(btrim(pr.full_name), '')
    ),
    'sender_logo_url', NULLIF(btrim(pr.avatar_url), '')
  )
  INTO result
  FROM public.documents d
  JOIN public.document_templates t ON t.id = d.template_id
  LEFT JOIN public.profiles pr ON pr.id = d.sender_id
  WHERE d.token = p_token
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon, authenticated;

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

  IF COALESCE(v_row.verification_required, true) THEN
    IF NOT v_row.otp_verified THEN
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

GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text, text, text, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_quote_paid(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.documents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  SELECT * INTO v_row
  FROM public.documents
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND OR v_row.sender_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not found');
  END IF;

  IF v_row.document_type IS DISTINCT FROM 'quote' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not a quote');
  END IF;

  IF v_row.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'paid', 'already', true);
  END IF;

  IF v_row.status IS DISTINCT FROM 'signed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'approve first');
  END IF;

  UPDATE public.documents
  SET status = 'paid', paid_at = now()
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true, 'status', 'paid');
END;
$$;

REVOKE ALL ON FUNCTION public.mark_quote_paid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_quote_paid(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
