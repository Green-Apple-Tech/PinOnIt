/** Link-preview title + image for public booking URLs (iMessage / SMS). */

export const DEFAULT_BOOKING_OG_IMAGE = 'https://pinonit.com/pinonit_logo.png';
export const DEFAULT_BOOKING_ORIGIN = 'https://pinonit.com';

export type BookingShareHost = {
  slug?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  paid_booking_settings?: {
    display_name?: string | null;
    business_photo_url?: string | null;
    tagline?: string | null;
  } | null;
};

/** Company/DBA first, then Paid Booking display name, then the person’s name. */
export function bookingShareName(host: BookingShareHost | null | undefined): string {
  const company = host?.business_name?.trim() || host?.paid_booking_settings?.display_name?.trim() || '';
  const person = host?.full_name?.trim() || '';
  return company || person;
}

export function bookingShareTitle(host: BookingShareHost | null | undefined): string {
  const name = bookingShareName(host);
  return name ? `Book a Meeting - ${name}` : 'Book a Meeting';
}

export function bookingShareDescription(host: BookingShareHost | null | undefined): string {
  const tagline = host?.paid_booking_settings?.tagline?.trim();
  if (tagline) return tagline;
  const name = bookingShareName(host);
  return name ? `Pick a time to meet with ${name}.` : 'Pick a time to meet.';
}

export function absolutizeUrl(raw: string, origin = DEFAULT_BOOKING_ORIGIN): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const base = origin.replace(/\/$/, '');
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

export function bookingShareImage(
  host: BookingShareHost | null | undefined,
  origin = DEFAULT_BOOKING_ORIGIN,
): string {
  const raw =
    host?.paid_booking_settings?.business_photo_url?.trim() ||
    host?.avatar_url?.trim() ||
    '';
  if (!raw) return DEFAULT_BOOKING_OG_IMAGE;
  return absolutizeUrl(raw, origin) || DEFAULT_BOOKING_OG_IMAGE;
}

export function bookingShareCanonical(slug: string, origin = DEFAULT_BOOKING_ORIGIN): string {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  return `${origin.replace(/\/$/, '')}/${clean}`;
}
