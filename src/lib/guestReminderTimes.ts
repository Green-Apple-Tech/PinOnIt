/** Guest booking-wizard reminder_times → minutes before start (negative). */
export const GUEST_REMINDER_TIME_OFFSETS: Record<string, number> = {
  '15min': -15,
  '30min': -30,
  '1hour': -60,
  '2hour': -120,
  '6hour': -360,
  '24hour': -1440,
};

export function guestReminderOffsetMinutes(timeId: string | null | undefined): number | null {
  if (!timeId) return null;
  const n = GUEST_REMINDER_TIME_OFFSETS[timeId];
  return typeof n === 'number' ? n : null;
}

/** True when fireAt is due and not older than lateWindowMs. */
export function isReminderDue(fireAtMs: number, nowMs: number, lateWindowMs: number): boolean {
  if (fireAtMs > nowMs) return false;
  return nowMs - fireAtMs <= lateWindowMs;
}
