import { GUEST_REMINDER_TIME_OFFSETS } from './guestReminderTimes';

export type ContactReminderChannel = 'email' | 'sms' | 'whatsapp' | 'voice';
export type ContactReminderTimeId = keyof typeof GUEST_REMINDER_TIME_OFFSETS;

export type ContactReminderOverride = {
  channels: ContactReminderChannel[];
  times: ContactReminderTimeId[];
};

export const CONTACT_REMINDER_CHANNEL_OPTIONS: { id: ContactReminderChannel; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'voice', label: 'Voice' },
];

export const CONTACT_REMINDER_TIME_OPTIONS: { id: ContactReminderTimeId; label: string }[] = [
  { id: '15min', label: '15 min before' },
  { id: '30min', label: '30 min before' },
  { id: '1hour', label: '1 hour before' },
  { id: '2hour', label: '2 hours before' },
  { id: '6hour', label: '6 hours before' },
  { id: '24hour', label: '24 hours before' },
];

const CHANNEL_SET = new Set<ContactReminderChannel>(['email', 'sms', 'whatsapp', 'voice']);
const TIME_SET = new Set<string>(Object.keys(GUEST_REMINDER_TIME_OFFSETS));

export function normalizeContactReminderOverride(raw: unknown): ContactReminderOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const channels = Array.isArray(row.channels)
    ? (row.channels as string[]).filter((c): c is ContactReminderChannel =>
        CHANNEL_SET.has(c as ContactReminderChannel),
      )
    : [];
  const times = Array.isArray(row.times)
    ? (row.times as string[]).filter((t): t is ContactReminderTimeId => TIME_SET.has(t))
    : [];
  if (!channels.length || !times.length) return null;
  return { channels, times };
}

export function emptyContactReminderOverride(): ContactReminderOverride {
  return { channels: ['email', 'sms'], times: ['24hour', '1hour'] };
}

/** Prefer contact override when present; otherwise keep booking/account values. */
export function mergeReminderPrefsWithContactOverride(
  base: { channels: string[]; times: string[] },
  override: ContactReminderOverride | null,
): { channels: string[]; times: string[] } {
  if (!override) return base;
  return {
    channels: override.channels.length ? [...override.channels] : base.channels,
    times: override.times.length ? [...override.times] : base.times,
  };
}
