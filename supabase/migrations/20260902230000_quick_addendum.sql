-- Quick Addendum document type (Sign by Text catalog).

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
    'maintenance_approval', 'other', 'upload', 'quick_addendum'
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
    'maintenance_approval', 'other', 'upload', 'quick_addendum'
  ));

INSERT INTO public.document_templates (name, document_type, confirmation_type, summary_text, full_text)
SELECT * FROM (VALUES
  (
    'Quick addendum',
    'quick_addendum',
    'sign',
    'This addendum updates or clarifies the agreement described below. Signing confirms you have reviewed and agree to these terms.',
    'QUICK ADDENDUM

Prepared for: [Recipient Name]

This addendum from [Business Name] regards: [Activity/Service Description].

By signing, you confirm you have reviewed this addendum and agree to the terms described. This addendum is intended to supplement any related agreement between the parties. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice. Consult an attorney for high-risk or regulated transactions.'
  )
) AS seed(name, document_type, confirmation_type, summary_text, full_text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates t WHERE t.document_type = seed.document_type
);

NOTIFY pgrst, 'reload schema';
