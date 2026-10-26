import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_CHECKOUT_TRIAL_DAYS,
  checkoutTrialFields,
  resolveCheckoutTrial,
  shareableTrialSignupUrl,
  trialDaysForPromo,
} from '../shared/trialPromo';
import { captureTrialPromo, readTrialPromo } from './trialPromo';

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    },
  });
});

describe('trial promo codes', () => {
  it('builds the shareable signup links', () => {
    expect(shareableTrialSignupUrl('FREE60')).toBe('https://pinonit.com/signup?promo=FREE60');
    expect(shareableTrialSignupUrl('SWITCH')).toBe('https://pinonit.com/signup?promo=SWITCH');
    expect(shareableTrialSignupUrl('FREE60', 'https://pinonit.com/')).toBe(
      'https://pinonit.com/signup?promo=FREE60',
    );
  });

  it('maps FREE60 to 60 days and SWITCH to 90, ignoring the client days', () => {
    expect(trialDaysForPromo('free60')).toBe(60);
    expect(trialDaysForPromo(' SWITCH ')).toBe(90);
    expect(resolveCheckoutTrial({ promo: 'FREE60', trial_period_days: 90 })).toEqual({
      days: 60,
      promo: 'FREE60',
    });
    expect(resolveCheckoutTrial({ promo: 'switch', trial_period_days: 14 })).toEqual({
      days: 90,
      promo: 'SWITCH',
    });
  });

  it('falls unknown codes back to the 14-day trial', () => {
    expect(resolveCheckoutTrial({ promo: 'nope', trial_period_days: 90 })).toEqual({
      days: 14,
      promo: 'NOPE',
    });
    expect(resolveCheckoutTrial({ promo: '!!!', trial_period_days: 60 })).toEqual({
      days: 60,
      promo: null,
    });
  });

  it('caps a requested trial at 90 days when no code is present', () => {
    expect(MAX_CHECKOUT_TRIAL_DAYS).toBe(90);
    expect(resolveCheckoutTrial({ trial_period_days: 60 })).toEqual({ days: 60, promo: null });
    expect(resolveCheckoutTrial({ trial_period_days: '90' })).toEqual({ days: 90, promo: null });
    expect(resolveCheckoutTrial({ trial_period_days: 120 })).toEqual({ days: 90, promo: null });
    expect(resolveCheckoutTrial({ trial_period_days: 0 })).toEqual({ days: 0, promo: null });
    expect(resolveCheckoutTrial({})).toEqual({ days: 0, promo: null });
  });

  it('sends the code alone so checkout does not trust a days field', () => {
    expect(checkoutTrialFields({ promo: 'free60', trialPeriodDays: 90 })).toEqual({ promo: 'FREE60' });
    expect(checkoutTrialFields({ promo: 'SWITCH', trialPeriodDays: 60 })).toEqual({ promo: 'SWITCH' });
    expect(checkoutTrialFields({ promo: 'nope', trialPeriodDays: 90 })).toEqual({ promo: 'NOPE' });
    expect(checkoutTrialFields({ trialPeriodDays: 60 })).toEqual({ trial_period_days: 60 });
    expect(checkoutTrialFields({ trialPeriodDays: 120 })).toEqual({ trial_period_days: 90 });
    expect(checkoutTrialFields({})).toEqual({});
  });

  it('keeps a signup promo for the later checkout call', () => {
    expect(captureTrialPromo('?promo=switch')).toBe('SWITCH');
    expect(readTrialPromo()).toBe('SWITCH');
    expect(captureTrialPromo('')).toBe('SWITCH');
    expect(captureTrialPromo('?promo=FREE60')).toBe('FREE60');
  });

  it('resolves trials inside stripe-checkout instead of a 60-day cap', () => {
    const checkout = readFileSync(
      new URL('../../supabase/functions/stripe-checkout/index.ts', import.meta.url),
      'utf8',
    );
    expect(checkout).toContain('resolveCheckoutTrial');
    expect(checkout).toContain('trial_period_days: trialDays');
    expect(checkout).not.toMatch(/Math\.min\([^)]*,\s*60\s*\)/);
  });
});
