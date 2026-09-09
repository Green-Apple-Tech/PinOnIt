import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR_CONFLICT_SETTINGS } from './types';
import { buildSlots, shouldBlockCalendarEvent } from './bookingSlots';
import type { AvailabilitySlot, DateOverride, Service } from './types';

function stubService(over: Partial<Service> = {}): Service {
  return {
    id: 'svc',
    host_id: 'host',
    name: 'Consult',
    description: '',
    duration_minutes: 60,
    price_cents: 0,
    color: '#5864C6',
    is_active: true,
    location_type: 'in_person',
    location: '',
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_notice_hours: 0,
    booking_window_days: 7,
    slot_increment_minutes: 60,
    max_bookings_per_day: null,
    meeting_type: 'one_on_one',
    created_at: '',
    updated_at: '',
    ...over,
  } as Service;
}

describe('buildSlots', () => {
  const monday = new Date(2026, 8, 14, 8, 0, 0); // Monday Sep 14 2026
  const availability: AvailabilitySlot[] = [
    { id: 'a', host_id: 'h', day_of_week: 1, start_time: '09:00', end_time: '12:00', is_active: true, created_at: '' },
  ];

  it('offers in-hours slots and skips times already booked', () => {
    const slots = buildSlots(
      availability,
      [{ start_time: new Date(2026, 8, 14, 10, 0, 0).toISOString(), end_time: new Date(2026, 8, 14, 11, 0, 0).toISOString() }],
      stubService(),
      [],
      [],
      monday,
    );
    const day = slots.get('2026-09-14') ?? [];
    expect(day).toContain('09:00');
    expect(day).not.toContain('10:00');
    expect(day).not.toContain('08:00');
  });

  it('honors buffer_after so a 9am booking blocks an 8am slot when the service needs 60m after', () => {
    const slots = buildSlots(
      [
        { id: 'a', host_id: 'h', day_of_week: 1, start_time: '08:00', end_time: '12:00', is_active: true, created_at: '' },
      ],
      [{ start_time: new Date(2026, 8, 14, 9, 0, 0).toISOString(), end_time: new Date(2026, 8, 14, 10, 0, 0).toISOString() }],
      stubService({ buffer_after_minutes: 60, duration_minutes: 60, slot_increment_minutes: 60 }),
      [],
      [],
      monday,
    );
    const day = slots.get('2026-09-14') ?? [];
    expect(day).not.toContain('08:00');
  });

  it('skips a blocked date override', () => {
    const overrides: DateOverride[] = [{
      id: 'o',
      host_id: 'h',
      override_date: '2026-09-14',
      is_blocked: true,
      start_time: null,
      end_time: null,
      reason: '',
      created_at: '',
    }];
    const slots = buildSlots(availability, [], stubService(), overrides, [], monday);
    expect(slots.get('2026-09-14')).toBeUndefined();
  });
});

describe('shouldBlockCalendarEvent', () => {
  it('blocks busy timed events and ignores transparent ones', () => {
    const s = DEFAULT_CALENDAR_CONFLICT_SETTINGS;
    expect(shouldBlockCalendarEvent({
      start_at: '', end_at: '', all_day: false, show_status: 'busy', transparency: null,
      attendee_self_status: null, is_birthday_cal: false, is_holiday_cal: false, title: 'Meet',
    }, s)).toBe(true);
    expect(shouldBlockCalendarEvent({
      start_at: '', end_at: '', all_day: false, show_status: 'free', transparency: 'transparent',
      attendee_self_status: null, is_birthday_cal: false, is_holiday_cal: false, title: 'Focus',
    }, s)).toBe(false);
  });
});
