-- Dedicated business / company name for Doc Center “[Business Name]” and branding.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name text;

COMMENT ON COLUMN public.profiles.business_name IS
  'Public business/company name used on Doc Center documents (replaces personal full_name in [Business Name]).';

-- Best-effort backfill from Paid Booking display_name when present.
UPDATE public.profiles p
SET business_name = NULLIF(btrim(p.paid_booking_settings->>'display_name'), '')
WHERE (p.business_name IS NULL OR btrim(p.business_name) = '')
  AND NULLIF(btrim(p.paid_booking_settings->>'display_name'), '') IS NOT NULL;

-- Expose sender business name to recipients so leftover [Business Name] placeholders can fill.
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
