import { describe, expect, it } from 'vitest';
import { defaultVerificationRequired } from './documentTypes';

describe('defaultVerificationRequired', () => {
  it('defaults signature + 2FA on for authorizations and most types', () => {
    expect(defaultVerificationRequired('credit_card_authorization')).toBe(true);
    expect(defaultVerificationRequired('nda')).toBe(true);
    expect(defaultVerificationRequired('waiver')).toBe(true);
    expect(defaultVerificationRequired('upload')).toBe(true);
    expect(defaultVerificationRequired('invoice')).toBe(true);
  });

  it('leaves quotes view-only by default', () => {
    expect(defaultVerificationRequired('quote')).toBe(false);
  });
});
