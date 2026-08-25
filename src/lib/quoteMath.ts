export function quoteTotals(items: { amount: number }[], taxPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const subtotalCents = Math.round(subtotal * 100);
  const taxCents = Math.round(subtotalCents * (Number(taxPercent) || 0) / 100);
  return {
    subtotal: subtotalCents / 100,
    taxAmount: taxCents / 100,
    total: (subtotalCents + taxCents) / 100,
  };
}
