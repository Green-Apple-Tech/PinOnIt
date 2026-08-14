export function isRealStripeCustomerId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('cus_');
}
