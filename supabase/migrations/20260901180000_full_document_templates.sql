-- Replace short "(placeholder)" bodies with full starter documents.
-- Recipients read these via get_document_by_token (joins document_templates.full_text).

UPDATE public.document_templates
SET full_text = $nda$MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the date of electronic signature below, between the sender of this document ("Disclosing Party") and [Recipient Name] ("Receiving Party"). Each may also be a "Party" and together the "Parties."

1. Purpose. The Parties wish to share confidential information to evaluate or pursue: [Topic]. This Agreement protects that information.

2. Confidential Information. "Confidential Information" means all non-public information a Party discloses, whether written, oral, electronic, or otherwise, including business plans, pricing, customer lists, financials, product details, technical data, and the existence of these discussions.

3. Obligations. Each Party agrees to:
   (a) use Confidential Information only to evaluate or carry out the purpose above;
   (b) not disclose it to any third party without the other Party's prior written consent, except to employees or advisors who need to know and are bound by similar confidentiality duties;
   (c) protect it with at least the same care it uses for its own confidential information, and no less than reasonable care.

4. Exclusions. Confidential Information does not include information that: (a) is or becomes public through no fault of the Receiving Party; (b) was already in the Receiving Party's possession without a confidentiality duty; (c) is independently developed without use of the other Party's information; or (d) is required to be disclosed by law or court order, provided the Receiving Party gives prompt notice if legally allowed.

5. Term. These obligations last two (2) years from the date of electronic signature, except for trade secrets, which remain protected as long as they qualify as trade secrets under applicable law.

6. No license; no deal. This Agreement does not grant any license or require either Party to enter a further business relationship.

7. Return. Upon written request, each Party will return or destroy the other's Confidential Information, except copies required by law or ordinary backup systems.

8. Electronic signature. An electronic signature or confirmation through this page is intended to have the same effect as a handwritten signature.

9. Entire agreement. This is the entire agreement on confidentiality for the purpose above. It may be modified only in a writing signed by both Parties.

This is a general-purpose starting template, not legal advice. Confidentiality agreements vary by state and by deal. Consult an attorney before relying on this for your situation.$nda$
WHERE document_type = 'nda';

UPDATE public.document_templates
SET full_text = $contract$SERVICE / BUSINESS AGREEMENT

This Agreement is entered into as of the date of electronic signature below, between the sender of this document ("Provider") and [Recipient Name] ("Client").

1. Scope. Provider will perform or supply the following: [Topic]. Details, amounts, and any line items shown with this document are part of the scope.

2. Payment. Client will pay the amounts shown, or as the Parties otherwise agree in writing. Work may be paused if payment is overdue.

3. Changes. Changes to scope or price must be agreed in writing (including email or a follow-up document through PinOnIt).

4. Independent parties. The Parties are independent. This Agreement does not create a partnership, employment, or joint venture.

5. Confidentiality. Each Party will keep non-public business information learned under this Agreement confidential and use it only to perform the work.

6. Electronic signature. An electronic signature or confirmation through this page is intended to have the same effect as a handwritten signature.

7. Entire agreement. This Agreement, together with any amounts and notes shown on this page, is the entire agreement for the scope above.

This is a general-purpose starting template, not legal advice. Contract terms vary by state and by industry. Consult an attorney before relying on this for your situation.$contract$
WHERE document_type = 'contract';

UPDATE public.document_templates
SET full_text = $quote$QUOTE

This quote is an estimate for: [Topic].

The line items, tax, and total on this page are the proposed amounts. This is not an invoice and not a charge. Prices are valid for 30 days unless the sender states otherwise.

If you want to proceed, reply to the sender or approve this quote as instructed on this page. A separate invoice or contract may follow.

Amounts and any pay-elsewhere links are between you and the sender.$quote$
WHERE document_type = 'quote';

UPDATE public.document_templates
SET full_text = $invoice$INVOICE

This invoice is for: [Topic].

The line items, tax, and total on this page are the amounts requested. Approving this invoice confirms you have reviewed those charges.

Pay as the sender instructed (including any pay link on this page). Payment terms, if any, are between you and the sender.

An electronic approval through this page is a record that you reviewed this invoice.$invoice$
WHERE document_type = 'invoice';

UPDATE public.document_templates
SET full_text = $receipt$RECEIPT

This receipt confirms goods or services related to: [Topic].

The line items and total on this page describe what was provided. Confirming this receipt is an acknowledgement that you received those goods or services. It is not a new charge.

Keep a copy for your records. Any refund or dispute is between you and the sender.$receipt$
WHERE document_type = 'receipt';
