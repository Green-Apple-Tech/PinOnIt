/** Friendly US-style placeholder for phone inputs. */
export const PHONE_PLACEHOLDER = '(305) 321-2060';

/** Brief helper shown below phone inputs. */
export const PHONE_HINT = 'No +1 needed for US numbers. For international, include + and country code.';

/**
 * Normalize to E.164 for Twilio/API.
 * - 10 digits → prepend +1
 * - 11 digits starting with 1 → prepend + only
 * - Already has + → strip formatting, keep +
 * - Strips spaces, dashes, parentheses
 */
export function normalizePhoneE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

/** Format for display on blur (US numbers without requiring +1). */
export function formatPhoneDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (hasPlus) return `+${digits}`;
  return trimmed;
}

export function blurFormatPhone(value: string): string {
  if (!value.trim()) return value;
  return formatPhoneDisplay(value);
}
