export type ReminderChannelPreference = 'email' | 'sms' | 'whatsapp' | 'voice';

export const DEFAULT_REMINDER_CHANNEL: ReminderChannelPreference = 'email';

export function resolveDefaultReminderChannel(
  value: string | null | undefined
): ReminderChannelPreference {
  if (value === 'email' || value === 'sms' || value === 'whatsapp' || value === 'voice') {
    return value;
  }
  return DEFAULT_REMINDER_CHANNEL;
}

/** Host SMS/WhatsApp consent is stored independently of default_reminder_channel. */
export function hostHasSmsConsent(profile: {
  sms_opt_in?: boolean | null;
  default_reminder_channel?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (typeof profile.sms_opt_in === 'boolean') return profile.sms_opt_in;
  return profile.default_reminder_channel === 'sms';
}

export function hostHasWhatsappConsent(profile: {
  whatsapp_opt_in?: boolean | null;
  default_reminder_channel?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (typeof profile.whatsapp_opt_in === 'boolean') return profile.whatsapp_opt_in;
  return profile.default_reminder_channel === 'whatsapp';
}

/** Host SMS/voice destination — profiles.phone is the canonical field. */
export function getHostPhone(profile: {
  phone?: string | null;
  critical_alert_phone?: string | null;
} | null | undefined): string | null {
  if (!profile) return null;
  return profile.phone || profile.critical_alert_phone || null;
}

/** Host WhatsApp destination — whatsapp_number if set, otherwise phone. */
export function getWhatsappNumber(profile: {
  whatsapp_number?: string | null;
  phone?: string | null;
} | null | undefined): string | null {
  if (!profile) return null;
  return profile.whatsapp_number || profile.phone || null;
}
