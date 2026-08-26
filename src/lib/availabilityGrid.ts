/** Half-hour weekly availability helpers (UI grid ↔ DB ranges). */

export const HALF_HOUR_TIMES: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    HALF_HOUR_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

/** Visible grid window: 6 AM – 9 PM (half hours). */
export const GRID_START = '06:00';
export const GRID_END = '21:00';

export const GRID_TIMES = HALF_HOUR_TIMES.filter((t) => t >= GRID_START && t < GRID_END);
export const GRID_AM = GRID_TIMES.filter((t) => t < '12:00');
export const GRID_PM = GRID_TIMES.filter((t) => t >= '12:00');

export const DEFAULT_WEEKDAY_DAYS: number[] = [1, 2, 3, 4, 5];

/** Mon–Fri default: 9–12 and 1–5 (lunch 12–1 off). */
export const DEFAULT_WEEKDAY_RANGES = [
  { start_time: '09:00', end_time: '12:00' },
  { start_time: '13:00', end_time: '17:00' },
] as const;

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Expand [start, end) into half-hour slot starts. */
export function rangeToHalfHours(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = timeToMinutes(start);
  const endM = timeToMinutes(end);
  while (cur < endM) {
    out.push(minutesToTime(cur));
    cur += 30;
  }
  return out;
}

export function halfHoursToRanges(slots: string[]): { start: string; end: string }[] {
  if (slots.length === 0) return [];
  const sorted = [...new Set(slots)].sort();
  const ranges: { start: string; end: string }[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i];
    if (timeToMinutes(t) === timeToMinutes(prev) + 30) {
      prev = t;
      continue;
    }
    ranges.push({ start, end: minutesToTime(timeToMinutes(prev) + 30) });
    start = t;
    prev = t;
  }
  ranges.push({ start, end: minutesToTime(timeToMinutes(prev) + 30) });
  return ranges;
}

export function defaultWeekdayHalfHours(): string[] {
  return DEFAULT_WEEKDAY_RANGES.flatMap((r) => rangeToHalfHours(r.start_time, r.end_time));
}

export function formatHalfHourLabel(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return String(display);
  return `${display}:30`;
}

export function formatRangesSummary(slots: string[]): string {
  const ranges = halfHoursToRanges(slots);
  if (ranges.length === 0) return 'Unavailable';
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${display} ${ampm}` : `${display}:${mStr} ${ampm}`;
  };
  return ranges.map((r) => `${fmt(r.start)} – ${fmt(r.end)}`).join(', ');
}

export function defaultAvailabilityRows(hostId: string) {
  return DEFAULT_WEEKDAY_DAYS.flatMap((d) =>
    DEFAULT_WEEKDAY_RANGES.map((r) => ({
      host_id: hostId,
      day_of_week: d,
      start_time: r.start_time,
      end_time: r.end_time,
      is_active: true,
    })),
  );
}
