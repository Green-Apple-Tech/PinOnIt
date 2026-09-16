import { documentsNewPath } from './documentActions';
import type { SmbDocumentType } from './types';

export const STANDING_HORIZON_DAYS = 90;

export type StandingFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type StandingJobStatus = 'active' | 'paused' | 'ended' | 'pending_host_confirmation' | 'declined';
export type StandingJobOrigin = 'host' | 'guest';

export type StandingJob = {
  id: string;
  host_id: string;
  service_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  frequency: StandingFrequency;
  interval_days: number | null;
  /** 0=Sun … 6=Sat. Empty/null = use the start date’s weekday. */
  weekdays?: number[] | null;
  /** Monthly: 1–4 or -1 (last). Null = same calendar date each month. */
  month_nth?: number | null;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  ends_at: string | null;
  occurrence_count: number | null;
  price_cents: number;
  notes: string;
  status: StandingJobStatus;
  origin?: StandingJobOrigin;
  first_booking_id?: string | null;
  sms_consent: boolean;
  whatsapp_consent: boolean;
  notify_via: string[] | null;
  reminder_channels: string[] | null;
  reminder_times: string[] | null;
  created_at: string;
  updated_at: string;
  services?: { name: string; duration_minutes: number } | null;
};

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const MONTH_NTH_OPTIONS = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: -1, label: 'Last' },
] as const;

export function resolvedWeekdays(weekdays: number[] | null | undefined, anchorDow: number): number[] {
  const unique = [...new Set((weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
  return unique.length ? unique : [((anchorDow % 7) + 7) % 7];
}

export function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
  if (nth === -1) {
    const last = new Date(year, month + 1, 0);
    last.setDate(last.getDate() - ((last.getDay() - weekday + 7) % 7));
    return last;
  }
  if (nth < 1 || nth > 4) return null;
  const first = new Date(year, month, 1);
  first.setDate(1 + ((weekday - first.getDay() + 7) % 7) + (nth - 1) * 7);
  if (first.getMonth() !== month) return null;
  return first;
}

function startOfSundayWeek(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

function sameYmd(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dateMatchesStandingRule(
  localDate: Date,
  startsAt: Date,
  frequency: StandingFrequency,
  intervalDays?: number | null,
  weekdays?: number[] | null,
  monthNth?: number | null,
): boolean {
  const startDay = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const curDay = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
  if (curDay.getTime() < startDay.getTime()) return false;

  if (frequency === 'custom') {
    const diff = Math.round((curDay.getTime() - startDay.getTime()) / 86400000);
    return diff % Math.max(1, intervalDays ?? 1) === 0;
  }

  const dows = resolvedWeekdays(weekdays, startsAt.getDay());

  if (frequency === 'weekly') return dows.includes(curDay.getDay());

  if (frequency === 'biweekly') {
    if (!dows.includes(curDay.getDay())) return false;
    const weeks = Math.round(
      (startOfSundayWeek(curDay).getTime() - startOfSundayWeek(startDay).getTime()) / (7 * 86400000),
    );
    return weeks % 2 === 0;
  }

  if (monthNth != null && monthNth !== 0) {
    const wd = resolvedWeekdays(weekdays, startsAt.getDay())[0];
    const target = nthWeekdayOfMonth(curDay.getFullYear(), curDay.getMonth(), wd, monthNth);
    return target != null && sameYmd(curDay, target);
  }

  const dim = new Date(curDay.getFullYear(), curDay.getMonth() + 1, 0).getDate();
  return curDay.getDate() === Math.min(startsAt.getDate(), dim);
}

/** Move the first visit onto a day that matches Tue/Fri or first-Monday rules. */
export function snapStartToStandingRule(
  startsAt: Date,
  frequency: StandingFrequency,
  intervalDays?: number | null,
  weekdays?: number[] | null,
  monthNth?: number | null,
): Date {
  const snapped = new Date(startsAt);
  for (let i = 0; i < 40; i += 1) {
    if (dateMatchesStandingRule(snapped, snapped, frequency, intervalDays, weekdays, monthNth)) return snapped;
    snapped.setDate(snapped.getDate() + 1);
  }
  return new Date(startsAt);
}

export function addStandingOccurrence(date: Date, frequency: StandingFrequency, intervalDays?: number | null): Date {
  const next = new Date(date);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'biweekly') next.setDate(next.getDate() + 14);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + Math.max(1, intervalDays ?? 1));
  return next;
}

export function standingOccurrenceStarts(opts: {
  startsAt: Date;
  frequency: StandingFrequency;
  intervalDays?: number | null;
  weekdays?: number[] | null;
  monthNth?: number | null;
  horizonEnd: Date;
  endsAt?: Date | null;
  occurrenceCount?: number | null;
  now?: Date;
}): Date[] {
  const now = opts.now ?? new Date();
  const start = new Date(opts.startsAt);
  const dates: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(opts.horizonEnd.getFullYear(), opts.horizonEnd.getMonth(), opts.horizonEnd.getDate());
  let n = 0;
  while (n < 400 && cursor.getTime() <= last.getTime()) {
    n += 1;
    if (dateMatchesStandingRule(cursor, start, opts.frequency, opts.intervalDays, opts.weekdays, opts.monthNth)) {
      const occ = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        start.getHours(),
        start.getMinutes(),
        start.getSeconds(),
        start.getMilliseconds(),
      );
      if (opts.occurrenceCount != null && dates.length >= opts.occurrenceCount) break;
      if (opts.endsAt && occ.getTime() > opts.endsAt.getTime()) break;
      if (occ.getTime() >= now.getTime() - 60 * 60 * 1000) dates.push(occ);
      else if (opts.occurrenceCount != null) dates.push(occ);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.filter((d) => d.getTime() >= now.getTime() - 60 * 60 * 1000);
}

function formatWeekdayList(days: number[]): string {
  const labels = days.map((d) => WEEKDAY_SHORT[d] ?? '');
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

export function formatStandingFrequency(
  frequency: StandingFrequency,
  intervalDays?: number | null,
  weekdays?: number[] | null,
  monthNth?: number | null,
): string {
  const days = [...new Set((weekdays ?? []).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (frequency === 'custom') {
    const n = Math.max(1, intervalDays ?? 1);
    return n === 1 ? 'Every day' : `Every ${n} days`;
  }
  if (frequency === 'monthly' && monthNth != null && monthNth !== 0) {
    const nth = MONTH_NTH_OPTIONS.find((o) => o.value === monthNth)?.label ?? 'First';
    const wd = WEEKDAY_FULL[days[0] ?? 1] ?? 'Monday';
    return `${nth} ${wd}`;
  }
  if (frequency === 'monthly') return 'Monthly';
  const prefix = frequency === 'biweekly' ? 'Every 2 weeks' : 'Weekly';
  if (days.length === 0 || (days.length === 1 && frequency === 'weekly')) {
    return days.length === 1 ? `${prefix} on ${WEEKDAY_SHORT[days[0]]}` : prefix;
  }
  return `${prefix} on ${formatWeekdayList(days)}`;
}

export function standingComposePath(
  type: Extract<SmbDocumentType, 'quote' | 'receipt'>,
  customer: { name?: string | null; phone?: string | null; email?: string | null },
): string {
  const base = documentsNewPath(null, type);
  const q = new URLSearchParams(base.split('?')[1] || '');
  if (customer.name?.trim()) q.set('name', customer.name.trim());
  if (customer.phone?.trim()) q.set('phone', customer.phone.trim());
  if (customer.email?.trim()) q.set('email', customer.email.trim());
  return `/dashboard/documents/new?${q.toString()}`;
}

export function nextStandingVisit(
  visits: { start_time: string; status: string }[],
  now = new Date(),
): { start_time: string; status: string } | null {
  const upcoming = visits
    .filter((v) => v.status === 'confirmed' && new Date(v.start_time).getTime() >= now.getTime())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  return upcoming[0] ?? null;
}
