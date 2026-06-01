export type ReminderChannelPreference = 'email' | 'sms' | 'whatsapp' | 'voice';

export const DEFAULT_REMINDER_CHANNEL: ReminderChannelPreference = 'whatsapp';

export function resolveDefaultReminderChannel(
  value: string | null | undefined
): ReminderChannelPreference {
  if (value === 'email' || value === 'sms' || value === 'whatsapp' || value === 'voice') {
    return value;
  }
  return DEFAULT_REMINDER_CHANNEL;
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
