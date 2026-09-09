import { describe, expect, it } from 'vitest';
import { defaultRequireOtp, defaultVerificationRequired, resolveRequireOtp } from './documentTypes';

describe('defaultRequireOtp', () => {
  it('defaults Sign-by-Text off for quotes and invoices', () => {
    expect(defaultRequireOtp('quote')).toBe(false);
    expect(defaultRequireOtp('invoice')).toBe(false);
    expect(defaultVerificationRequired('quote')).toBe(false);
    expect(defaultVerificationRequired('invoice')).toBe(false);
  });

  it('defaults Sign-by-Text on for waivers, NDAs, contracts, and similar', () => {
    expect(defaultRequireOtp('nda')).toBe(true);
    expect(defaultRequireOtp('waiver')).toBe(true);
    expect(defaultRequireOtp('contract')).toBe(true);
    expect(defaultRequireOtp('upload')).toBe(true);
    expect(defaultRequireOtp('credit_card_authorization')).toBe(true);
  });

  it('lets a host template override the type default', () => {
    expect(resolveRequireOtp('quote', { require_otp: true })).toBe(true);
    expect(resolveRequireOtp('nda', { require_otp: false })).toBe(false);
    expect(resolveRequireOtp('quote', null, { require_otp: true })).toBe(true);
  });
});
