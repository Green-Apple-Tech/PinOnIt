/** TCPA / A2P opt-out footer appended to outbound SMS and WhatsApp. */
export const SMS_OPT_OUT_FOOTER = "Reply STOP to opt out.";

export function appendSmsOptOut(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return SMS_OPT_OUT_FOOTER;
  if (/\breply\s+stop\b/i.test(trimmed)) return trimmed;
  const sep = /[.!?]$/.test(trimmed) ? " " : ". ";
  return `${trimmed}${sep}${SMS_OPT_OUT_FOOTER}`;
}
