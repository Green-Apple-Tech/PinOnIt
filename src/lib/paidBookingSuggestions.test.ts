import { describe, expect, it } from 'vitest';
import {
  businessNameFromDomain,
  demoServicesForBusinessType,
  emailDomain,
  isPaidMenuPrice,
  isPersistedServiceId,
  guessBusinessTypeFromDomain,
  isConsumerEmailDomain,
  isStoredPaidBookingCustomized,
  mergePaidBookingSuggestion,
  paidBookingExampleInsertRows,
  paidBookingFontStack,
  resolvePaidBookingSuggestion,
} from './paidBookingSuggestions';

describe('paidBookingSuggestions', () => {
  it('detects consumer vs business email domains', () => {
    expect(isConsumerEmailDomain('gmail.com')).toBe(true);
    expect(isConsumerEmailDomain('smithphoto.com')).toBe(false);
    expect(emailDomain('peter@gmail.com')).toBe('gmail.com');
    expect(emailDomain('hello@smithphotography.com')).toBe('smithphotography.com');
  });

  it('derives a business name from a domain', () => {
    expect(businessNameFromDomain('smithphotography.com')).toBe('Smith Photography');
    expect(businessNameFromDomain('green-apple-tech.io')).toBe('Green Apple Tech');
  });

  it('guesses business type from domain keywords', () => {
    expect(guessBusinessTypeFromDomain('smithphotography.com')).toBe('photography');
    expect(guessBusinessTypeFromDomain('miami-landscaping.com')).toBe('landscaper');
  });

  it('prefers wizard business type over email domain', () => {
    const s = resolvePaidBookingSuggestion({
      email: 'owner@gmail.com',
      businessType: 'landscaper',
      fullName: 'Peter',
    });
    expect(s.source).toBe('business_type');
    expect(s.sourceLabel).toContain('Landscaping');
    expect(s.demoServices[1]?.name).toContain('Estimate');
  });

  it('uses business domain when no business type is set', () => {
    const s = resolvePaidBookingSuggestion({
      email: 'hello@smithphotography.com',
      fullName: 'Peter',
    });
    expect(s.source).toBe('email_domain');
    expect(s.sourceLabel).toBe('smithphotography.com');
    expect(s.displayName).toBe('Smith Photography');
    expect(s.quickStartId).toBe('photo');
  });

  it('merges suggestions only into empty fields', () => {
    const merged = mergePaidBookingSuggestion(
      { display_name: 'Peter', tagline: '', bio: '' },
      resolvePaidBookingSuggestion({ businessType: 'photography', fullName: 'Peter' }),
    );
    expect(merged.display_name).toBe('Peter');
    expect(merged.tagline.length).toBeGreaterThan(0);
    expect(merged.filled).toEqual(['tagline', 'bio']);
  });

  it('knows when stored settings were customized', () => {
    expect(isStoredPaidBookingCustomized(null)).toBe(false);
    expect(isStoredPaidBookingCustomized({ tagline: 'My tagline' })).toBe(true);
  });

  it('builds industry demo services', () => {
    const demos = demoServicesForBusinessType('landscaper');
    expect(demos).toHaveLength(3);
    expect(demos[1]?.name).toMatch(/Estimate/i);
    expect(demos.every((d) => d.price_cents > 0)).toBe(true);
  });

  it('builds insert rows for bookable starter services', () => {
    const rows = paidBookingExampleInsertRows('host-1', demoServicesForBusinessType('photography'));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.host_id === 'host-1')).toBe(true);
    expect(rows.every((r) => r.is_active && r.price_cents > 1000)).toBe(true);
    expect(rows.every((r) => r.show_description_on_paid_booking)).toBe(true);
  });

  it('picks a CSS font stack and ignores demo ids', () => {
    expect(paidBookingFontStack('serif')).toMatch(/Georgia/i);
    expect(paidBookingFontStack('unknown')).toBeUndefined();
    expect(isPersistedServiceId('__demo_1')).toBe(false);
    expect(isPersistedServiceId('a1b2c3')).toBe(true);
  });

  it('treats $10 or less as a show-up hold, not a price-list item', () => {
    expect(isPaidMenuPrice(0)).toBe(false);
    expect(isPaidMenuPrice(1000)).toBe(false);
    expect(isPaidMenuPrice(1001)).toBe(true);
    expect(isPaidMenuPrice(7500)).toBe(true);
  });

  it('uses a priced consult menu as the default example', () => {
    const s = resolvePaidBookingSuggestion({ email: 'peter@gmail.com', fullName: 'Peter' });
    expect(s.source).toBe('default');
    expect(s.demoServices).toHaveLength(3);
    expect(s.demoServices.every((d) => d.price_cents > 0)).toBe(true);
    expect(s.demoServices[0]?.name).toMatch(/Consultation/i);
  });
});
