/** Customer-facing quote / receipt SMS bodies. Edge copy lives in functions/_shared/quoteSms.ts. */

export function formatMoneyUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

export function quoteLinkSms(opts: {
  businessName: string;
  shortDescription: string;
  total: number;
  link: string;
  /** When true, CTA is “View and approve” (Sign-by-Text). Default send-only is “View”. */
  requireSignature?: boolean;
}) {
  const biz = opts.businessName.trim() || 'PinOnIt';
  const desc = opts.shortDescription.trim() || 'your job';
  const cta = opts.requireSignature ? 'View and approve' : 'View';
  return `${biz}: Here's your quote for ${desc} — ${formatMoneyUsd(opts.total)}. ${cta}: ${opts.link}`;
}

export function receiptLinkSms(opts: {
  businessName: string;
  shortDescription: string;
  total: number;
  link: string;
}) {
  const biz = opts.businessName.trim() || 'PinOnIt';
  const desc = opts.shortDescription.trim() || 'your job';
  return `${biz}: Receipt for ${desc} — ${formatMoneyUsd(opts.total)}. View: ${opts.link}`;
}

export function quoteFollowupSms(opts: {
  businessName: string;
  topic: string;
  total: number;
  link: string;
}) {
  const biz = opts.businessName.trim() || 'PinOnIt';
  const topic = opts.topic.trim() || 'your job';
  return `${biz}: Just following up on your quote for ${topic} — ${formatMoneyUsd(opts.total)}. View here: ${opts.link}`;
}

export function quotePaymentReminderSms(opts: {
  businessName: string;
  topic: string;
  total: number;
  link: string;
}) {
  const biz = opts.businessName.trim() || 'PinOnIt';
  const topic = opts.topic.trim() || 'your job';
  return `${biz}: Reminder to pay for ${topic} — ${formatMoneyUsd(opts.total)}. View here: ${opts.link}`;
}

export const DEFAULT_QUOTE_FOLLOWUP_DAYS = [3, 7] as const;

export function normalizeQuoteFollowupDays(value: unknown): number[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : DEFAULT_QUOTE_FOLLOWUP_DAYS;
  const days = [...new Set(
    raw
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 30),
  )].sort((a, b) => a - b);
  if (!days.length) return [...DEFAULT_QUOTE_FOLLOWUP_DAYS];
  return days.slice(0, 5);
}

export function quoteFollowupEligible(doc: {
  status: string;
  valid_until?: string | null;
}, now = new Date()) {
  if (doc.status === 'signed' || doc.status === 'declined' || doc.status === 'paid') return false;
  if (doc.status !== 'pending' && doc.status !== 'viewed') return false;
  if (isQuoteExpired(doc.valid_until, now)) return false;
  return true;
}

/** Smallest interval that is due and not yet sent. At most one per dispatch tick. */
export function nextDueQuoteFollowupDay(opts: {
  createdAt: string;
  alreadySent?: number[] | null;
  intervals: number[];
  now?: Date;
}): number | null {
  const created = new Date(opts.createdAt).getTime();
  if (Number.isNaN(created)) return null;
  const now = (opts.now ?? new Date()).getTime();
  const ageDays = (now - created) / 86400000;
  const sent = new Set((opts.alreadySent ?? []).map((n) => Number(n)));
  const due = normalizeQuoteFollowupDays(opts.intervals)
    .filter((day) => ageDays >= day && !sent.has(day));
  return due[0] ?? null;
}

export function isQuoteExpired(validUntil: string | null | undefined, now = new Date()) {
  if (!validUntil) return false;
  const until = new Date(validUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() < now.getTime();
}

export function validUntilFromDays(days: number, from = new Date()) {
  const n = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export type QuotePayMode = 'off' | 'full' | 'deposit';

export function isQuotePayMode(value: string | null | undefined): value is QuotePayMode {
  return value === 'off' || value === 'full' || value === 'deposit';
}

/** Host-facing quote row: Viewed vs never opened, Approved vs Paid, Expired. */
export function quoteHostStatus(doc: {
  status: string;
  valid_until?: string | null;
}): { key: string; label: string } {
  if (doc.status === 'declined') return { key: 'declined', label: 'Declined' };
  if (doc.status === 'paid') return { key: 'paid', label: 'Paid' };
  if (isQuoteExpired(doc.valid_until) && doc.status !== 'signed') {
    return { key: 'expired', label: 'Expired' };
  }
  if (doc.status === 'signed') return { key: 'approved', label: 'Approved' };
  if (doc.status === 'viewed') return { key: 'viewed', label: 'Viewed' };
  if (doc.status === 'pending') return { key: 'sent', label: 'Sent' };
  return { key: doc.status, label: doc.status };
}
