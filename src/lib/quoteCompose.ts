import { isQuotePayMode, type QuotePayMode } from './quoteSms';
import { splitContactName } from './contactPicker';
import type { HostQuoteLineItem, SmbDocument } from './types';

export function emptyQuoteLine(): HostQuoteLineItem {
  return { description: '', amount: 0 };
}

export function appendQuotePreset(
  items: HostQuoteLineItem[],
  line: HostQuoteLineItem,
): HostQuoteLineItem[] {
  const blank = items.length === 1 && !items[0].description && !items[0].amount;
  return blank ? [{ description: line.description, amount: Number(line.amount) || 0 }] : [...items, line];
}

export function buildQuoteLinePresets(
  defaults: HostQuoteLineItem[] | null | undefined,
  recentQuotes: { line_items?: HostQuoteLineItem[] | null }[],
  max = 12,
): HostQuoteLineItem[] {
  const seen = new Set<string>();
  const chips: HostQuoteLineItem[] = [];
  const add = (line: HostQuoteLineItem) => {
    const key = (line.description || '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    chips.push({ description: line.description, amount: Number(line.amount) || 0 });
  };
  for (const def of defaults ?? []) add(def);
  for (const row of recentQuotes) {
    for (const line of row.line_items ?? []) add(line);
  }
  return chips.slice(0, max);
}

export type QuoteDraftPatch = {
  items: HostQuoteLineItem[];
  notes: string;
  taxPercent: number;
  payUrl: string;
  payLabel: string;
  payMode: QuotePayMode;
  depositAmount: string;
  firstName: string;
  lastName: string;
};

/** Copy line items / pay settings from the last quote. Does not copy phone. */
export function draftFromLastQuote(last: Pick<
  SmbDocument,
  | 'line_items'
  | 'notes'
  | 'tax_percent'
  | 'pay_elsewhere_url'
  | 'pay_elsewhere_label'
  | 'pay_mode'
  | 'pay_amount_cents'
  | 'recipient_name'
>): QuoteDraftPatch {
  const payMode: QuotePayMode = isQuotePayMode(last.pay_mode)
    ? last.pay_mode
    : last.pay_elsewhere_url
      ? 'full'
      : 'off';
  const { firstName, lastName } = splitContactName(
    last.recipient_name && last.recipient_name !== 'Customer' ? last.recipient_name : '',
  );
  return {
    items: last.line_items?.length
      ? last.line_items.map((i) => ({ description: i.description, amount: Number(i.amount) || 0 }))
      : [emptyQuoteLine()],
    notes: last.notes ?? '',
    taxPercent: Number(last.tax_percent) || 0,
    payUrl: last.pay_elsewhere_url ?? '',
    payLabel: last.pay_elsewhere_label || 'Pay Now',
    payMode,
    depositAmount:
      last.pay_amount_cents && last.pay_mode === 'deposit'
        ? (last.pay_amount_cents / 100).toFixed(2)
        : '',
    firstName,
    lastName,
  };
}
