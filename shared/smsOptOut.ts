/** TCPA / A2P opt-out footer appended to outbound SMS and WhatsApp. */
export const SMS_OPT_OUT_FOOTER = 'Reply STOP to opt out.';
export const SMS_REPLY_FOOTER = 'Reply 1 to cancel or 2 to reschedule.';

export function appendSmsOptOut(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return SMS_OPT_OUT_FOOTER;
  if (/\breply\s+stop\b/i.test(trimmed)) return trimmed;
  const sep = /[.!?]$/.test(trimmed) ? ' ' : '. ';
  return `${trimmed}${sep}${SMS_OPT_OUT_FOOTER}`;
}

export function appendSmsReplyFooter(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return SMS_REPLY_FOOTER;
  if (/\breply\s+1\s+to\s+cancel\b/i.test(trimmed)) return trimmed;
  const sep = /[.!?]$/.test(trimmed) ? ' ' : '. ';
  return `${trimmed}${sep}${SMS_REPLY_FOOTER}`;
}

export function appendSmsGuestFooters(body: string): string {
  return appendSmsOptOut(appendSmsReplyFooter(body));
}
