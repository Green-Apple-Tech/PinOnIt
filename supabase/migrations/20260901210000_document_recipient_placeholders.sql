-- Put [Recipient Name] in the waiver opening (and quote/invoice/receipt "Prepared for")
-- so Create Document live preview fills the recipient as they type.

UPDATE public.document_templates
SET full_text = $waiver$LIABILITY WAIVER AND RELEASE

I, [Recipient Name], in consideration for participating in or receiving services related to
[Activity/Service Description] provided by [Business Name], acknowledge
and agree to the following:

1. Assumption of Risk. I understand that the activity/service described
above carries inherent risks, which may include property damage, personal
injury, or other loss. I voluntarily assume all such risks.

2. Release of Liability. To the fullest extent permitted by law, I release,
waive, and discharge [Business Name], its owners, employees, and agents
from any and all claims, liabilities, or causes of action arising from
ordinary negligence in connection with the activity/service described
above. This release does not apply to claims arising from gross negligence,
recklessness, or intentional misconduct.

3. Indemnification. I agree to indemnify and hold harmless [Business Name]
from any claims brought by third parties arising from my participation in
the above activity/service.

4. Severability. If any portion of this waiver is found unenforceable, the
remaining provisions will remain in full effect.

5. Acknowledgment. I confirm that I have read this waiver, understand its
terms, and am signing it voluntarily.

This is a general-purpose starting template. Enforceability of liability
waivers varies by state and by activity — some states restrict or void
waivers for certain activities (such as gyms, amusement venues, or
services involving minors), and waivers generally cannot limit liability
for gross negligence or intentional harm. Consult an attorney to confirm
this waiver is appropriate and enforceable for your business, activity,
and state before relying on it.$waiver$
WHERE document_type = 'waiver';

UPDATE public.document_templates
SET full_text = $quote$QUOTE

Prepared for: [Recipient Name].

This quote is an estimate for: [Topic].

The line items, tax, and total on this page are the proposed amounts. This is not an invoice and not a charge. Prices are valid for 30 days unless the sender states otherwise.

If you want to proceed, reply to the sender or approve this quote as instructed on this page. A separate invoice or contract may follow.

Amounts and any pay-elsewhere links are between you and the sender.$quote$
WHERE document_type = 'quote';

UPDATE public.document_templates
SET full_text = $invoice$INVOICE

Prepared for: [Recipient Name].

This invoice is for: [Topic].

The line items, tax, and total on this page are the amounts requested. Approving this invoice confirms you have reviewed those charges.

Pay as the sender instructed (including any pay link on this page). Payment terms, if any, are between you and the sender.

An electronic approval through this page is a record that you reviewed this invoice.$invoice$
WHERE document_type = 'invoice';

UPDATE public.document_templates
SET full_text = $receipt$RECEIPT

Prepared for: [Recipient Name].

This receipt confirms goods or services related to: [Topic].

The line items and total on this page describe what was provided. Confirming this receipt is an acknowledgement that you received those goods or services. It is not a new charge.

Keep a copy for your records. Any refund or dispute is between you and the sender.$receipt$
WHERE document_type = 'receipt';

-- Saved host waiver defaults that still use the old opening (no recipient token).
UPDATE public.profiles
SET waiver_template = regexp_replace(
  waiver_template,
  'In consideration for participating in or receiving services related to[[:space:]]*\[Activity/Service Description\] provided by \[Business Name\], I acknowledge[[:space:]]*and agree to the following:',
  $new$I, [Recipient Name], in consideration for participating in or receiving services related to
[Activity/Service Description] provided by [Business Name], acknowledge
and agree to the following:$new$
)
WHERE waiver_template IS NOT NULL
  AND position('[Recipient Name]' in waiver_template) = 0
  AND waiver_template LIKE '%In consideration for participating in or receiving services related to%';
