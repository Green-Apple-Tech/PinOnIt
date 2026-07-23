import { normalizePhoneE164 } from './phone';

const MIN_PHONE_DIGITS = 10;

/** Parse guest phone for booking; returns null when blank or too short (no error thrown). */
export function parseOptionalGuestPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const e164 = normalizePhoneE164(trimmed);
  const digits = e164.replace(/\D/g, '');
  if (digits.length < MIN_PHONE_DIGITS) return null;
  return e164;
}

export type BookingSmsConsentResult = {
  guestPhone: string | null;
  smsConsentGranted: boolean;
  whatsappConsentGranted: boolean;
};

/** SMS/WhatsApp consent is stored only when a valid phone is entered AND the user opted in. */
export function resolveBookingSmsConsent(
  phoneRaw: string,
  smsOptIn: boolean,
  whatsappOptIn: boolean,
): BookingSmsConsentResult {
  const guestPhone = parseOptionalGuestPhone(phoneRaw);
  return {
    guestPhone,
    smsConsentGranted: !!(guestPhone && smsOptIn),
    whatsappConsentGranted: !!(guestPhone && whatsappOptIn),
  };
}

export function buildNotifyViaPayload(
  email: string,
  phoneRaw: string,
  smsOptIn: boolean,
  whatsappOptIn: boolean,
): string[] {
  const channels: string[] = [];
  if (email.trim()) channels.push('email');
  const { smsConsentGranted, whatsappConsentGranted } = resolveBookingSmsConsent(
    phoneRaw,
    smsOptIn,
    whatsappOptIn,
  );
  if (smsConsentGranted) channels.push('sms');
  if (whatsappConsentGranted) channels.push('whatsapp');
  return channels;
}

export function shouldRecordSmsOptIn(
  phoneRaw: string,
  smsOptIn: boolean,
): boolean {
  return resolveBookingSmsConsent(phoneRaw, smsOptIn, false).smsConsentGranted;
}
