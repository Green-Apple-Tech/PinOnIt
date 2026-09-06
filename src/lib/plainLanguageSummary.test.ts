import { describe, expect, it } from 'vitest';
import {
  PLAIN_LANGUAGE_MAX_WORDS,
  normalizePlainLanguageBullets,
  plainLanguageBulletsFromStored,
  truncateForPlainLanguageSummary,
} from './plainLanguageSummary';

describe('truncateForPlainLanguageSummary', () => {
  it('does not truncate short text', () => {
    const r = truncateForPlainLanguageSummary('hello world');
    expect(r.truncated).toBe(false);
    expect(r.text).toBe('hello world');
  });

  it('truncates above max words', () => {
    const words = Array.from({ length: PLAIN_LANGUAGE_MAX_WORDS + 50 }, (_, i) => `w${i}`);
    const r = truncateForPlainLanguageSummary(words.join(' '));
    expect(r.truncated).toBe(true);
    expect(r.text.split(/\s+/)).toHaveLength(PLAIN_LANGUAGE_MAX_WORDS);
  });
});

describe('normalizePlainLanguageBullets', () => {
  it('strips markers and caps length', () => {
    expect(normalizePlainLanguageBullets(['- One', '• Two', '3. Three'])).toBe('One\nTwo\nThree');
    expect(plainLanguageBulletsFromStored('One\nTwo')).toEqual(['One', 'Two']);
  });
});
