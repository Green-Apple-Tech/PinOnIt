/** Contact NeverMiss override — keep in sync with src/lib/contactReminderOverride.ts */

export type ContactReminderChannel = 'email' | 'sms' | 'whatsapp' | 'voice';

const CHANNEL_SET = new Set(['email', 'sms', 'whatsapp', 'voice']);
const TIME_SET = new Set(['15min', '30min', '1hour', '2hour', '6hour', '24hour']);

export type ContactReminderOverride = {
  channels: ContactReminderChannel[];
  times: string[];
};

export function normalizeContactReminderOverride(raw: unknown): ContactReminderOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const channels = Array.isArray(row.channels)
    ? (row.channels as string[]).filter((c): c is ContactReminderChannel => CHANNEL_SET.has(c))
    : [];
  const times = Array.isArray(row.times)
    ? (row.times as string[]).filter((t) => TIME_SET.has(t))
    : [];
  if (!channels.length || !times.length) return null;
  return { channels, times };
}

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
