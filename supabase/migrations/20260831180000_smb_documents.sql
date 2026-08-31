-- SMB Documents: NDAs, invoices, contracts, receipts with token + SMS OTP.
-- Adapted from NDAPP token RPCs; ownership uses auth.uid() like other PinOnIt host tables.
-- Enums are text + CHECK (PinOnIt convention). No direct anon table access on documents.

CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('nda', 'invoice', 'contract', 'receipt')),
  confirmation_type text NOT NULL CHECK (confirmation_type IN ('sign', 'approve', 'confirm_receipt')),
  summary_text text NOT NULL,
  full_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_templates_type_name_idx
  ON public.document_templates (document_type, name);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read document templates" ON public.document_templates;
CREATE POLICY "Authenticated can read document templates"
  ON public.document_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('nda', 'invoice', 'contract', 'receipt')),
  template_id uuid NOT NULL REFERENCES public.document_templates (id),
  topic text NOT NULL CHECK (char_length(topic) > 0 AND char_length(topic) <= 150),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'signed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  signed_at timestamptz,
  signature_data text,
  ip_address text,
  user_agent text,
  otp_verified boolean NOT NULL DEFAULT false,
  otp_verified_at timestamptz,
  otp_code text,
  otp_expires_at timestamptz,
  otp_issued_at timestamptz,
  otp_attempts integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS documents_sender_id_idx ON public.documents (sender_id);
CREATE INDEX IF NOT EXISTS documents_token_idx ON public.documents (token);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON public.documents (created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own documents" ON public.documents;
CREATE POLICY "Hosts manage own documents"
  ON public.documents
  FOR ALL
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.documents FROM anon;

-- Seed one template per document type (placeholder copy; refine later)
INSERT INTO public.document_templates (name, document_type, confirmation_type, summary_text, full_text)
SELECT * FROM (VALUES
  (
    'Mutual NDA',
    'nda',
    'sign',
    'This is a mutual non-disclosure agreement. Both sides agree to keep the shared business information confidential and use it only to evaluate a possible working relationship.',
    'MUTUAL NON-DISCLOSURE AGREEMENT (placeholder)

The parties agree to keep confidential information secret, not to use it except to evaluate a business relationship, and to protect it with reasonable care. Obligations last two years from the date of electronic signature. This is boilerplate pending legal review.'
  ),
  (
    'Standard invoice',
    'invoice',
    'approve',
    'This invoice lists the work or goods described in the topic. Approving it confirms you have reviewed the amounts and terms shown.',
    'INVOICE ACKNOWLEDGEMENT (placeholder)

By approving this invoice you confirm you have reviewed the described charges. Payment terms, if any, are between you and the sender. This is boilerplate pending legal review.'
  ),
  (
    'Simple contract',
    'contract',
    'sign',
    'This contract covers the work or agreement described in the topic. Signing it means you have read the terms and agree to be bound by them.',
    'SERVICE / BUSINESS CONTRACT (placeholder)

The parties agree to the scope described in the topic. Either party should keep a copy. Electronic signature is intended to have the same effect as a handwritten signature. This is boilerplate pending legal review.'
  ),
  (
    'Receipt confirmation',
    'receipt',
    'confirm_receipt',
    'This receipt confirms you received the goods or services described in the topic. Confirming it is an acknowledgement, not a new charge.',
    'RECEIPT ACKNOWLEDGEMENT (placeholder)

By confirming this receipt you acknowledge you received the described goods or services. This is boilerplate pending legal review.'
  )
) AS seed(name, document_type, confirmation_type, summary_text, full_text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates t WHERE t.document_type = seed.document_type
);

CREATE OR REPLACE FUNCTION public.document_request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  headers json;
BEGIN
  BEGIN
    headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  IF headers IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN NULLIF(btrim(COALESCE(
    split_part(headers->>'x-forwarded-for', ',', 1),
    headers->>'cf-connecting-ip',
    headers->>'x-real-ip'
  )), '');
END;
$$;

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
    'full_text', t.full_text
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

  IF NOT v_row.otp_verified THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone verification required');
  END IF;

  IF v_confirm IS DISTINCT FROM 'confirm_receipt'
     AND (p_signature_data IS NULL OR btrim(p_signature_data) = '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'signature required');
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

  IF v_row.status = 'signed' OR v_row.otp_verified THEN
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

CREATE OR REPLACE FUNCTION public.verify_document_otp(p_token text, p_code text)
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

  v_code := regexp_replace(COALESCE(p_code, ''), '\D', '', 'g');

  SELECT * INTO v_row
  FROM public.documents
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not found');
  END IF;

  IF v_row.otp_verified THEN
    RETURN jsonb_build_object('ok', true, 'already_verified', true);
  END IF;

  IF v_row.otp_code IS NULL OR v_row.otp_expires_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No code has been sent yet');
  END IF;

  IF v_row.otp_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code has expired. Request a new one.');
  END IF;

  IF v_row.otp_attempts >= 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many attempts. Request a new code.');
  END IF;

  IF v_code IS NULL OR length(v_code) <> 6 OR v_code IS DISTINCT FROM v_row.otp_code THEN
    UPDATE public.documents SET otp_attempts = otp_attempts + 1 WHERE token = p_token;
    RETURN jsonb_build_object('ok', false, 'error', 'That code is incorrect');
  END IF;

  UPDATE public.documents
  SET
    otp_verified = true,
    otp_verified_at = now(),
    otp_code = NULL
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true, 'already_verified', false);
END;
$$;

REVOKE ALL ON FUNCTION public.document_request_ip() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_document_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_document_event(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_document_otp(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_document_otp(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_document_otp(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_document_otp(text, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
