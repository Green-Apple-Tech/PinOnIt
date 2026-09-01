-- Default NDA: professional SMS/email 2FA + timestamp + e-sign language; drop the template disclaimer.

UPDATE public.document_templates
SET full_text = $nda$MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the date and timestamp of electronic approval below — delivered by SMS or email, verified by two-factor authentication (2FA) to the Receiving Party's phone number, and executed by electronic signature — between the sender of this document ("Disclosing Party") and [Recipient Name] ("Receiving Party"). Each may also be a "Party" and together the "Parties."

1. Purpose. The Parties wish to share confidential information to evaluate or pursue: [Topic]. This Agreement protects that information.

2. Confidential Information. "Confidential Information" means all non-public information a Party discloses, whether written, oral, electronic, or otherwise, including business plans, pricing, customer lists, financials, product details, technical data, and the existence of these discussions.

3. Obligations. Each Party agrees to:
   (a) use Confidential Information only to evaluate or carry out the purpose above;
   (b) not disclose it to any third party without the other Party's prior written consent, except to employees or advisors who need to know and are bound by similar confidentiality duties;
   (c) protect it with at least the same care it uses for its own confidential information, and no less than reasonable care.

4. Exclusions. Confidential Information does not include information that: (a) is or becomes public through no fault of the Receiving Party; (b) was already in the Receiving Party's possession without a confidentiality duty; (c) is independently developed without use of the other Party's information; or (d) is required to be disclosed by law or court order, provided the Receiving Party gives prompt notice if legally allowed.

5. Term. These obligations last two (2) years from the date of electronic approval, except for trade secrets, which remain protected as long as they qualify as trade secrets under applicable law.

6. No license; no deal. This Agreement does not grant any license or require either Party to enter a further business relationship.

7. Return. Upon written request, each Party will return or destroy the other's Confidential Information, except copies required by law or ordinary backup systems.

8. Electronic approval. Delivery by SMS or email, verification by two-factor authentication (2FA) to the Receiving Party's phone number, a recorded timestamp, and electronic signature are intended to have the same effect as a handwritten signature.

9. Entire agreement. This is the entire agreement on confidentiality for the purpose above. It may be modified only in a writing signed by both Parties.$nda$
WHERE document_type = 'nda';

-- Default (unedited) NDA sends should pick up the new template instead of a snapshot of the old starter.
UPDATE public.documents
SET custom_text = NULL
WHERE document_type = 'nda'
  AND custom_text LIKE '%This is a general-purpose starting template, not legal advice. Confidentiality agreements vary by state and by deal.%';
