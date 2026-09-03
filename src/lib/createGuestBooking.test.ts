import { describe, expect, it } from 'vitest';
import { mapCreateGuestBookingError } from './createGuestBooking';

describe('mapCreateGuestBookingError', () => {
  it('maps guest blocklist errors', () => {
    expect(mapCreateGuestBookingError('guest_blocked', 'P0001')).toBe(
      'This email cannot book with this host.',
    );
  });

  it('maps inactive host plans', () => {
    expect(mapCreateGuestBookingError('host_inactive')).toBe(
      'This host is not taking bookings right now.',
    );
  });

  it('maps unavailable services', () => {
    expect(mapCreateGuestBookingError('invalid_service')).toBe(
      'This meeting type is no longer available.',
    );
  });

  it('keeps a generic fallback', () => {
    expect(mapCreateGuestBookingError('new row violates row-level security')).toBe(
      'Could not complete this booking. Please try another time.',
    );
  });
});
