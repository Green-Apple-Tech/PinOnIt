-- Liability waiver: 5th document type + per-send custom legal text.
-- Original 20260831180000 already applied live; this is additive.

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_document_type_check;
ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_document_type_check
  CHECK (document_type IN ('nda', 'invoice', 'contract', 'receipt', 'waiver'));

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN ('nda', 'invoice', 'contract', 'receipt', 'waiver'));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS custom_text text;

INSERT INTO public.document_templates (name, document_type, confirmation_type, summary_text, full_text)
SELECT * FROM (VALUES
  (
    'Liability waiver',
    'waiver',
    'sign',
    'This liability waiver applies to the activity described in the topic. Signing it means you have read the waiver language and accept the risks described.',
    'REPLACE THIS TEXT WITH YOUR OWN LIABILITY WAIVER LANGUAGE, REVIEWED BY AN ATTORNEY FOR YOUR STATE AND YOUR SPECIFIC ACTIVITY. Liability waiver enforceability varies by state and by activity — many states will not enforce waivers for gross negligence, and some states specifically restrict or void waivers for gyms/fitness facilities, amusement activities, employment relationships, or waivers signed on behalf of minors. This starter text is not legal advice. Have an attorney review your waiver for your state and industry before relying on it.'
  )
) AS seed(name, document_type, confirmation_type, summary_text, full_text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates t WHERE t.document_type = seed.document_type
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
    'full_text', COALESCE(NULLIF(btrim(d.custom_text), ''), t.full_text)
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
