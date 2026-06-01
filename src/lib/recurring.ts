export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';
export type RecurrenceEndType = 'never' | 'occurrences' | 'date';

export function addRecurrence(date: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(date);
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'biweekly') {
    next.setDate(next.getDate() + 14);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export function getUpcomingRecurrenceDates(
  start: Date,
  frequency: RecurrenceFrequency,
  count: number,
): Date[] {
  const dates: Date[] = [new Date(start)];
  let cur = new Date(start);
  for (let i = 1; i < count; i++) {
    cur = addRecurrence(cur, frequency);
    dates.push(new Date(cur));
  }
  return dates;
}

export function formatRecurrenceBadge(frequency: RecurrenceFrequency): string {
  if (frequency === 'weekly') return 'Repeats weekly';
  if (frequency === 'biweekly') return 'Repeats every 2 weeks';
  return 'Repeats monthly';
}

export function formatRecurrencePeriod(frequency: RecurrenceFrequency): string {
  if (frequency === 'weekly') return 'week';
  if (frequency === 'biweekly') return '2 weeks';
  return 'month';
}

export function formatRecurrenceHostLabel(frequency: RecurrenceFrequency): string {
  if (frequency === 'weekly') return 'every week';
  if (frequency === 'biweekly') return 'every 2 weeks';
  return 'every month';
}

export function getSeriesRootId(booking: { id: string; parent_booking_id?: string | null }): string {
  return booking.parent_booking_id ?? booking.id;
}

export function countRecurringSeriesOnSlot(
  bookings: { id: string; service_id: string; start_time: string; status: string; is_recurring?: boolean; parent_booking_id?: string | null }[],
  serviceId: string,
  dateKey: string,
  slot: string,
): number {
  const [sh, sm] = slot.split(':').map(Number);
  const targetDow = new Date(`${dateKey}T12:00:00`).getDay();
  const series = new Set<string>();

  for (const b of bookings) {
    if (b.service_id !== serviceId || b.status === 'canceled' || !b.is_recurring) continue;
    const start = new Date(b.start_time);
    if (start.getDay() !== targetDow) continue;
    if (start.getHours() !== sh || start.getMinutes() !== sm) continue;
    series.add(getSeriesRootId(b));
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
