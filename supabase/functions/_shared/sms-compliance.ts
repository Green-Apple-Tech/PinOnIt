/** Guest/host SMS opt-in checks for outbound messaging. */

export function notifyViaIncludesSms(notifyVia: unknown): boolean {
  return Array.isArray(notifyVia) && notifyVia.includes('sms');
}

export function notifyViaIncludesWhatsapp(notifyVia: unknown): boolean {
  return Array.isArray(notifyVia) && notifyVia.includes('whatsapp');
}

export function bookingAllowsGuestSms(booking: {
  guest_phone?: string | null;
  notify_via?: unknown;
}): boolean {
  const phone = booking.guest_phone?.trim();
  if (!phone) return false;
  return notifyViaIncludesSms(booking.notify_via);
}

export function bookingAllowsGuestWhatsapp(booking: {
  guest_phone?: string | null;
  notify_via?: unknown;
}): boolean {
  const phone = booking.guest_phone?.trim();
  if (!phone) return false;
  return notifyViaIncludesWhatsapp(booking.notify_via);
}
