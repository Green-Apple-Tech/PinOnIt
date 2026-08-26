/** Defaults and helpers for host Critical Meeting Alerts. */

export type CriticalAlertSettings = {
  /** SMS minutes-before offsets (negative). Default: 1h + 15m. */
  sms_offsets: number[];
  /** WhatsApp minutes-before offsets. Default: 1h + 15m. */
  whatsapp_offsets: number[];
  /** Email minutes-before offsets. Default: 1 day + 4h. */
  email_offsets: number[];
  /** Optional voice calls. Off by default — enable in Advanced. */
  voice_enabled: boolean;
  /** Voice minutes-before offsets when enabled. Default: 5m + 1m. */
  voice_offsets: number[];
};

export const DEFAULT_CRITICAL_ALERT_SETTINGS: CriticalAlertSettings = {
  sms_offsets: [-60, -15],
  whatsapp_offsets: [-60, -15],
  email_offsets: [-1440, -240],
  voice_enabled: false,
  voice_offsets: [-5, -1],
};

const OFFSET_CHOICES = [
  { value: -1, label: '1 min before' },
  { value: -5, label: '5 min before' },
  { value: -15, label: '15 min before' },
  { value: -30, label: '30 min before' },
  { value: -60, label: '1 hour before' },
  { value: -120, label: '2 hours before' },
  { value: -240, label: '4 hours before' },
  { value: -1440, label: '1 day before' },
  { value: -2880, label: '2 days before' },
] as const;

export const CRITICAL_OFFSET_CHOICES = OFFSET_CHOICES;

export function formatCriticalOffset(minutes: number): string {
  const found = OFFSET_CHOICES.find((c) => c.value === minutes);
  if (found) return found.label;
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs} min before`;
  if (abs < 1440) return `${Math.round(abs / 60)} hour${abs === 60 ? '' : 's'} before`;
  const days = Math.round(abs / 1440);
  return `${days} day${days === 1 ? '' : 's'} before`;
}

function asOffsetArray(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return [...fallback];
  const nums = raw
    .map((n) => (typeof n === 'number' ? n : Number(n)))
    .filter((n) => Number.isFinite(n) && n < 0)
    .map((n) => Math.round(n));
  return nums.length > 0 ? nums.slice(0, 4) : [...fallback];
}

export function normalizeCriticalAlertSettings(raw: unknown): CriticalAlertSettings {
  const d = DEFAULT_CRITICAL_ALERT_SETTINGS;
  if (!raw || typeof raw !== 'object') return { ...d, sms_offsets: [...d.sms_offsets], whatsapp_offsets: [...d.whatsapp_offsets], email_offsets: [...d.email_offsets], voice_offsets: [...d.voice_offsets] };
  const o = raw as Record<string, unknown>;
  return {
    sms_offsets: asOffsetArray(o.sms_offsets, d.sms_offsets),
    whatsapp_offsets: asOffsetArray(o.whatsapp_offsets, d.whatsapp_offsets),
    email_offsets: asOffsetArray(o.email_offsets, d.email_offsets),
    voice_enabled: o.voice_enabled === true,
    voice_offsets: asOffsetArray(o.voice_offsets, d.voice_offsets),
  };
}

/** Dispatch key stored on bookings.critical_alerts_sent */
export function criticalDispatchKey(channel: string, offsetMinutes: number): string {
  return `${channel}:${offsetMinutes}`;
}
