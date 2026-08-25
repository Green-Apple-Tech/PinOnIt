import { describe, expect, it } from 'vitest';
import {
  businessNameFromDomain,
  demoServicesForBusinessType,
  emailDomain,
  guessBusinessTypeFromDomain,
  isConsumerEmailDomain,
  isStoredPaidBookingCustomized,
  mergePaidBookingSuggestion,
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
  });
});
