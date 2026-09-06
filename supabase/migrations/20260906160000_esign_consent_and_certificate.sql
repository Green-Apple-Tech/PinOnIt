-- ESIGN consent capture, document snapshot/hash, certificate retention for Sign-by-Text.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS esign_consent_text text,
  ADD COLUMN IF NOT EXISTS esign_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS document_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS document_snapshot_text text,
  ADD COLUMN IF NOT EXISTS document_sha256 text,
  ADD COLUMN IF NOT EXISTS certificate_path text,
  ADD COLUMN IF NOT EXISTS certificate_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS timezone_at_sign text;

COMMENT ON COLUMN public.documents.esign_consent_text IS
  'Verbatim ESIGN consent statement the signer affirmed (separate from document agreement).';
COMMENT ON COLUMN public.documents.esign_consent_at IS
  'When the signer affirmed ESIGN consent.';
COMMENT ON COLUMN public.documents.document_agreed_at IS
  'When the signer checked the document agreement checkbox.';
COMMENT ON COLUMN public.documents.document_snapshot_text IS
  'Exact document text (or PDF descriptor) as shown at signing.';
COMMENT ON COLUMN public.documents.document_sha256 IS
  'SHA-256 hex digest of document_snapshot_text (UTF-8).';
COMMENT ON COLUMN public.documents.certificate_path IS
  'Storage path in document-certificates bucket for the certificate of completion PDF.';
COMMENT ON COLUMN public.documents.certificate_generated_at IS
  'When the certificate PDF was generated.';
COMMENT ON COLUMN public.documents.timezone_at_sign IS
  'IANA timezone reported by the signer browser at signing (for audit display).';

-- Retention bucket: certificates survive account cancellation (no owner-folder delete cascade).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-certificates',
  'document-certificates',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Senders read own document certificates" ON storage.objects;
CREATE POLICY "Senders read own document certificates"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'document-certificates'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND d.sender_id = auth.uid()
    )
  );

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
    RETURN jsonb_build_object('ok', true, 'status', 'signed', 'id', v_row.id);
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

-- Drop old 5-arg overload if present so PostgREST binds the new signature.
DROP FUNCTION IF EXISTS public.record_document_event(text, text, text, text, text);

GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text, text, text, text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
