-- Default contract: drop the template disclaimer from the body (shown as a UI warning instead).

UPDATE public.document_templates
SET full_text = $contract$SERVICE / BUSINESS AGREEMENT

This Agreement is entered into as of the date of electronic signature below, between the sender of this document ("Provider") and [Recipient Name] ("Client").

1. Scope. Provider will perform or supply the following: [Topic]. Details, amounts, and any line items shown with this document are part of the scope.

2. Payment. Client will pay the amounts shown, or as the Parties otherwise agree in writing. Work may be paused if payment is overdue.

3. Changes. Changes to scope or price must be agreed in writing (including email or a follow-up document through PinOnIt).

4. Independent parties. The Parties are independent. This Agreement does not create a partnership, employment, or joint venture.

5. Confidentiality. Each Party will keep non-public business information learned under this Agreement confidential and use it only to perform the work.

6. Electronic signature. An electronic signature or confirmation through this page is intended to have the same effect as a handwritten signature.

7. Entire agreement. This Agreement, together with any amounts and notes shown on this page, is the entire agreement for the scope above.$contract$
WHERE document_type = 'contract';

-- Unedited starter snapshots pick up the clean template. Customized contracts keep their text
-- with only the trailing disclaimer paragraph removed.
UPDATE public.documents
SET custom_text = CASE
  WHEN btrim(regexp_replace(
    btrim(custom_text),
    $re$(?:\r?\n)+This is a general-purpose starting template, not legal advice\. Contract terms vary by state and by industry\. Consult an attorney before relying on this for your situation\.\s*$re$,
    ''
  )) = btrim($contract$SERVICE / BUSINESS AGREEMENT

This Agreement is entered into as of the date of electronic signature below, between the sender of this document ("Provider") and [Recipient Name] ("Client").

1. Scope. Provider will perform or supply the following: [Topic]. Details, amounts, and any line items shown with this document are part of the scope.

2. Payment. Client will pay the amounts shown, or as the Parties otherwise agree in writing. Work may be paused if payment is overdue.

3. Changes. Changes to scope or price must be agreed in writing (including email or a follow-up document through PinOnIt).

4. Independent parties. The Parties are independent. This Agreement does not create a partnership, employment, or joint venture.

5. Confidentiality. Each Party will keep non-public business information learned under this Agreement confidential and use it only to perform the work.

6. Electronic signature. An electronic signature or confirmation through this page is intended to have the same effect as a handwritten signature.

7. Entire agreement. This Agreement, together with any amounts and notes shown on this page, is the entire agreement for the scope above.$contract$)
  THEN NULL
  ELSE regexp_replace(
    custom_text,
    $re$(?:\r?\n)+This is a general-purpose starting template, not legal advice\. Contract terms vary by state and by industry\. Consult an attorney before relying on this for your situation\.\s*$re$,
    ''
  )
END
WHERE document_type = 'contract'
  AND custom_text LIKE '%This is a general-purpose starting template, not legal advice. Contract terms vary by state and by industry.%';
