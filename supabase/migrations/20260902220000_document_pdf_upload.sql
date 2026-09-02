-- Upload-to-sign: PDF attachment on documents + storage bucket (simple OTP + finger sign).
-- No hash/seal/certificate in this version.

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_document_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN (
    'nda', 'invoice', 'contract', 'receipt', 'waiver', 'quote',
    'work_order', 'change_order', 'service_agreement', 'scope_of_work',
    'consent_form', 'cancellation_policy', 'credit_card_authorization',
    'recurring_service_authorization', 'property_access_authorization',
    'key_access_receipt', 'inspection_acknowledgment', 'completion_sign_off',
    'delivery_acceptance', 'damage_condition_report', 'rental_agreement',
    'photo_video_release', 'parent_minor_consent', 'emergency_authorization',
    'walkthrough', 'showing_acknowledgment', 'repair_confirmation',
    'maintenance_approval', 'other', 'upload'
  ));

ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_document_type_check
  CHECK (document_type IN (
    'nda', 'invoice', 'contract', 'receipt', 'waiver', 'quote',
    'work_order', 'change_order', 'service_agreement', 'scope_of_work',
    'consent_form', 'cancellation_policy', 'credit_card_authorization',
    'recurring_service_authorization', 'property_access_authorization',
    'key_access_receipt', 'inspection_acknowledgment', 'completion_sign_off',
    'delivery_acceptance', 'damage_condition_report', 'rental_agreement',
    'photo_video_release', 'parent_minor_consent', 'emergency_authorization',
    'walkthrough', 'showing_acknowledgment', 'repair_confirmation',
    'maintenance_approval', 'other', 'upload'
  ));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size_bytes integer;

COMMENT ON COLUMN public.documents.file_path IS
  'Storage path in document-files bucket for uploaded PDFs (upload document type).';

INSERT INTO public.document_templates (name, document_type, confirmation_type, summary_text, full_text)
SELECT * FROM (VALUES
  (
    'Uploaded PDF',
    'upload',
    'sign',
    'Review the attached PDF, verify your phone, and sign with your finger.',
    'Please review the attached PDF carefully. By signing, you confirm you have reviewed this document and agree to sign it electronically.'
  )
) AS seed(name, document_type, confirmation_type, summary_text, full_text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates t WHERE t.document_type = seed.document_type
);

-- Private-ish public bucket: URL is unguessable (token in path). No directory listing.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-files',
  'document-files',
  true,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users upload own document files" ON storage.objects;
CREATE POLICY "Users upload own document files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'document-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own document files" ON storage.objects;
CREATE POLICY "Users update own document files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'document-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own document files" ON storage.objects;
CREATE POLICY "Users delete own document files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'document-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read document files by path" ON storage.objects;
CREATE POLICY "Public read document files by path"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'document-files'
    AND name IS NOT NULL
    AND length(name) > 0
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
    'currency', d.currency,
    'file_path', d.file_path,
    'file_name', d.file_name,
    'file_size_bytes', d.file_size_bytes
  )
  INTO result
  FROM public.documents d
  JOIN public.document_templates t ON t.id = d.template_id
  WHERE d.token = p_token
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
