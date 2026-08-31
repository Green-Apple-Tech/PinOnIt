-- Doc Center: quote type, per-send verification toggle, money fields, migrate host_quotes.
-- host_quotes is kept (0 live rows today; table stays as fallback for /q/:token).

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_document_type_check;
ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_document_type_check
  CHECK (document_type IN ('nda', 'invoice', 'contract', 'receipt', 'waiver', 'quote'));

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN ('nda', 'invoice', 'contract', 'receipt', 'waiver', 'quote'));

ALTER TABLE public.documents
  ALTER COLUMN recipient_phone DROP NOT NULL;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS verification_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS tax_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS pay_elsewhere_url text;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS pay_elsewhere_label text;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

UPDATE public.documents
SET verification_required = (document_type IN ('nda', 'contract', 'waiver'))
WHERE verification_required IS DISTINCT FROM (document_type IN ('nda', 'contract', 'waiver'));

INSERT INTO public.document_templates (name, document_type, confirmation_type, summary_text, full_text)
SELECT * FROM (VALUES
  (
    'Standard quote',
    'quote',
    'approve',
    'This quote lists the work or goods described. It is an estimate, not a charge.',
    'QUOTE (placeholder)

This quote is an estimate for the described work or goods. Amounts and pay-elsewhere links are between you and the sender. This is boilerplate pending legal review.'
  )
) AS seed(name, document_type, confirmation_type, summary_text, full_text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates t WHERE t.document_type = seed.document_type
);

INSERT INTO public.documents (
  token, sender_id, recipient_name, recipient_phone, recipient_email,
  document_type, template_id, topic, status, verification_required,
  line_items, tax_percent, notes, pay_elsewhere_url, pay_elsewhere_label, currency
)
SELECT
  q.token,
  q.host_id,
  COALESCE(NULLIF(btrim(q.client_name), ''), 'Client'),
  NULLIF(btrim(q.client_phone), ''),
  NULLIF(btrim(q.client_email), ''),
  q.kind,
  t.id,
  COALESCE(NULLIF(btrim(q.notes), ''), initcap(q.kind)),
  'pending',
  false,
  COALESCE(q.line_items, '[]'::jsonb),
  COALESCE(q.tax_percent, 0),
  q.notes,
  q.pay_elsewhere_url,
  q.pay_elsewhere_label,
  COALESCE(q.currency, 'USD')
FROM public.host_quotes q
JOIN public.document_templates t ON t.document_type = q.kind
WHERE NOT EXISTS (
  SELECT 1 FROM public.documents d WHERE d.token = q.token
);

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
    'currency', d.currency
  )
  INTO result
  FROM public.documents d
  JOIN public.document_templates t ON t.id = d.template_id
  WHERE d.token = p_token
  LIMIT 1;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_document_event(
  p_token text,
  p_action text,
  p_signature_data text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
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
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token required');
  END IF;

  IF p_action NOT IN ('viewed', 'signed') THEN
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
    RETURN jsonb_build_object('ok', true, 'status', 'viewed');
  END IF;

  IF v_row.status = 'signed' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'signed');
  END IF;

  IF COALESCE(v_row.verification_required, true) THEN
    IF NOT v_row.otp_verified THEN
      RETURN jsonb_build_object('ok', false, 'error', 'phone verification required');
    END IF;

    IF v_confirm IS DISTINCT FROM 'confirm_receipt'
       AND (p_signature_data IS NULL OR btrim(p_signature_data) = '') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'signature required');
    END IF;
  END IF;

  UPDATE public.documents
  SET
    status = 'signed',
    signed_at = now(),
    signature_data = COALESCE(NULLIF(btrim(p_signature_data), ''), signature_data, 'confirmed'),
    ip_address = COALESCE(v_ip, ip_address),
    user_agent = COALESCE(v_ua, user_agent)
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true, 'status', 'signed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
