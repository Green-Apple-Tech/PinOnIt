import { describe, expect, it, beforeEach } from 'vitest';
import {
  captureCampaignParams,
  campaignQueryString,
  readCampaignParams,
  signupHref,
} from './campaignAttribution';

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      clear: () => {
        for (const key of Object.keys(store)) delete store[key];
      },
    },
  });
});

describe('campaignAttribution', () => {
  it('captures UTM params and landing path, then rebuilds signup URL', () => {
    captureCampaignParams(
      '?utm_source=email&utm_campaign=nda-launch&utm_medium=newsletter&ref=abc',
      '/nda',
    );
    const stored = readCampaignParams();
    expect(stored.utm_source).toBe('email');
    expect(stored.utm_campaign).toBe('nda-launch');
    expect(stored.utm_medium).toBe('newsletter');
    expect(stored.ref).toBe('abc');
    expect(stored.landing).toBe('/nda');
    expect(signupHref()).toBe(
      '/signup?utm_source=email&utm_medium=newsletter&utm_campaign=nda-launch&ref=abc',
    );
  });

  it('keeps earlier UTMs when later pages have none', () => {
    captureCampaignParams('utm_source=email&utm_campaign=nda-launch', '/nda');
    captureCampaignParams('', '/signup');
    expect(readCampaignParams().utm_campaign).toBe('nda-launch');
    expect(campaignQueryString()).toContain('utm_campaign=nda-launch');
  });
});
