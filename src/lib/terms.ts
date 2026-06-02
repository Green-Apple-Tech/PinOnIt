export const DEFAULT_TERMS_TEXT =
  'By booking this appointment you agree to our cancellation policy. Cancellations must be made at least 24 hours in advance. No-shows may be charged the full session fee. Payment is due at time of booking.';

export function resolveTermsText(text: string | null | undefined): string {
  const trimmed = text?.trim();
  return trimmed || DEFAULT_TERMS_TEXT;
}
