import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOOKING_OG_IMAGE,
  bookingShareDescription,
  bookingShareImage,
  bookingShareName,
  bookingShareTitle,
} from './bookingShareMeta';

describe('bookingShareMeta', () => {
  it('prefers company name over person', () => {
    expect(
      bookingShareTitle({
        business_name: 'Tech company',
        full_name: 'peter',
      }),
    ).toBe('Book a Meeting - Tech company');
  });

  it('uses person name when there is no company', () => {
    expect(bookingShareName({ full_name: 'Jane Doe' })).toBe('Jane Doe');
    expect(bookingShareTitle({ full_name: 'Jane Doe' })).toBe('Book a Meeting - Jane Doe');
  });

  it('uses paid-booking display name as company when business_name is empty', () => {
    expect(
      bookingShareTitle({
        full_name: 'Jane Doe',
        paid_booking_settings: { display_name: 'Acme Landscaping' },
      }),
    ).toBe('Book a Meeting - Acme Landscaping');
  });

  it('uses company logo, then avatar, then PinOnIt mark', () => {
    expect(
      bookingShareImage({
        avatar_url: 'https://cdn.example/me.png',
        paid_booking_settings: { business_photo_url: 'https://cdn.example/logo.png' },
      }),
    ).toBe('https://cdn.example/logo.png');
    expect(bookingShareImage({ avatar_url: '/avatars/me.png' })).toBe(
      'https://pinonit.com/avatars/me.png',
    );
    expect(bookingShareImage({})).toBe(DEFAULT_BOOKING_OG_IMAGE);
  });

  it('falls back description to pick-a-time copy', () => {
    expect(bookingShareDescription({ business_name: 'Acme' })).toBe(
      'Pick a time to meet with Acme.',
    );
  });
});
