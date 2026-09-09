import type {
  AvailabilitySlot,
  Booking,
  CalendarConflictSettings,
  DateOverride,
  Service,
} from './types';

export type BusyPeriod = { start: Date; end: Date };

export type SyncedCalendarEvent = {
  start_at: string;
  end_at: string;
  all_day: boolean;
  show_status: string | null;
  transparency: string | null;
  attendee_self_status: string | null;
  is_birthday_cal: boolean;
  is_holiday_cal: boolean;
  title: string;
};

export type PublicBusyPayload = {
  bookings?: Pick<Booking, 'id' | 'start_time' | 'end_time' | 'status'>[];
  events?: SyncedCalendarEvent[];
};

const BLOCKING_TITLE_KEYWORDS = [
  'vacation', 'pto', 'out of office', 'ooo', 'leave', 'sick day', 'sick leave',
  'annual leave', 'personal day', 'time off', 'parental leave',
];

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function titleIndicatesBlocking(title: string): boolean {
  const t = (title ?? '').toLowerCase();
  return BLOCKING_TITLE_KEYWORDS.some((kw) => t.includes(kw));
}

/** true = block this time, false = ignore it. */
export function shouldBlockCalendarEvent(
  e: SyncedCalendarEvent,
  settings: CalendarConflictSettings,
): boolean {
  if (e.show_status === 'cancelled') return false;

  const isExplicitlyFree = e.transparency === 'transparent' || e.show_status === 'free';
  const isOOF = e.show_status === 'oof';
  const isTentative = e.show_status === 'tentative';
  const isDeclined = e.attendee_self_status === 'declined';
  const isBirthdayOrHoliday = e.is_birthday_cal || e.is_holiday_cal;

  if (isDeclined) return settings.block_declined;
  if (isTentative) return settings.block_tentative;

  if (e.all_day) {
    if (isOOF) return true;
    if (titleIndicatesBlocking(e.title)) return true;
    if (isBirthdayOrHoliday) return settings.block_free_all_day;
    if (isExplicitlyFree) return settings.block_free_all_day;
    return settings.block_all_day_busy;
  }

  if (isExplicitlyFree && !isOOF) return false;
  return true;
}

export function busyPeriodsFromEvents(
  rawEvents: SyncedCalendarEvent[],
  settings: CalendarConflictSettings,
): BusyPeriod[] {
  const busyPeriods: BusyPeriod[] = [];
  for (const e of rawEvents) {
    if (!shouldBlockCalendarEvent(e, settings)) continue;
    if (e.all_day) {
      const startDay = new Date(e.start_at);
      startDay.setUTCHours(0, 0, 0, 0);
      const endDay = new Date(e.end_at);
      endDay.setUTCHours(23, 59, 59, 999);
      busyPeriods.push({ start: startDay, end: endDay });
    } else {
      busyPeriods.push({ start: new Date(e.start_at), end: new Date(e.end_at) });
    }
  }
  return busyPeriods;
}

/** Same slot grid as the public booking page. */
export function buildSlots(
  availability: AvailabilitySlot[],
  existingBookings: Pick<Booking, 'start_time' | 'end_time'>[],
  service: Pick<
    Service,
    | 'duration_minutes'
    | 'buffer_before_minutes'
    | 'buffer_after_minutes'
    | 'min_notice_hours'
    | 'booking_window_days'
    | 'slot_increment_minutes'
    | 'max_bookings_per_day'
  >,
  dateOverrides: DateOverride[],
  busyTimes: BusyPeriod[] = [],
  now = new Date(),
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const minNotice = new Date(now.getTime() + service.min_notice_hours * 3600000);
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + service.booking_window_days);

  const availByDay = new Map<number, AvailabilitySlot[]>();
  for (const a of availability) {
    if (!a.is_active) continue;
    const list = availByDay.get(a.day_of_week) ?? [];
    list.push(a);
    availByDay.set(a.day_of_week, list);
  }

  const overrideMap = new Map<string, DateOverride>();
  for (const ov of dateOverrides) overrideMap.set(ov.override_date, ov);

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), windowEnd.getDate());
  while (cursor <= lastDay) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const d = cursor.getDate();
    const date = new Date(year, month, d);
    const dk = toDateKey(date);

    const override = overrideMap.get(dk);
    if (override?.is_blocked) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    let windows: { start: string; end: string }[] = [];
    if (override && !override.is_blocked && override.start_time && override.end_time) {
      windows = [{ start: override.start_time, end: override.end_time }];
    } else {
      const daySlots = availByDay.get(date.getDay()) ?? [];
      windows = daySlots.map((s) => ({ start: s.start_time, end: s.end_time }));
    }
    if (!windows.length) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const bookingsOnDay = existingBookings.filter((b) => toDateKey(new Date(b.start_time)) === dk);
    if (service.max_bookings_per_day !== null && bookingsOnDay.length >= service.max_bookings_per_day) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const slots: string[] = [];
    for (const win of windows) {
      const [sh, sm] = win.start.split(':').map(Number);
      const [eh, em] = win.end.split(':').map(Number);
      const endMinutes = eh * 60 + em;
      const increment = service.slot_increment_minutes || 30;
      let cur = sh * 60 + sm;
      while (cur + service.duration_minutes + service.buffer_after_minutes <= endMinutes) {
        const slotH = Math.floor(cur / 60);
        const slotM = cur % 60;
        const slotKey = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;
        const slotStart = new Date(year, month, d, slotH, slotM);
        const slotEnd = new Date(slotStart.getTime() + (service.duration_minutes + service.buffer_after_minutes) * 60000);
        const blockStart = new Date(slotStart.getTime() - service.buffer_before_minutes * 60000);
        if (slotStart < minNotice) {
          cur += increment;
          continue;
        }
        const bookingConflict = existingBookings.some((b) => {
          const bStart = new Date(b.start_time);
          const bEnd = new Date(b.end_time);
          return blockStart < bEnd && slotEnd > bStart;
        });
        const calendarConflict = busyTimes.some((b) => blockStart < b.end && slotEnd > b.start);
        if (!bookingConflict && !calendarConflict) slots.push(slotKey);
        cur += increment;
      }
    }
    if (slots.length) result.set(dk, slots);
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function formatSlotTime12(time: string): string {
  const match = String(time ?? '').trim().match(/(\d{1,2}):(\d{2})/);
  if (!match) return String(time ?? '').trim() || '—';
  const hour = parseInt(match[1], 10);
  const mins = match[2];
  if (Number.isNaN(hour)) return String(time);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${mins} ${ampm}`;
}
