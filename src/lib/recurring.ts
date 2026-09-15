export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type RecurrenceEndType = 'never' | 'occurrences' | 'date';

export function addRecurrence(
  date: Date,
  frequency: RecurrenceFrequency,
  intervalDays?: number | null,
): Date {
  const next = new Date(date);
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'biweekly') {
    next.setDate(next.getDate() + 14);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + Math.max(1, intervalDays ?? 1));
  }
  return next;
}

export function getUpcomingRecurrenceDates(
  start: Date,
  frequency: RecurrenceFrequency,
  count: number,
  intervalDays?: number | null,
): Date[] {
  const dates: Date[] = [new Date(start)];
  let cur = new Date(start);
  for (let i = 1; i < count; i++) {
    cur = addRecurrence(cur, frequency, intervalDays);
    dates.push(new Date(cur));
  }
  return dates;
}

export function formatRecurrenceBadge(
  frequency: RecurrenceFrequency,
  intervalDays?: number | null,
): string {
  if (frequency === 'weekly') return 'Repeats weekly';
  if (frequency === 'biweekly') return 'Repeats every 2 weeks';
  if (frequency === 'monthly') return 'Repeats monthly';
  const n = Math.max(1, intervalDays ?? 1);
  return n === 1 ? 'Repeats every day' : `Repeats every ${n} days`;
}

export function formatRecurrencePeriod(
  frequency: RecurrenceFrequency,
  intervalDays?: number | null,
): string {
  if (frequency === 'weekly') return 'week';
  if (frequency === 'biweekly') return '2 weeks';
  if (frequency === 'monthly') return 'month';
  const n = Math.max(1, intervalDays ?? 1);
  return n === 1 ? 'day' : `${n} days`;
}

export function formatRecurrenceHostLabel(
  frequency: RecurrenceFrequency,
  intervalDays?: number | null,
): string {
  if (frequency === 'weekly') return 'every week';
  if (frequency === 'biweekly') return 'every 2 weeks';
  if (frequency === 'monthly') return 'every month';
  const n = Math.max(1, intervalDays ?? 1);
  return n === 1 ? 'every day' : `every ${n} days`;
}

export function getSeriesRootId(booking: { id: string; parent_booking_id?: string | null }): string {
  return booking.parent_booking_id ?? booking.id;
}

export function countRecurringSeriesOnSlot(
  bookings: {
    id: string;
    service_id?: string | null;
    start_time: string;
    status: string;
    is_recurring?: boolean;
    parent_booking_id?: string | null;
    standing_job_id?: string | null;
  }[],
  serviceId: string,
  dateKey: string,
  slot: string,
): number {
  const [sh, sm] = slot.split(':').map(Number);
  const targetDow = new Date(`${dateKey}T12:00:00`).getDay();
  const series = new Set<string>();

  for (const b of bookings) {
    if (b.service_id !== serviceId || b.status === 'canceled' || b.status === 'skipped') continue;
    if (!b.is_recurring && !b.standing_job_id) continue;
    const start = new Date(b.start_time);
    if (start.getDay() !== targetDow) continue;
    if (start.getHours() !== sh || start.getMinutes() !== sm) continue;
    series.add(b.standing_job_id || getSeriesRootId(b));
  }

  return series.size;
}

export function shouldStopRecurrence(
  nextDate: Date,
  occurrenceIndex: number,
  endType: RecurrenceEndType,
  endDate: string | null,
  endOccurrences: number | null,
): boolean {
  if (endType === 'date' && endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (nextDate > end) return true;
  }
  if (endType === 'occurrences' && endOccurrences != null && occurrenceIndex >= endOccurrences) {
    return true;
  }
  return false;
}

export function getRecurrenceEndType(
  endDate: string | null | undefined,
  endOccurrences: number | null | undefined,
): RecurrenceEndType {
  if (endOccurrences != null && endOccurrences > 0) return 'occurrences';
  if (endDate) return 'date';
  return 'never';
}
