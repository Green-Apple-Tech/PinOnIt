import { describe, expect, it } from 'vitest';
import { appendQuotePreset, buildQuoteLinePresets, draftFromLastQuote } from './quoteCompose';

describe('buildQuoteLinePresets', () => {
  it('dedupes defaults and recent quote lines, defaults first', () => {
    const chips = buildQuoteLinePresets(
      [{ description: 'Mow', amount: 40 }],
      [
        { line_items: [{ description: 'Mow', amount: 45 }, { description: 'Edge', amount: 20 }] },
      ],
    );
    expect(chips.map((c) => c.description)).toEqual(['Mow', 'Edge']);
    expect(chips[0].amount).toBe(40);
  });
});

describe('appendQuotePreset', () => {
  it('replaces a blank first row', () => {
    expect(appendQuotePreset([{ description: '', amount: 0 }], { description: 'Mow', amount: 40 })).toEqual([
      { description: 'Mow', amount: 40 },
    ]);
  });

  it('appends onto existing lines', () => {
    expect(appendQuotePreset([{ description: 'Mow', amount: 40 }], { description: 'Edge', amount: 20 })).toHaveLength(2);
  });
});

describe('draftFromLastQuote', () => {
  it('copies lines and infers full pay when a link exists', () => {
    const draft = draftFromLastQuote({
      line_items: [{ description: 'Mow', amount: 40 }],
      notes: 'Haul away',
      tax_percent: 7,
      pay_elsewhere_url: 'https://paypal.me/x',
      pay_elsewhere_label: 'Pay',
      pay_mode: null,
      pay_amount_cents: null,
      recipient_name: 'Jane Smith',
    });
    expect(draft.items[0].description).toBe('Mow');
    expect(draft.payMode).toBe('full');
    expect(draft.firstName).toBe('Jane');
    expect(draft.lastName).toBe('Smith');
  });
});
