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

export function hostAllowsSms(profile: {
  sms_opt_in?: boolean | null;
  default_reminder_channel?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (typeof profile.sms_opt_in === 'boolean') return profile.sms_opt_in;
  return profile.default_reminder_channel === 'sms';
}

export function hostAllowsWhatsapp(profile: {
  whatsapp_opt_in?: boolean | null;
  default_reminder_channel?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (typeof profile.whatsapp_opt_in === 'boolean') return profile.whatsapp_opt_in;
  return profile.default_reminder_channel === 'whatsapp';
}
