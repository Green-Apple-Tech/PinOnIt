/** Keep in sync with src/lib/quoteSms.ts — Deno edge cannot import from src/. */

export function formatMoneyUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

export function quoteLinkSms(opts: {
  businessName: string;
  shortDescription: string;
  total: number;
  link: string;
}) {
  const biz = opts.businessName.trim() || 'PinOnIt';
  const desc = opts.shortDescription.trim() || 'your job';
  return `${biz}: Here's your quote for ${desc} — ${formatMoneyUsd(opts.total)}. View and approve: ${opts.link}`;
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

export function quoteTotalsFromLines(items: { amount?: number }[] | null | undefined, taxPercent: number) {
  const list = Array.isArray(items) ? items : [];
  const subtotal = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const subtotalCents = Math.round(subtotal * 100);
  const taxCents = Math.round((subtotalCents * (Number(taxPercent) || 0)) / 100);
  return (subtotalCents + taxCents) / 100;
}
