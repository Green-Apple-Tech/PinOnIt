-- Broaden document_type catalog (flat list, no industry categories).
-- Extends existing documents.document_type — does not add a second type field.
-- document_type_custom holds the label when type is 'other'.

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
    'maintenance_approval', 'other'
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
    'maintenance_approval', 'other'
  ));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type_custom text;

COMMENT ON COLUMN public.documents.document_type_custom IS
  'Custom label when document_type is other; otherwise null.';

-- Seed one starter template per new type (required for create flow).
INSERT INTO public.document_templates (name, document_type, confirmation_type, summary_text, full_text)
SELECT * FROM (VALUES
  (
    'Work order',
    'work_order',
    'approve',
    'This work order describes the work to be performed. Approving it confirms you have reviewed the described work.',
    'WORK ORDER

Prepared for: [Recipient Name]

This work order from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge that you have reviewed this work order. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Change order',
    'change_order',
    'approve',
    'This change order describes a change to previously agreed work. Approving it confirms you accept the change described.',
    'CHANGE ORDER

Prepared for: [Recipient Name]

This change order from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge that you have reviewed and accept this change. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Service agreement',
    'service_agreement',
    'sign',
    'This service agreement sets terms for the services described. Signing means you have read and agree to those terms.',
    'SERVICE AGREEMENT

Prepared for: [Recipient Name]

This service agreement from [Business Name] covers: [Activity/Service Description].

By signing, you acknowledge that you have read this agreement and agree to the terms described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice. Consult an attorney for high-risk or regulated transactions.'
  ),
  (
    'Scope of work',
    'scope_of_work',
    'approve',
    'This scope of work describes what is included. Approving it confirms you have reviewed the described scope.',
    'SCOPE OF WORK

Prepared for: [Recipient Name]

This scope of work from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge that you have reviewed the described scope. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Consent form',
    'consent_form',
    'sign',
    'This consent form records your consent for the matter described. Signing confirms you consent as stated.',
    'CONSENT FORM

Prepared for: [Recipient Name]

This consent form from [Business Name] covers: [Activity/Service Description].

By signing, you confirm that you consent as described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Cancellation policy',
    'cancellation_policy',
    'approve',
    'This cancellation policy explains cancel terms. Approving it confirms you have reviewed those terms.',
    'CANCELLATION POLICY ACKNOWLEDGMENT

Prepared for: [Recipient Name]

This cancellation policy from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge that you have reviewed the cancellation terms. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Credit card authorization',
    'credit_card_authorization',
    'sign',
    'This authorizes card charges as described. Signing confirms you authorize those charges.',
    'CREDIT CARD AUTHORIZATION

Prepared for: [Recipient Name]

This authorization for [Business Name] covers: [Activity/Service Description].

By signing, you authorize the card charges described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Recurring service authorization',
    'recurring_service_authorization',
    'sign',
    'This authorizes ongoing or recurring service as described. Signing confirms that authorization.',
    'RECURRING SERVICE AUTHORIZATION

Prepared for: [Recipient Name]

This authorization for [Business Name] covers: [Activity/Service Description].

By signing, you authorize the recurring service described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Property access authorization',
    'property_access_authorization',
    'sign',
    'This authorizes property access as described. Signing confirms that authorization.',
    'PROPERTY ACCESS AUTHORIZATION

Prepared for: [Recipient Name]

This authorization for [Business Name] covers: [Activity/Service Description].

By signing, you authorize property access as described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Key / access receipt',
    'key_access_receipt',
    'confirm_receipt',
    'This confirms keys or access credentials were received. Confirming is an acknowledgement, not a new charge.',
    'KEY / ACCESS RECEIPT

Prepared for: [Recipient Name]

This receipt from [Business Name] covers: [Activity/Service Description].

By confirming, you acknowledge receipt of the keys or access described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Inspection acknowledgment',
    'inspection_acknowledgment',
    'approve',
    'This acknowledges an inspection as described. Approving confirms you have reviewed that acknowledgment.',
    'INSPECTION ACKNOWLEDGMENT

Prepared for: [Recipient Name]

This acknowledgment from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge the inspection described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Completion / job sign-off',
    'completion_sign_off',
    'approve',
    'This confirms the job or work is complete. Approving is a sign-off on the work described.',
    'COMPLETION / JOB SIGN-OFF

Prepared for: [Recipient Name]

This sign-off for [Business Name] covers: [Activity/Service Description].

By approving, you confirm the work described is complete to your satisfaction as stated. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Delivery acceptance',
    'delivery_acceptance',
    'confirm_receipt',
    'This confirms acceptance of a delivery. Confirming is an acknowledgement of receipt.',
    'DELIVERY ACCEPTANCE

Prepared for: [Recipient Name]

This acceptance for [Business Name] covers: [Activity/Service Description].

By confirming, you acknowledge acceptance of the delivery described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Damage / condition report',
    'damage_condition_report',
    'approve',
    'This records damage or condition as described. Approving confirms you have reviewed the report.',
    'DAMAGE / CONDITION REPORT

Prepared for: [Recipient Name]

This report from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge the condition or damage described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Rental agreement',
    'rental_agreement',
    'sign',
    'This rental agreement sets terms for the rental described. Signing means you agree to those terms.',
    'RENTAL AGREEMENT

Prepared for: [Recipient Name]

This rental agreement from [Business Name] covers: [Activity/Service Description].

By signing, you agree to the rental terms described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice. Consult an attorney for high-risk rentals.'
  ),
  (
    'Photo / video release',
    'photo_video_release',
    'sign',
    'This release allows photo or video use as described. Signing confirms you grant that permission.',
    'PHOTO / VIDEO RELEASE

Prepared for: [Recipient Name]

This release for [Business Name] covers: [Activity/Service Description].

By signing, you grant permission for photo or video use as described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Parent / minor consent',
    'parent_minor_consent',
    'sign',
    'This records parent or guardian consent. Signing confirms consent as described.',
    'PARENT / MINOR CONSENT

Prepared for: [Recipient Name]

This consent form for [Business Name] covers: [Activity/Service Description].

By signing, you confirm parent or guardian consent as described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Emergency authorization',
    'emergency_authorization',
    'sign',
    'This authorizes emergency action as described. Signing confirms that authorization.',
    'EMERGENCY AUTHORIZATION

Prepared for: [Recipient Name]

This authorization for [Business Name] covers: [Activity/Service Description].

By signing, you authorize emergency action as described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Walkthrough / final walkthrough',
    'walkthrough',
    'approve',
    'This acknowledges a walkthrough. Approving confirms you completed or reviewed the walkthrough described.',
    'WALKTHROUGH ACKNOWLEDGMENT

Prepared for: [Recipient Name]

This acknowledgment from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge the walkthrough described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Showing acknowledgment',
    'showing_acknowledgment',
    'approve',
    'This acknowledges a property showing. Approving confirms you reviewed the showing acknowledgment.',
    'SHOWING ACKNOWLEDGMENT

Prepared for: [Recipient Name]

This acknowledgment from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge the showing described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Repair confirmation',
    'repair_confirmation',
    'approve',
    'This confirms repair work as described. Approving acknowledges the repair confirmation.',
    'REPAIR CONFIRMATION

Prepared for: [Recipient Name]

This confirmation from [Business Name] covers: [Activity/Service Description].

By approving, you acknowledge the repair work described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Maintenance approval',
    'maintenance_approval',
    'approve',
    'This approves maintenance work as described. Approving confirms you authorize that maintenance.',
    'MAINTENANCE APPROVAL

Prepared for: [Recipient Name]

This approval for [Business Name] covers: [Activity/Service Description].

By approving, you authorize the maintenance described. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
  ),
  (
    'Other document',
    'other',
    'approve',
    'This document is provided for your review. Approving or confirming acknowledges that you have reviewed it.',
    'DOCUMENT ACKNOWLEDGMENT

Prepared for: [Recipient Name]

This document from [Business Name] covers: [Activity/Service Description].

By confirming, you acknowledge that you have reviewed this document. Keep a copy for your records.

This is a general-purpose starting template. It is not legal advice.'
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

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
