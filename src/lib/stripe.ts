import { loadStripe, type Stripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export const stripePromise: Promise<Stripe | null> | null =
  publishableKey && publishableKey.startsWith('pk_')
    ? loadStripe(publishableKey)
    : null;

export async function syncStripeSubscription(accessToken: string): Promise<{ plan?: string; synced?: boolean } | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/functions/v1/stripe-sync-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(anon ? { apikey: anon } : {}),
      },
      body: '{}',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
