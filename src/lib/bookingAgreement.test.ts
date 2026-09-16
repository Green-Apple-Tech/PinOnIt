import { describe, expect, it } from 'vitest';
import {
  defaultBookingAgreementText,
  resolveBookingAgreement,
} from './bookingAgreement';

describe('resolveBookingAgreement', () => {
  it('is off when require_nda is false', () => {
    expect(resolveBookingAgreement({ require_nda: false })).toBeNull();
  });

  it('defaults existing NDA bookings to the legacy short text', () => {
    const a = resolveBookingAgreement({ require_nda: true });
    expect(a?.type).toBe('nda');
    expect(a?.body).toMatch(/confidential/i);
  });

  it('uses the host text when present', () => {
    const a = resolveBookingAgreement({
      require_nda: true,
      booking_agreement_type: 'waiver',
      booking_agreement_text: 'My custom waiver.',
    });
    expect(a?.label).toBe('Waiver');
    expect(a?.body).toBe('My custom waiver.');
  });

  it('has starter copy for each type', () => {
    expect(defaultBookingAgreementText('approval')).toMatch(/approve/i);
    expect(defaultBookingAgreementText('other')).toBe('');
  });
});
