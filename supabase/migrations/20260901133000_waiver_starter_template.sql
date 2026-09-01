-- Replace the all-caps placeholder waiver with a general-purpose starter template.

UPDATE public.document_templates
SET full_text = $waiver$LIABILITY WAIVER AND RELEASE

In consideration for participating in or receiving services related to
[Activity/Service Description] provided by [Business Name], I acknowledge
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

-- Swap the old boilerplate if a host saved it as their template; leave custom attorney text alone.
UPDATE public.profiles
SET waiver_template = (
  SELECT full_text FROM public.document_templates WHERE document_type = 'waiver' LIMIT 1
)
WHERE waiver_template IS NOT NULL
  AND waiver_template LIKE 'REPLACE THIS TEXT WITH YOUR OWN LIABILITY WAIVER LANGUAGE%';
