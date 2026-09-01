import { supabase } from './supabase';
import type { PublicSmbDocument, SmbDocumentType } from './types';

export const WAIVER_STARTER_TEXT = `LIABILITY WAIVER AND RELEASE

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
and state before relying on it.`;

export function defaultWaiverText(saved?: string | null) {
  const trimmed = saved?.trim();
  return trimmed || WAIVER_STARTER_TEXT;
}

export const NDA_STARTER_TEXT = `MUTUAL NON-DISCLOSURE AGREEMENT

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

9. Entire agreement. This is the entire agreement on confidentiality for the purpose above. It may be modified only in a writing signed by both Parties.`;

export const CONTRACT_STARTER_TEXT = `SERVICE / BUSINESS AGREEMENT

This Agreement is entered into as of the date of electronic signature below, between the sender of this document ("Provider") and [Recipient Name] ("Client").

1. Scope. Provider will perform or supply the following: [Topic]. Details, amounts, and any line items shown with this document are part of the scope.

2. Payment. Client will pay the amounts shown, or as the Parties otherwise agree in writing. Work may be paused if payment is overdue.

3. Changes. Changes to scope or price must be agreed in writing (including email or a follow-up document through PinOnIt).

4. Independent parties. The Parties are independent. This Agreement does not create a partnership, employment, or joint venture.

5. Confidentiality. Each Party will keep non-public business information learned under this Agreement confidential and use it only to perform the work.

6. Electronic signature. An electronic signature or confirmation through this page is intended to have the same effect as a handwritten signature.

7. Entire agreement. This Agreement, together with any amounts and notes shown on this page, is the entire agreement for the scope above.`;

export const QUOTE_STARTER_TEXT = `QUOTE

This quote is an estimate for: [Topic].

The line items, tax, and total on this page are the proposed amounts. This is not an invoice and not a charge. Prices are valid for 30 days unless the sender states otherwise.

If you want to proceed, reply to the sender or approve this quote as instructed on this page. A separate invoice or contract may follow.

Amounts and any pay-elsewhere links are between you and the sender.`;

export const INVOICE_STARTER_TEXT = `INVOICE

This invoice is for: [Topic].

The line items, tax, and total on this page are the amounts requested. Approving this invoice confirms you have reviewed those charges.

Pay as the sender instructed (including any pay link on this page). Payment terms, if any, are between you and the sender.

An electronic approval through this page is a record that you reviewed this invoice.`;

export const RECEIPT_STARTER_TEXT = `RECEIPT

This receipt confirms goods or services related to: [Topic].

The line items and total on this page describe what was provided. Confirming this receipt is an acknowledgement that you received those goods or services. It is not a new charge.

Keep a copy for your records. Any refund or dispute is between you and the sender.`;

export function defaultDocumentBody(type: SmbDocumentType, saved?: string | null) {
  const trimmed = saved?.trim();
  if (trimmed) return trimmed;
  if (type === 'waiver') return WAIVER_STARTER_TEXT;
  if (type === 'nda') return NDA_STARTER_TEXT;
  if (type === 'contract') return CONTRACT_STARTER_TEXT;
  if (type === 'quote') return QUOTE_STARTER_TEXT;
  if (type === 'invoice') return INVOICE_STARTER_TEXT;
  if (type === 'receipt') return RECEIPT_STARTER_TEXT;
  return WAIVER_STARTER_TEXT;
}

export function fillDocumentPlaceholders(
  text: string,
  vars: {
    topic?: string | null;
    recipientName?: string | null;
    businessName?: string | null;
    activityDescription?: string | null;
  },
) {
  const topic = vars.topic?.trim() || '[Topic]';
  const recipient = vars.recipientName?.trim() || '[Recipient Name]';
  const business = vars.businessName?.trim() || '[Business Name]';
  const activity = vars.activityDescription?.trim() || vars.topic?.trim() || '[Activity/Service Description]';
  return text
    .replaceAll('[Topic]', topic)
    .replaceAll('[Recipient Name]', recipient)
    .replaceAll('[Business Name]', business)
    .replaceAll('[Activity/Service Description]', activity);
}

export function businessNameOptions(names: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function documentBodyIsEditable(type: SmbDocumentType) {
  return type === 'nda' || type === 'contract' || type === 'waiver';
}

export const SMB_DOCUMENT_TYPES: { id: SmbDocumentType; label: string; hint: string }[] = [
  { id: 'quote', label: 'Quote', hint: 'Estimate before they say yes' },
  { id: 'invoice', label: 'Invoice', hint: 'What they owe' },
  { id: 'receipt', label: 'Receipt', hint: 'Confirm they received it' },
  { id: 'nda', label: 'NDA', hint: 'Keep talks confidential' },
  { id: 'contract', label: 'Contract', hint: 'Sign the terms' },
  { id: 'waiver', label: 'Waiver', hint: 'Sign a liability waiver' },
];

export const MONEY_DOCUMENT_TYPES: SmbDocumentType[] = ['quote', 'invoice', 'receipt'];

export function isMoneyDocumentType(type: SmbDocumentType) {
  return MONEY_DOCUMENT_TYPES.includes(type);
}

export function defaultVerificationRequired(type: SmbDocumentType) {
  return type === 'nda' || type === 'contract' || type === 'waiver';
}

export function documentNeedsRecipientAction(type: SmbDocumentType) {
  return type !== 'quote';
}

export function isSmbDocumentType(value: string): value is SmbDocumentType {
  return SMB_DOCUMENT_TYPES.some((t) => t.id === value);
}

export { HOLD_UP_COPY, LEGAL_DISCLAIMER, WAIVER_HOST_HINT, CONTRACT_HOST_HINT } from './documentCopy';

export function topicCoverLine(topic: string) {
  const trimmed = topic.trim();
  if (!trimmed) return '';
  return `This agreement covers confidential discussions regarding: ${trimmed}`;
}

export function documentTypeLabel(type: SmbDocumentType) {
  return SMB_DOCUMENT_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function documentViewUrl(token: string) {
  return `${window.location.origin}/d/${token}`;
}

export function newDocumentToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fetchClientIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? null;
  } catch {
    return null;
  }
}

export async function getDocumentByToken(token: string) {
  const { data, error } = await supabase.rpc('get_document_by_token', { p_token: token });
  if (error || !data) return { data: null, error };
  return { data: data as PublicSmbDocument, error: null };
}

export async function recordDocumentEvent(params: {
  token: string;
  action: 'viewed' | 'signed';
  signatureData?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const { data, error } = await supabase.rpc('record_document_event', {
    p_token: params.token,
    p_action: params.action,
    p_signature_data: params.signatureData ?? null,
    p_ip: params.ip ?? null,
    p_user_agent: params.userAgent ?? null,
  });
  const result = (data ?? null) as { ok?: boolean; error?: string; status?: string } | null;
  return { data: result, error };
}

export async function verifyDocumentOtp(token: string, code: string) {
  const { data, error } = await supabase.rpc('verify_document_otp', {
    p_token: token,
    p_code: code,
  });
  const result = (data ?? null) as { ok?: boolean; error?: string; already_verified?: boolean } | null;
  return { data: result, error };
}

export async function sendDocumentOtp(token: string, force = false) {
  const { data, error } = await supabase.functions.invoke('send-document-otp', {
    body: { token, force },
  });
  const result = (data ?? null) as {
    ok?: boolean;
    error?: string;
    already_verified?: boolean;
    sent?: boolean;
  } | null;
  return { data: result, error };
}

export async function sendDocumentLink(token: string, signingUrl: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const access = sessionData.session?.access_token;
  if (!access) return { ok: false, error: 'Sign in again to send.' };

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-document-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify({ token, signingUrl }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || 'SMS could not be sent' };
  }
  return { ok: true };
}
