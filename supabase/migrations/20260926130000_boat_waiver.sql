-- Boat waiver type. Guests fill the blanks on the sign page.

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN (
    'nda', 'invoice', 'contract', 'receipt', 'waiver', 'parental_consent_waiver', 'boat_waiver', 'quote',
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
    'nda', 'invoice', 'contract', 'receipt', 'waiver', 'parental_consent_waiver', 'boat_waiver', 'quote',
    'work_order', 'change_order', 'service_agreement', 'scope_of_work',
    'consent_form', 'cancellation_policy', 'credit_card_authorization',
    'recurring_service_authorization', 'property_access_authorization',
    'key_access_receipt', 'inspection_acknowledgment', 'completion_sign_off',
    'delivery_acceptance', 'damage_condition_report', 'rental_agreement',
    'photo_video_release',
    'walkthrough', 'showing_acknowledgment', 'repair_confirmation',
    'maintenance_approval', 'other', 'upload', 'quick_addendum'
  ));

ALTER TABLE public.host_document_templates
  DROP CONSTRAINT IF EXISTS host_document_templates_type_check;

ALTER TABLE public.host_document_templates
  ADD CONSTRAINT host_document_templates_type_check CHECK (document_type IN (
    'nda', 'contract', 'waiver', 'parental_consent_waiver', 'boat_waiver', 'quote', 'invoice', 'receipt', 'quick_addendum'
  ));

INSERT INTO public.document_templates (
  name, document_type, confirmation_type, summary_text, full_text, require_otp
)
SELECT
  'Waiver (boat)',
  'boat_waiver',
  'sign',
  'Guest fills in the vessel, outing date, and emergency contact, then signs once.',
  $boat$RECREATIONAL BOATING ASSUMPTION OF RISK, RELEASE & WAIVER

Vessel: [Vessel]
Vessel Owner/Operator: [Vessel Owner/Operator]
Date of Outing: [Date of Outing]
Participant/Guest: [Participant/Guest]

IMPORTANT — PLEASE READ BEFORE SIGNING

I understand that participation in recreational boating involves inherent risks that can result in serious bodily injury, illness, permanent disability, drowning, property damage, or death.

I voluntarily choose to participate in this recreational boating outing and acknowledge and accept the risks described in this Agreement.

1. RECREATIONAL ACTIVITY

I understand that I am participating voluntarily in a recreational boating outing.

Nothing in this Agreement is intended to characterize the voyage as a commercial charter, passenger-for-hire operation, or other commercial maritime service. The legal status of the voyage is determined by applicable law and the actual circumstances of the voyage, not by this Agreement.

2. ASSUMPTION OF RISK

I understand that boating and activities occurring on or around a vessel involve risks, including, but not limited to:

- waves, wakes and sudden vessel movement;
- slips, trips and falls;
- wet or slippery surfaces;
- boarding and disembarking;
- docks, ladders and gangways;
- collision with vessels, docks or other objects;
- changing weather and sea conditions;
- equipment failure;
- fire;
- exposure to sun, heat and weather;
- seasickness;
- swimming and entering the water;
- drowning;
- injuries caused by other passengers or third parties;
- emergency situations occurring away from immediate medical assistance; and
- other risks ordinarily associated with boating and being on or near navigable waters.

I KNOWINGLY AND VOLUNTARILY ASSUME THE INHERENT AND ORDINARY RISKS ASSOCIATED WITH PARTICIPATING IN THIS BOATING ACTIVITY.

3. SAFETY INSTRUCTIONS

I agree to follow reasonable safety instructions given by the vessel owner or operator.

I will not intentionally interfere with operation of the vessel, engage in dangerous conduct, enter restricted areas of the vessel without permission, or enter the water when instructed not to do so.

I understand that the vessel owner/operator may require me to wear a personal flotation device or take other reasonable safety precautions.

4. ALCOHOL AND IMPAIRMENT

I understand that consuming alcohol while aboard a vessel can increase the risk of falling, drowning, injury and impaired judgment.

I accept responsibility for my own voluntary consumption of alcohol and agree not to operate the vessel or interfere with its operation while impaired.

5. RELEASE AND WAIVER

TO THE FULLEST EXTENT PERMITTED BY APPLICABLE FLORIDA AND FEDERAL MARITIME LAW, I voluntarily release and discharge the vessel owner/operator and the owner's family members, agents and persons assisting with the recreational outing from claims arising from the ordinary and inherent risks of my voluntary participation in the recreational boating activity.

To the extent permitted by applicable law, this release is intended to include claims arising from ordinary negligence of a released party.

I understand that no provision of this Agreement is intended to release liability that cannot lawfully be released or waived, including liability that applicable federal maritime law prohibits from being limited or waived.

6. PERSONAL PROPERTY

I accept responsibility for my personal property brought aboard the vessel, including phones, cameras, jewelry, clothing and other belongings, to the fullest extent permitted by law.

7. MEDICAL EMERGENCIES

If I become injured or ill and I am unable to provide consent, I authorize reasonable emergency assistance to be requested on my behalf.

I understand that emergency medical assistance may not be immediately available while the vessel is underway.

8. NO GUARANTEE OF CONDITIONS

I understand that weather, currents, waves, marine traffic, mechanical issues and other circumstances can change unexpectedly.

The owner/operator may alter, postpone or terminate the outing whenever the owner/operator considers doing so appropriate for safety.

9. SEVERABILITY

If any provision of this Agreement is determined to be invalid or unenforceable, I intend that the remaining provisions remain effective to the fullest extent permitted by law.

10. GOVERNING LAW

This Agreement shall be interpreted under applicable federal maritime law and, where applicable and not preempted by federal law, the laws of the State of Florida.

11. ACKNOWLEDGMENT

I acknowledge that:

- I have had an opportunity to read this entire Agreement before signing it;
- I understand that this Agreement affects legal rights;
- I have had an opportunity to ask questions before signing;
- I am signing voluntarily and without coercion;
- I am at least 18 years old; and
- I understand that no agreement can eliminate rights or liabilities that applicable law does not permit to be waived.

I HAVE READ AND UNDERSTAND THIS AGREEMENT AND VOLUNTARILY AGREE TO ITS TERMS.

Participant/Guest Full Name: [Participant/Guest]
Signature: Electronic signature recorded on this page
Date: [Sign Date]
Emergency Contact: [Emergency Contact]
Emergency Contact Phone: [Emergency Contact Phone]

Vessel Owner/Operator: [Vessel Owner/Operator]
Signature: ______________________________
Date: ______________________________$boat$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates WHERE document_type = 'boat_waiver'
);
