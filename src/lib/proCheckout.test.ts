import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { softwareApplicationJsonLd } from './jsonLd';
import {
  PRO_PRICE,
  PRO_PRICE_CENTS,
  PRO_PRICE_LABEL,
  STRIPE_PRO_PRICE_ID,
} from './pricing';
import { PINONIT_SOFTWARE } from './seoIdentity';
import {
  REFERRAL_NOTICE_DATE,
  REFERRAL_PROGRAM_ENDS_AT,
  REFERRAL_PROGRAM_ENDS_ON,
  referralRewardsOpen,
} from './referralRetirement';

const NEW_PRICE_ID = 'price_1UBerwIVv38UYFOXg43WzEWL';
const OLD_PRICE_ID = 'price_1TZHhhIVv38UYFOXMXT2EV8v';
const root = new URL('../..', import.meta.url);

function read(rel: string) {
  return readFileSync(new URL(rel, root), 'utf8');
}

function walk(dir: string, acc: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'scout2') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx|html|js)$/.test(name)) acc.push(path);
  }
  return acc;
}

describe('new Pro checkout', () => {
  it('sends the verified $9.99 monthly Price and leaves the old Price off new checkout', () => {
    expect(STRIPE_PRO_PRICE_ID).toBe(NEW_PRICE_ID);
    expect(PRO_PRICE).toBe(9.99);
    expect(PRO_PRICE_CENTS).toBe(999);
    expect(PRO_PRICE_LABEL).toBe('$9.99');
    expect(OLD_PRICE_ID).not.toBe(STRIPE_PRO_PRICE_ID);

    const billing = read('src/pages/Billing.tsx');
    const onboarding = read('src/components/OnboardingWizard.tsx');
    const checkout = read('supabase/functions/stripe-checkout/index.ts');
    const planMap = read('supabase/functions/_shared/stripeSubscription.ts');

    expect(billing).toContain('const PRICE_ID = STRIPE_PRO_PRICE_ID');
    expect(billing).toContain('price_id: PRICE_ID');
    expect(onboarding).toContain('price_id: STRIPE_PRO_PRICE_ID');
    expect(checkout).toContain('line_items: [{ price: resolvedPriceId, quantity: 1 }]');
    expect(checkout).toContain("mode: 'subscription'");
    expect(checkout).not.toContain('subscriptions.update');
    expect(planMap).toContain(`${NEW_PRICE_ID}: 'pro'`);
    expect(planMap).toContain(`${OLD_PRICE_ID}: 'pro'`);
    expect(planMap).not.toContain('subscriptions.update');
  });

  it('has no other app checkout caller and does not rewrite an existing subscription price', () => {
    const srcRoot = new URL('src', root).pathname;
    const callers = walk(srcRoot).filter((file) => (
      !file.endsWith('proCheckout.test.ts')
      && readFileSync(file, 'utf8').includes('functions/v1/stripe-checkout')
    ));
    expect(callers.map((file) => file.split('/src/')[1]).sort()).toEqual([
      'components/OnboardingWizard.tsx',
      'pages/Billing.tsx',
    ]);

    const webhook = read('supabase/functions/stripe-webhook/index.ts');
    expect(webhook).toContain("case 'invoice.paid':");
    expect(webhook).toContain('stripe.subscriptions.retrieve');
    expect(webhook).toContain('applyStripeSubscription');
    expect(webhook).not.toContain('subscriptions.update');
    expect(webhook).toContain('referralRewardsOpen()');
    expect(webhook).toContain('amount_cents: 100');
    expect(webhook).toContain('createBalanceTransaction');
    expect(webhook).not.toContain('amount_cents: 899');
    expect(webhook).not.toContain('amount_cents: 999');
  });

  it('keeps the $1 credit through the 30-day notice and uses one end date', () => {
    const notice = new Date(`${REFERRAL_NOTICE_DATE}T12:00:00.000Z`);
    const end = new Date(REFERRAL_PROGRAM_ENDS_AT);
    expect(end.getTime() - notice.getTime()).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000);
    expect(REFERRAL_PROGRAM_ENDS_ON).toBe('2026-11-14');
    expect(referralRewardsOpen(new Date('2026-11-14T23:00:00.000-05:00'))).toBe(true);
    expect(referralRewardsOpen(new Date('2026-11-15T05:00:00.000Z'))).toBe(false);

    for (const page of [
      'src/pages/Terms.tsx',
      'src/pages/Leaderboard.tsx',
      'src/components/landing/LandingPricingCard.tsx',
      'src/pages/CalendlyAlternative.tsx',
      'src/lib/whyPinonit.ts',
    ]) {
      expect(read(page)).toContain('November 14, 2026');
      expect(read(page)).not.toContain('ended on October 15, 2026');
    }
    for (const page of ['src/pages/Billing.tsx', 'src/pages/Settings.tsx', 'src/components/Auth.tsx']) {
      expect(read(page)).toContain('REFERRAL_PROGRAM_ENDS_ON_LABEL');
      expect(read(page)).not.toContain('ended on October 15, 2026');
    }
    expect(read('src/pages/Terms.tsx')).toContain('notice to existing participants');
    expect(read('src/App.tsx')).toContain('/signup?ref=');
    expect(read('src/components/Auth.tsx')).toContain('recordCustomerReferral');
    const referral = read('supabase/functions/referral-signup/index.ts');
    expect(referral).toContain('referralRewardsOpen()');
    expect(referral).toContain("from('referrals').insert");
    expect(referral).toContain('program_retired');
    expect(read('src/lib/pricing.ts')).toContain("price_1UBerwIVv38UYFOXg43WzEWL");
    expect(read('supabase/functions/_shared/stripeSubscription.ts')).toContain(OLD_PRICE_ID);
  });

  it('shows $9.99 in marketing copy and structured data, with no secret keys in the frontend', () => {
    const indexHtml = read('index.html');
    expect(indexHtml).toContain('$9.99/month');
    expect(indexHtml).toContain('"price": "9.99"');
    expect(indexHtml).not.toContain('8.99');

    const offer = softwareApplicationJsonLd().offers as {
      price: string;
      priceCurrency: string;
      priceSpecification: { billingDuration: string };
    };
    expect(offer.price).toBe('9.99');
    expect(offer.priceCurrency).toBe('USD');
    expect(PINONIT_SOFTWARE.priceCurrency).toBe('USD');
    expect(offer.priceSpecification.billingDuration).toBe('P1M');

    const frontend = walk(new URL('src', root).pathname)
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(frontend).not.toMatch(/sk_live_|sk_test_|rk_live_|whsec_/);
    expect(indexHtml).not.toMatch(/sk_live_|sk_test_|rk_live_|whsec_/);
  });
});
