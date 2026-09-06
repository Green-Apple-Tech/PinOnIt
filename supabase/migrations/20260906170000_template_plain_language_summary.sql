-- Plain-language summary cache on Sign-by-Text TEMPLATES only (not uploaded PDFs).

ALTER TABLE public.host_document_templates
  ADD COLUMN IF NOT EXISTS plain_language_summary text,
  ADD COLUMN IF NOT EXISTS plain_language_source_hash text,
  ADD COLUMN IF NOT EXISTS plain_language_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS plain_language_truncated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.host_document_templates.plain_language_summary IS
  'Cached plain-language bullets (newline-separated). Not part of the signed audit record.';
COMMENT ON COLUMN public.host_document_templates.plain_language_source_hash IS
  'SHA-256 of full_text used to generate plain_language_summary; skip regen when unchanged.';
COMMENT ON COLUMN public.host_document_templates.plain_language_enabled IS
  'When false, signing page omits the plain-language block for documents using this template.';
COMMENT ON COLUMN public.host_document_templates.plain_language_truncated IS
  'True when the source text was truncated (~10k words) before summarizing.';

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS plain_language_summary text,
  ADD COLUMN IF NOT EXISTS plain_language_source_hash text,
  ADD COLUMN IF NOT EXISTS plain_language_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS plain_language_truncated boolean NOT NULL DEFAULT false;

-- Copied onto the document at send time for display only (never hashed into the certificate).
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS plain_language_summary text,
  ADD COLUMN IF NOT EXISTS plain_language_truncated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.documents.plain_language_summary IS
  'Display-only plain-language bullets copied from the template at send. Not part of the signed audit/certificate.';

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
    )
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

NOTIFY pgrst, 'reload schema';
