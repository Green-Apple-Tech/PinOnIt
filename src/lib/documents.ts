import { supabase } from './supabase';
import type { PublicSmbDocument, SmbDocumentType } from './types';

export const WAIVER_STARTER_TEXT =
  'REPLACE THIS TEXT WITH YOUR OWN LIABILITY WAIVER LANGUAGE, REVIEWED BY AN ATTORNEY FOR YOUR STATE AND YOUR SPECIFIC ACTIVITY. Liability waiver enforceability varies by state and by activity — many states will not enforce waivers for gross negligence, and some states specifically restrict or void waivers for gyms/fitness facilities, amusement activities, employment relationships, or waivers signed on behalf of minors. This starter text is not legal advice. Have an attorney review your waiver for your state and industry before relying on it.';

export function defaultWaiverText(saved?: string | null) {
  const trimmed = saved?.trim();
  return trimmed || WAIVER_STARTER_TEXT;
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

export const HOLD_UP_COPY =
  "Built to hold up if it's ever challenged — verified signatures, timestamps, and identity confirmation.";

export const LEGAL_DISCLAIMER =
  'This does not guarantee legal enforceability or government certification — consult an attorney for legal advice.';

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
