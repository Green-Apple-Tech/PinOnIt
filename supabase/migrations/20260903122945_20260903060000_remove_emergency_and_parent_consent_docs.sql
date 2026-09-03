/*
# Remove Emergency Authorization and Parent/Minor Consent document types

1. Changes
- Removes 'parent_minor_consent' and 'emergency_authorization' from the CHECK
  constraints on both `documents.document_type` and `document_templates.document_type`.
- Deletes the seeded starter templates for those two types (if present).
- No existing user-created documents are deleted — only the catalog entries and
  constraint values change. Any rows already using these types remain intact;
  the constraint only governs new inserts/updates.

2. Security
- No RLS or policy changes.
*/

DELETE FROM public.document_templates
WHERE document_type IN ('parent_minor_consent', 'emergency_authorization');

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN (
    'nda', 'invoice', 'contract', 'receipt', 'waiver', 'quote',
    'work_order', 'change_order', 'service_agreement', 'scope_of_work',
    'consent_form', 'cancellation_policy', 'credit_card_authorization',
    'recurring_service_authorization', 'property_access_authorization',
    'key_access_receipt', 'inspection_acknowledgment', 'completion_sign_off',
    'delivery_acceptance', 'damage_condition_report', 'rental_agreement',
    'photo_video_release',
    'walkthrough', 'showing_acknowledgment', 'repair_confirmation',
    'maintenance_approval', 'other', 'upload', 'quick_addendum'
  ));

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_document_type_check;

ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_document_type_check
  CHECK (document_type IN (
    'nda', 'invoice', 'contract', 'receipt', 'waiver', 'quote',
    'work_order', 'change_order', 'service_agreement', 'scope_of_work',
    'consent_form', 'cancellation_policy', 'credit_card_authorization',
    'recurring_service_authorization', 'property_access_authorization',
    'key_access_receipt', 'inspection_acknowledgment', 'completion_sign_off',
    'delivery_acceptance', 'damage_condition_report', 'rental_agreement',
    'photo_video_release',
    'walkthrough', 'showing_acknowledgment', 'repair_confirmation',
    'maintenance_approval', 'other', 'upload', 'quick_addendum'
  ));

NOTIFY pgrst, 'reload schema';
