import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Navigate, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { DEFAULT_CALENDAR_CONFLICT_SETTINGS, type CalendarConflictSettings } from '../lib/types';
import { PHONE_PLACEHOLDER, PHONE_HINT, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import {
  type CoordPreferredTimesPayload,
  type CoordParsedSlot,
  type CoordSelectedSlotsMap,
  type CoordSimpleTimeframe,
  type CoordTimeOfDayKey,
  COORD_SIMPLE_TIMEFRAME_LABELS,
  COORD_TIME_OF_DAY_LABELS,
  buildCoordInviteSmsBody,
  buildSimpleCoordSummary,
  fmtCoordDate,
  fmtCoordDuration,
  getDatesForSimpleTimeframe,
  getWindowFromCoordDates,
  parseCoordAvailability,
} from '../lib/coordinateScheduling';
import { Plus, X, ChevronRight, ChevronLeft, ChevronDown, Users, Clock, MapPin, MessageSquare, Check, Loader2, Trash2, AlertCircle, ArrowRight, Phone, Calendar, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';

const BRAND = '#5864C6';

// ── Types ────────────────────────────────────────────────────────────────────

type CoordStatus = 'collecting_availability' | 'match_found' | 'confirmed' | 'cancelled';

interface CoordParticipant {
  id: string;
  meeting_id: string;
  name: string;
  role: string;
  masked_twilio_number: string | null;
  availability_response: string | null;
  availability_pre_entered: boolean;
  parsed_slots: CoordParsedSlot[] | null;
  opted_out: boolean;
  confirmed: boolean;
  created_at: string;
}

interface CoordMeeting {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  location: string | null;
  duration_minutes: number;
  status: CoordStatus;
  proposed_window_start: string | null;
  proposed_window_end: string | null;
  confirmed_time: string | null;
  selected_dates?: string[] | null;
  preferred_times?: CoordPreferredTimesPayload | null;
  check_host_calendar?: boolean;
  allow_off_hours?: boolean;
  created_at: string;
  updated_at: string;
}

interface ParticipantDraft {
  name: string;
  phone: string;
  role: string;
  knownAvailability: string;
  showKnownAvailability: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DURATION_PRESETS = [15, 30, 45, 60, 120] as const;
const ROLE_SUGGESTIONS = ['Patient', 'Doctor', 'Physician', 'Specialist', 'Provider', 'Renter', 'Listing Agent', 'Client', 'Candidate', 'Hiring Manager', 'Inspector', 'Attorney'];

/** Hourly slots 7am–8pm as 24h HH:MM */
const HOURLY_SLOT_TIMES = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

const MORNING_SLOT_TIMES = ['07:00', '08:00', '09:00', '10:00', '11:00'];
const AFTERNOON_SLOT_TIMES = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const SLOT_DAY_START = 7 * 60;
const SLOT_DAY_END = 20 * 60 + 45;

const DEFAULT_WEEKDAY_WINDOWS: { start: number; end: number }[] = [
  { start: 10 * 60, end: 15 * 60 },
];

type SelectedSlotsMap = CoordSelectedSlotsMap;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const STATUS_META: Record<CoordStatus, { label: string; color: string; bg: string; darkBg: string }> = {
  collecting_availability: { label: 'Collecting availability', color: '#d97706', bg: '#fef3c7', darkBg: 'rgba(217,119,6,0.15)' },
  match_found:             { label: 'Match found',             color: BRAND,     bg: '#eef0fb', darkBg: 'rgba(88,100,198,0.15)' },
  confirmed:               { label: 'Confirmed',               color: '#059669', bg: '#d1fae5', darkBg: 'rgba(5,150,105,0.15)' },
  cancelled:               { label: 'Cancelled',               color: '#6b7280', bg: '#f3f4f6', darkBg: 'rgba(107,114,128,0.15)' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***-***-****';
  return `***-***-${digits.slice(-4)}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function normalizeTime(t: string): string | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59 || min % 15 !== 0) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function formatTimeLabel(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const min = parseInt(mStr || '0', 10);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (min === 0) return `${hour12}${suffix}`;
  return `${hour12}:${String(min).padStart(2, '0')}${suffix}`;
}

function fmtDayHeader(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatSelectedSlotsLines(selectedSlots: SelectedSlotsMap): string[] {
  return Object.keys(selectedSlots)
    .sort()
    .filter(d => (selectedSlots[d]?.length ?? 0) > 0)
    .map(d => `📅 ${fmtDayHeader(d)}: ${selectedSlots[d].map(formatTimeLabel).join(', ')}`);
}

function hostSelectedSlotsToBuckets(selectedSlots: SelectedSlotsMap, durationMinutes: number): Set<string> | null {
  const dates = Object.keys(selectedSlots).filter(d => (selectedSlots[d]?.length ?? 0) > 0);
  if (!dates.length) return null;
  const buckets = new Set<string>();
  const steps = Math.ceil(durationMinutes / 15);
  for (const date of dates) {
    for (const time of selectedSlots[date] ?? []) {
      const [h, m] = time.split(':').map(Number);
      let cur = h * 60 + m;
      for (let i = 0; i < steps; i++) {
        buckets.add(`${date}T${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`);
        cur += 15;
      }
    }
  }
  return buckets.size ? buckets : null;
}

function findParticipantOverlaps(
  participantSlotSets: CoordParsedSlot[][],
  durationMinutes: number,
  hostBuckets: Set<string> | null,
): string[] {
  if (participantSlotSets.length === 0) return [];
  const STEP = 15;
  const sets = participantSlotSets.map(slots => {
    const set = new Set<string>();
    for (const slot of slots) {
      const [sh, sm] = slot.start_time.split(':').map(Number);
      const [eh, em] = slot.end_time.split(':').map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur + durationMinutes <= end) {
        set.add(`${slot.date}T${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`);
        cur += STEP;
      }
    }
    return set;
  });
  const [first, ...rest] = sets;
  const common = new Set<string>();
  first.forEach(b => {
    if (rest.every(s => s.has(b)) && (!hostBuckets || hostBuckets.has(b))) {
      common.add(b);
    }
  });
  return Array.from(common).sort().slice(0, 3).map(iso => {
    const [date, time] = iso.split('T');
    return `${date}T${time}:00`;
  });
}

function formatHostSettingsLines(
  hasConnectedCalendar: boolean,
  checkHostCalendar: boolean,
  allowOffHoursGlobal: boolean,
  offHoursByDate: Record<string, boolean>,
): string[] {
  const lines: string[] = [];
  if (hasConnectedCalendar) {
    lines.push(checkHostCalendar ? '📆 Calendar checking: ON' : '📆 Calendar checking: OFF');
  } else {
    lines.push('📆 No calendar connected');
  }
  const perDayOff = Object.entries(offHoursByDate).filter(([, v]) => v).map(([d]) => fmtDayHeader(d));
  if (allowOffHoursGlobal) {
    lines.push('⚠️ Off-hours: enabled for all days');
  } else if (perDayOff.length) {
    lines.push(`⚠️ Off-hours: ${perDayOff.join(', ')}`);
  }
  return lines;
}

function getSelectedSlotsFromMeeting(meeting: CoordMeeting): SelectedSlotsMap {
  const pt = meeting.preferred_times as CoordPreferredTimesPayload | null | undefined;
  return pt?.selectedSlots ?? {};
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface BusyPeriod {
  start: Date;
  end: Date;
}

interface CalendarEventRow {
  start_at: string;
  end_at: string;
  all_day: boolean;
  show_status: string | null;
  transparency: string | null;
  attendee_self_status: string | null;
  is_birthday_cal: boolean;
  is_holiday_cal: boolean;
  title: string;
}

interface HostBooking {
  start_time: string;
  end_time: string;
}

const BLOCKING_TITLE_KEYWORDS = [
  'vacation', 'pto', 'out of office', 'ooo', 'leave', 'sick day', 'sick leave',
  'annual leave', 'personal day', 'time off', 'parental leave',
];

function titleIndicatesBlocking(title: string): boolean {
  const t = (title ?? '').toLowerCase();
  return BLOCKING_TITLE_KEYWORDS.some(kw => t.includes(kw));
}

function shouldBlockCalendarEvent(e: CalendarEventRow, settings: CalendarConflictSettings): boolean {
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

function buildBusyPeriods(events: CalendarEventRow[], settings: CalendarConflictSettings): BusyPeriod[] {
  const periods: BusyPeriod[] = [];
  for (const e of events) {
    if (!shouldBlockCalendarEvent(e, settings)) continue;
    if (e.all_day) {
      // All-day end dates are exclusive (next day) — emit one busy period per calendar day.
      const rangeStart = new Date(e.start_at);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEndExclusive = new Date(e.end_at);
      rangeEndExclusive.setHours(0, 0, 0, 0);
      if (rangeEndExclusive <= rangeStart) {
        rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);
      }
      const cur = new Date(rangeStart);
      while (cur < rangeEndExclusive) {
        const dayStart = new Date(cur);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(cur);
        dayEnd.setHours(23, 59, 59, 999);
        periods.push({ start: dayStart, end: dayEnd });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      periods.push({ start: new Date(e.start_at), end: new Date(e.end_at) });
    }
  }
  return periods;
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function busyPeriodOverlapsDay(period: BusyPeriod, dateStr: string): boolean {
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999`);
  return period.start < dayEnd && period.end > dayStart;
}

function getHostWindowsForDate(dateStr: string, availability: AvailabilitySlot[]): { start: number; end: number }[] {
  const dow = new Date(`${dateStr}T12:00:00`).getDay();
  const fromDb = availability
    .filter(a => a.is_active && a.day_of_week === dow)
    .map(a => ({
      start: timeToMinutes(a.start_time.slice(0, 5)),
      end: timeToMinutes(a.end_time.slice(0, 5)),
    }));
  if (fromDb.length) return fromDb;
  if (dow >= 1 && dow <= 5) return DEFAULT_WEEKDAY_WINDOWS;
  return [];
}

function isSlotInAvailability(dateStr: string, time24: string, availability: AvailabilitySlot[]): boolean {
  const mins = timeToMinutes(time24);
  const windows = getHostWindowsForDate(dateStr, availability);
  return windows.some(w => mins >= w.start && mins < w.end);
}

function filterSelectableSlots(
  dateStr: string,
  candidates: string[],
  includeOffHours: boolean,
  durationMinutes: number,
  availability: AvailabilitySlot[],
  busyPeriods: BusyPeriod[],
  bookings: HostBooking[],
  applyCalendarBusy: boolean,
): string[] {
  return candidates.filter(t => {
    if (!includeOffHours && !isSlotInAvailability(dateStr, t, availability)) return false;
    if (applyCalendarBusy && isSlotBusy(dateStr, t, durationMinutes, busyPeriods, bookings)) return false;
    return true;
  });
}

function getVisibleHours(dateStr: string, availability: AvailabilitySlot[], includeOffHours: boolean): string[] {
  if (includeOffHours) return HOURLY_SLOT_TIMES;
  const windows = getHostWindowsForDate(dateStr, availability);
  return HOURLY_SLOT_TIMES.filter(t => {
    const mins = timeToMinutes(t);
    return windows.some(w => mins >= w.start && mins < w.end);
  });
}

function isSlotBusy(
  dateStr: string,
  time24: string,
  durationMinutes: number,
  busyPeriods: BusyPeriod[],
  bookings: HostBooking[],
): boolean {
  const [h, m] = time24.split(':').map(Number);
  const slotStart = new Date(`${dateStr}T00:00:00`);
  slotStart.setHours(h, m, 0, 0);
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
  const bookingConflict = bookings.some(b => {
    const bStart = new Date(b.start_time);
    if (toLocalDateKey(bStart) !== dateStr) return false;
    const bEnd = new Date(b.end_time);
    return slotStart < bEnd && slotEnd > bStart;
  });
  const calendarConflict = busyPeriods.some(b => {
    if (!busyPeriodOverlapsDay(b, dateStr)) return false;
    return slotStart < b.end && slotEnd > b.start;
  });
  return bookingConflict || calendarConflict;
}

function computeFreeSlotsForDate(
  dateStr: string,
  includeOffHours: boolean,
  durationMinutes: number,
  availability: AvailabilitySlot[],
  busyPeriods: BusyPeriod[],
  bookings: HostBooking[],
  applyCalendarBusy: boolean,
): string[] {
  const visible = getVisibleHours(dateStr, availability, includeOffHours);
  if (!applyCalendarBusy) return [];
  return visible.filter(h => !isSlotBusy(dateStr, h, durationMinutes, busyPeriods, bookings));
}

// ── Shared input style — 52px tall, 16px font to prevent iOS zoom ─────────────

const INP = [
  'w-full px-4 rounded-xl border border-slate-200 dark:border-slate-700',
  'bg-white dark:bg-slate-900 text-slate-900 dark:text-white',
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500',
  'transition text-[16px] leading-none',
  'h-[52px]',
].join(' ');

// ── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

// ── Multi-select calendar ────────────────────────────────────────────────────

function MultiSelectCalendar({
  viewMonth,
  onViewMonthChange,
  selectedDates,
  onToggleDate,
}: {
  viewMonth: Date;
  onViewMonthChange: (d: Date) => void;
  selectedDates: string[];
  onToggleDate: (date: string) => void;
}) {
  const todayStr = toLocalDateInput(new Date());

  const renderMonth = (offset: 0 | 1) => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth() + offset;
    const displayYear = month > 11 ? year + 1 : month < 0 ? year - 1 : year;
    const displayMonth = ((month % 12) + 12) % 12;
    const grid = buildMonthGrid(displayYear, displayMonth);

    return (
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center mb-3">
          {MONTH_NAMES[displayMonth]} {displayYear}
        </p>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((dateStr, i) => {
            if (!dateStr) return <div key={`empty-${i}`} className="aspect-square min-h-[44px]" />;
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const isSelected = selectedDates.includes(dateStr);
            const dayNum = parseInt(dateStr.slice(8), 10);

            return (
              <button
                key={dateStr}
                type="button"
                disabled={isPast}
                onClick={() => onToggleDate(dateStr)}
                className={[
                  'aspect-square min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[16px] font-semibold transition-all',
                  isPast
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : isSelected
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                  isToday && !isSelected ? 'ring-2 ring-emerald-400 ring-offset-1 dark:ring-offset-slate-950' : '',
                  isToday && isSelected ? 'ring-2 ring-emerald-300 ring-offset-1 dark:ring-offset-slate-950' : '',
                ].join(' ')}
                aria-label={`${isSelected ? 'Deselect' : 'Select'} ${dateStr}`}
                aria-pressed={isSelected}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const prevMonth = () => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() - 1);
    onViewMonthChange(d);
  };

  const nextMonth = () => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + 1);
    onViewMonthChange(d);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
          Tap days to select · tap again to deselect
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {renderMonth(0)}
        {renderMonth(1)}
      </div>
    </div>
  );
}

// ── Live selection summary ───────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-7' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

function HostAvailabilitySection({
  hasConnectedCalendar,
  checkHostCalendar,
  onCheckHostCalendarChange,
  allowOffHoursGlobal,
  onAllowOffHoursGlobalChange,
  offHoursByDate,
}: {
  hasConnectedCalendar: boolean;
  checkHostCalendar: boolean;
  onCheckHostCalendarChange: (next: boolean) => void;
  allowOffHoursGlobal: boolean;
  onAllowOffHoursGlobalChange: (next: boolean) => void;
  offHoursByDate: Record<string, boolean>;
}) {
  const anyOffHours = allowOffHoursGlobal || Object.values(offHoursByDate).some(Boolean);

  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4 mt-4">
      <SectionLabel>Host availability</SectionLabel>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-slate-800 dark:text-slate-200">Check against my calendar</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {hasConnectedCalendar
              ? 'Exclude times when you already have bookings on your connected calendar.'
              : 'Connect Google or Outlook in Settings to enable calendar checking.'}
          </p>
          {checkHostCalendar && hasConnectedCalendar && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Busy times from your calendar will be excluded automatically
            </p>
          )}
          {hasConnectedCalendar && !checkHostCalendar && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Calendar checking is off — pick times manually below
            </p>
          )}
        </div>
        <ToggleSwitch
          checked={checkHostCalendar}
          onChange={onCheckHostCalendarChange}
          label="Check against my calendar"
        />
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
        <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={allowOffHoursGlobal}
            onChange={e => onAllowOffHoursGlobalChange(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
          />
          <div>
            <span className="text-[16px] font-semibold text-slate-800 dark:text-slate-200">Allow off-hours if needed</span>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Check this if you&apos;re willing to meet outside your normal availability for this coordination — evenings, weekends, or around existing bookings. Applies to all selected days; you can also toggle off-hours per day below.
            </p>
          </div>
        </label>
        {anyOffHours && (
          <div className="ml-8 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-sm text-amber-800 dark:text-amber-300">
            ⚠️ Off-hours enabled — your normal schedule is being overridden for this coordination
          </div>
        )}
      </div>
    </div>
  );
}

function SelectionSummary({
  selectedSlots,
  durationMinutes,
  hostSettingsLines,
  approachLine,
}: {
  selectedSlots: SelectedSlotsMap;
  durationMinutes: number;
  hostSettingsLines?: string[];
  approachLine?: string;
}) {
  const lines = formatSelectedSlotsLines(selectedSlots);
  const durationLabel = fmtCoordDuration(durationMinutes);

  return (
    <div className="space-y-1.5 text-sm px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
      {approachLine && (
        <p className="text-slate-700 dark:text-slate-200 font-medium">{approachLine}</p>
      )}
      {hostSettingsLines && hostSettingsLines.length > 0 && (
        <div className="space-y-0.5 pb-1.5 border-b border-slate-200/80 dark:border-slate-700/80">
          {hostSettingsLines.map(line => (
            <p key={line} className="text-slate-500 dark:text-slate-400 text-xs">{line}</p>
          ))}
        </div>
      )}
      {lines.length > 0 ? (
        lines.map(line => (
          <p key={line} className="text-slate-700 dark:text-slate-200">{line}</p>
        ))
      ) : approachLine ? null : (
        <p className="text-slate-400 dark:text-slate-500">📅 No times selected yet</p>
      )}
      <p className="text-slate-700 dark:text-slate-200 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
        ⏱ {durationLabel}
      </p>
    </div>
  );
}

function PerDayTimeSlotPicker({
  selectedDates,
  selectedSlots,
  offHoursByDate,
  allowOffHoursGlobal,
  onToggleSlot,
  onRemoveDate,
  onToggleOffHours,
  onApplyPreset,
  onAddCustomTime,
  onClearDay,
  hasConnectedCalendar,
  checkHostCalendar,
  calendarBusyReady,
  hostAvailability,
  calendarBusyPeriods,
  hostBookings,
  durationMinutes,
}: {
  selectedDates: string[];
  selectedSlots: SelectedSlotsMap;
  offHoursByDate: Record<string, boolean>;
  allowOffHoursGlobal: boolean;
  onToggleSlot: (dateStr: string, time: string) => void;
  onRemoveDate: (dateStr: string) => void;
  onToggleOffHours: (dateStr: string) => void;
  onApplyPreset: (dateStr: string, preset: 'morning' | 'afternoon') => void;
  onAddCustomTime: (dateStr: string, time: string) => void;
  onClearDay: (dateStr: string) => void;
  hasConnectedCalendar: boolean;
  checkHostCalendar: boolean;
  calendarBusyReady: boolean;
  hostAvailability: AvailabilitySlot[];
  calendarBusyPeriods: BusyPeriod[];
  hostBookings: HostBooking[];
  durationMinutes: number;
}) {
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});
  const calendarActive = hasConnectedCalendar && checkHostCalendar;
  const applyCalendarBusy = calendarActive && calendarBusyReady;

  if (selectedDates.length === 0) return null;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {!hasConnectedCalendar ? (
            <>⚠️ No calendar connected — pick times for each day below</>
          ) : calendarActive ? (
            <>📆 Free times pre-selected from your calendar — adjust each day independently</>
          ) : (
            <>Calendar connected but checking is off — pick times manually for each day</>
          )}
        </p>
        {!hasConnectedCalendar && (
          <Link
            to="/dashboard/settings?tab=integrations"
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline shrink-0"
          >
            Connect calendar →
          </Link>
        )}
      </div>

      {selectedDates.map(dateStr => {
        const includeOffHours = allowOffHoursGlobal || (offHoursByDate[dateStr] ?? false);
        const visibleHours = getVisibleHours(dateStr, hostAvailability, includeOffHours);
        const selected = selectedSlots[dateStr] ?? [];
        const gridSet = new Set(visibleHours);
        const extraTimes = selected.filter(t => !gridSet.has(t)).sort();
        const freeHourCount = applyCalendarBusy
          ? visibleHours.filter(h => !isSlotBusy(dateStr, h, durationMinutes, calendarBusyPeriods, hostBookings)).length
          : visibleHours.length;
        const allSlotsTaken = applyCalendarBusy && visibleHours.length > 0 && freeHourCount === 0;

        return (
          <div
            key={dateStr}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 motion-safe:animate-coordDayIn"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 backdrop-blur-sm">
              <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-200">{fmtDayHeader(dateStr)}</p>
              <button
                type="button"
                onClick={() => onRemoveDate(dateStr)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors rounded-lg"
                aria-label={`Remove ${fmtDayHeader(dateStr)}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['morning', 'afternoon'] as const).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onApplyPreset(dateStr, preset)}
                    className="min-h-[44px] px-4 rounded-full text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors capitalize"
                  >
                    {preset === 'morning' ? 'Morning only' : 'Afternoon only'}
                  </button>
                ))}
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onClearDay(dateStr)}
                    className="min-h-[44px] px-4 rounded-full text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-red-300 hover:text-red-600 transition-colors"
                  >
                    Clear day
                  </button>
                )}
              </div>

              <label className={`flex items-center gap-2 min-h-[44px] ${allowOffHoursGlobal ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={includeOffHours}
                  disabled={allowOffHoursGlobal}
                  onChange={() => !allowOffHoursGlobal && onToggleOffHours(dateStr)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Include off-hours{allowOffHoursGlobal ? ' (all days — global setting on)' : ''}
                </span>
              </label>

              {allSlotsTaken && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  All slots taken — enable off-hours to add more
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {visibleHours.map(time => {
                  const slotBusy = applyCalendarBusy && isSlotBusy(dateStr, time, durationMinutes, calendarBusyPeriods, hostBookings);
                  const isSelected = selected.includes(time);
                  return (
                    <button
                      key={time}
                      type="button"
                      disabled={slotBusy}
                      onClick={() => !slotBusy && onToggleSlot(dateStr, time)}
                      className={[
                        'min-h-[44px] min-w-[54px] px-2 rounded-full text-[14px] font-semibold border transition-all flex flex-col items-center justify-center',
                        slotBusy
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                          : isSelected
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                            : 'bg-transparent border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-emerald-400',
                      ].join(' ')}
                    >
                      <span>{formatTimeLabel(time)}</span>
                      {slotBusy && <span className="text-[9px] font-medium leading-none mt-0.5">Busy</span>}
                    </button>
                  );
                })}
              </div>

              {extraTimes.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Custom times</span>
                  {extraTimes.map(time => {
                    const slotBusy = applyCalendarBusy && isSlotBusy(dateStr, time, durationMinutes, calendarBusyPeriods, hostBookings);
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => onToggleSlot(dateStr, time)}
                        className={[
                          'min-h-[44px] min-w-[54px] px-3 rounded-full text-[14px] font-semibold border transition-all',
                          slotBusy
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-400'
                            : 'bg-emerald-500 border-emerald-500 text-white shadow-sm',
                        ].join(' ')}
                      >
                        {formatTimeLabel(time)}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="time"
                  step={900}
                  value={customDraft[dateStr] ?? ''}
                  onChange={e => setCustomDraft(prev => ({ ...prev, [dateStr]: e.target.value }))}
                  className="min-h-[44px] flex-1 min-w-[140px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[16px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label={`Custom time for ${fmtDayHeader(dateStr)}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const raw = customDraft[dateStr];
                    if (!raw) return;
                    onAddCustomTime(dateStr, raw);
                    setCustomDraft(prev => ({ ...prev, [dateStr]: '' }));
                  }}
                  disabled={!customDraft[dateStr]}
                  className="min-h-[44px] px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={{ background: BRAND }}
                >
                  Add time
                </button>
              </div>
              <p className="text-xs text-slate-400">15-minute increments · e.g. 10:15am for a single slot</p>

              {visibleHours.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No slots in your normal hours — enable &quot;Include off-hours&quot; for this day.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Details', 'People', 'Review'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num = (i + 1) as 1 | 2 | 3;
        const done = step > num;
        const active = step === num;
        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={{ background: done || active ? BRAND : '#e5e7eb', color: done || active ? '#fff' : '#6b7280' }}
              >
                {done ? <Check className="h-4 w-4" /> : num}
              </div>
              <span className={`text-xs mt-1 font-semibold whitespace-nowrap ${active ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div className="h-0.5 w-10 sm:w-16 mb-5 mx-1 transition-all" style={{ background: step > num ? BRAND : '#e5e7eb' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── New coordination form ────────────────────────────────────────────────────

function NewCoordForm({ onCreated, onCancel, hostName }: {
  onCreated: (meeting: CoordMeeting) => void;
  onCancel: () => void;
  hostName: string;
}) {
  const { profile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [durationPreset, setDurationPreset] = useState<number | 'custom'>(60);
  const [customHours, setCustomHours] = useState(1);
  const [customMinutes, setCustomMinutes] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlotsMap>({});
  const [offHoursByDate, setOffHoursByDate] = useState<Record<string, boolean>>({});
  const [coordSimpleTimeframe, setCoordSimpleTimeframe] = useState<CoordSimpleTimeframe>('this_week');
  const [customRangeStart, setCustomRangeStart] = useState('');
  const [customRangeEnd, setCustomRangeEnd] = useState('');
  const [timeOfDayPrefs, setTimeOfDayPrefs] = useState<Set<CoordTimeOfDayKey>>(() => new Set(['any']));
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const [checkHostCalendar, setCheckHostCalendar] = useState(false);
  const [allowOffHoursGlobal, setAllowOffHoursGlobal] = useState(false);
  const [hasConnectedCalendar, setHasConnectedCalendar] = useState(false);
  const [hostDataLoaded, setHostDataLoaded] = useState(false);
  const [hostAvailability, setHostAvailability] = useState<AvailabilitySlot[]>([]);
  const [calendarBusyPeriods, setCalendarBusyPeriods] = useState<BusyPeriod[]>([]);
  const [hostBookings, setHostBookings] = useState<HostBooking[]>([]);
  const [calendarBusyState, setCalendarBusyState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const calendarDefaultSet = useRef(false);
  const manualDatesRef = useRef<Set<string>>(new Set());

  const markDateManual = (dateStr: string) => {
    manualDatesRef.current.add(dateStr);
  };

  // Step 2
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    { name: '', phone: '', role: '', knownAvailability: '', showKnownAvailability: false },
    { name: '', phone: '', role: '', knownAvailability: '', showKnownAvailability: false },
  ]);
  const [phoneMasked, setPhoneMasked] = useState<boolean[]>([false, false]);

  // Step 3
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const durationMinutes = durationPreset === 'custom'
    ? Math.max(1, customHours * 60 + customMinutes)
    : durationPreset;

  const calendarActive = hasConnectedCalendar && checkHostCalendar;
  const calendarBusyReady = calendarBusyState === 'ready';
  const calendarCheckActive = calendarActive && calendarBusyReady;

  const effectiveOffHours = useCallback((dateStr: string) =>
    allowOffHoursGlobal || (offHoursByDate[dateStr] ?? false),
  [allowOffHoursGlobal, offHoursByDate]);

  useEffect(() => {
    if (!showAdvancedOptions || !hostDataLoaded || calendarDefaultSet.current) return;
    if (hasConnectedCalendar) setCheckHostCalendar(true);
    calendarDefaultSet.current = true;
  }, [showAdvancedOptions, hostDataLoaded, hasConnectedCalendar]);

  useEffect(() => {
    if (!profile?.id || !showAdvancedOptions || hostDataLoaded) return;
    let cancelled = false;

    (async () => {
      setCalendarBusyState('loading');
      const conflictSettings: CalendarConflictSettings = {
        ...DEFAULT_CALENDAR_CONFLICT_SETTINGS,
        ...(profile.calendar_conflict_settings ?? {}),
      };

      const { data: calRows, error: calErr } = await supabase
        .from('connected_calendars')
        .select('id, provider')
        .eq('host_id', profile.id)
        .in('provider', ['google', 'outlook']);

      if (cancelled) return;

      const connected = !calErr && (calRows ?? []).length > 0;
      setHasConnectedCalendar(connected);

      if (connected) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-sync`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session?.access_token ?? ''}`,
              Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });
        } catch {
          // Best-effort sync — fall back to cached events in DB
        }
      }

      const [availRes, bookRes, evtRes] = await Promise.all([
        supabase.from('availability').select('day_of_week, start_time, end_time, is_active').eq('host_id', profile.id),
        supabase.from('bookings').select('start_time, end_time').eq('host_id', profile.id).eq('status', 'confirmed'),
        supabase
          .from('calendar_events')
          .select('start_at, end_at, all_day, show_status, transparency, attendee_self_status, is_birthday_cal, is_holiday_cal, title')
          .eq('host_id', profile.id),
      ]);

      if (cancelled) return;

      setHostAvailability((availRes.data ?? []) as AvailabilitySlot[]);
      setHostBookings((bookRes.data ?? []) as HostBooking[]);

      if (!connected || evtRes.error) {
        setCalendarBusyPeriods([]);
        setCalendarBusyState('unavailable');
      } else {
        setCalendarBusyPeriods(buildBusyPeriods((evtRes.data ?? []) as CalendarEventRow[], conflictSettings));
        setCalendarBusyState('ready');
      }
      setHostDataLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [profile?.id, profile?.calendar_conflict_settings, showAdvancedOptions, hostDataLoaded]);

  const computeFreeSlotsForDateCb = useCallback((dateStr: string, includeOffHours: boolean) =>
    computeFreeSlotsForDate(
      dateStr, includeOffHours, durationMinutes, hostAvailability,
      calendarBusyPeriods, hostBookings, calendarCheckActive,
    ), [durationMinutes, hostAvailability, calendarBusyPeriods, hostBookings, calendarCheckActive]);

  useEffect(() => {
    if (!hostDataLoaded || !calendarCheckActive) return;
    setSelectedSlots(prev => {
      const next = { ...prev };
      let changed = false;
      for (const dateStr of selectedDates) {
        if (manualDatesRef.current.has(dateStr)) continue;
        const cur = prev[dateStr] ?? [];
        if (cur.length > 0) continue;
        const includeOffHours = effectiveOffHours(dateStr);
        const free = computeFreeSlotsForDateCb(dateStr, includeOffHours);
        if (free.length > 0) {
          next[dateStr] = free;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [hostDataLoaded, calendarCheckActive, calendarBusyPeriods, hostBookings, hostAvailability, selectedDates, effectiveOffHours, computeFreeSlotsForDateCb]);

  const refreshSlotsForDate = useCallback((dateStr: string, includeOffHours: boolean) => {
    setSelectedSlots(prev => {
      const visible = getVisibleHours(dateStr, hostAvailability, includeOffHours);
      const kept = (prev[dateStr] ?? []).filter(t => {
        if (visible.includes(t)) return true;
        if (includeOffHours) return true;
        return isSlotInAvailability(dateStr, t, hostAvailability);
      });
      if (calendarCheckActive) {
        const free = filterSelectableSlots(
          dateStr, visible, includeOffHours, durationMinutes,
          hostAvailability, calendarBusyPeriods, hostBookings, calendarCheckActive,
        );
        return { ...prev, [dateStr]: [...new Set([...kept, ...free])].sort() };
      }
      return { ...prev, [dateStr]: kept };
    });
  }, [hostAvailability, calendarCheckActive, durationMinutes, calendarBusyPeriods, hostBookings]);

  const handleAllowOffHoursGlobalChange = (next: boolean) => {
    setAllowOffHoursGlobal(next);
    setSelectedSlots(prev => {
      const updated = { ...prev };
      for (const dateStr of selectedDates) {
        const includeOffHours = next || (offHoursByDate[dateStr] ?? false);
        const visible = getVisibleHours(dateStr, hostAvailability, includeOffHours);
        const kept = (prev[dateStr] ?? []).filter(t => {
          if (visible.includes(t)) return true;
          if (includeOffHours) return true;
          return isSlotInAvailability(dateStr, t, hostAvailability);
        });
        if (calendarCheckActive) {
          const free = filterSelectableSlots(
            dateStr, visible, includeOffHours, durationMinutes,
            hostAvailability, calendarBusyPeriods, hostBookings, calendarCheckActive,
          );
          updated[dateStr] = [...new Set([...kept, ...free])].sort();
        } else {
          updated[dateStr] = kept;
        }
      }
      return updated;
    });
  };

  const handleCheckHostCalendarChange = (next: boolean) => {
    setCheckHostCalendar(next);
    if (next && calendarCheckActive) {
      setSelectedSlots(prev => {
        const updated = { ...prev };
        for (const dateStr of selectedDates) {
          if (manualDatesRef.current.has(dateStr)) continue;
          if ((prev[dateStr]?.length ?? 0) > 0) continue;
          const includeOffHours = allowOffHoursGlobal || (offHoursByDate[dateStr] ?? false);
          updated[dateStr] = computeFreeSlotsForDate(
            dateStr, includeOffHours, durationMinutes,
            hostAvailability, calendarBusyPeriods, hostBookings, calendarCheckActive,
          );
        }
        return updated;
      });
    }
  };

  const toggleDate = (date: string) => {
    if (selectedDates.includes(date)) {
      setSelectedDates(prev => prev.filter(d => d !== date));
      setSelectedSlots(prev => { const n = { ...prev }; delete n[date]; return n; });
      setOffHoursByDate(prev => { const n = { ...prev }; delete n[date]; return n; });
      manualDatesRef.current.delete(date);
    } else {
      manualDatesRef.current.delete(date);
      setSelectedDates(prev => [...prev, date].sort());
      setOffHoursByDate(prev => ({ ...prev, [date]: false }));
      const includeOH = allowOffHoursGlobal;
      const free = calendarCheckActive
        ? computeFreeSlotsForDate(date, includeOH, durationMinutes, hostAvailability, calendarBusyPeriods, hostBookings, calendarCheckActive)
        : [];
      setSelectedSlots(prev => ({ ...prev, [date]: free }));
    }
  };

  const removeDate = (date: string) => toggleDate(date);

  const toggleSlot = (dateStr: string, time: string) => {
    markDateManual(dateStr);
    setSelectedSlots(prev => {
      const cur = prev[dateStr] ?? [];
      const next = cur.includes(time) ? cur.filter(t => t !== time) : [...cur, time].sort();
      return { ...prev, [dateStr]: next };
    });
  };

  const toggleOffHoursForDate = (dateStr: string) => {
    if (allowOffHoursGlobal) return;
    markDateManual(dateStr);
    const nextOffHours = !(offHoursByDate[dateStr] ?? false);
    setOffHoursByDate(prev => ({ ...prev, [dateStr]: nextOffHours }));
    refreshSlotsForDate(dateStr, nextOffHours);
  };

  const applyDayPreset = (dateStr: string, preset: 'morning' | 'afternoon') => {
    markDateManual(dateStr);
    const includeOffHours = effectiveOffHours(dateStr);
    const pool = preset === 'morning' ? MORNING_SLOT_TIMES : AFTERNOON_SLOT_TIMES;
    const times = filterSelectableSlots(
      dateStr, pool, includeOffHours, durationMinutes,
      hostAvailability, calendarBusyPeriods, hostBookings, calendarCheckActive,
    );
    setSelectedSlots(prev => ({ ...prev, [dateStr]: times.sort() }));
  };

  const clearDaySlots = (dateStr: string) => {
    markDateManual(dateStr);
    setSelectedSlots(prev => ({ ...prev, [dateStr]: [] }));
  };

  const addCustomTime = (dateStr: string, raw: string) => {
    markDateManual(dateStr);
    const normalized = normalizeTime(raw);
    if (!normalized) return;
    const mins = timeToMinutes(normalized);
    if (mins < SLOT_DAY_START || mins > SLOT_DAY_END) return;
    const includeOffHours = effectiveOffHours(dateStr);
    if (!includeOffHours && !isSlotInAvailability(dateStr, normalized, hostAvailability)) return;
    if (calendarCheckActive && isSlotBusy(dateStr, normalized, durationMinutes, calendarBusyPeriods, hostBookings)) return;
    setSelectedSlots(prev => {
      const cur = prev[dateStr] ?? [];
      if (cur.includes(normalized)) return prev;
      return { ...prev, [dateStr]: [...cur, normalized].sort() };
    });
  };

  const hasAnySlots = Object.values(selectedSlots).some(times => times.length > 0);

  const useAdvancedSlots = showAdvancedOptions && selectedDates.length > 0 && hasAnySlots;

  const approachLine = useAdvancedSlots
    ? 'Specific dates and times (advanced)'
    : buildSimpleCoordSummary(coordSimpleTimeframe, Array.from(timeOfDayPrefs), customRangeStart, customRangeEnd);

  const step1Valid = useMemo(() => {
    if (!title.trim() || durationMinutes <= 0 || timeOfDayPrefs.size === 0) return false;
    if (useAdvancedSlots) {
      return selectedDates.length > 0 && hasAnySlots;
    }
    if (coordSimpleTimeframe === 'custom') {
      return !!customRangeStart && !!customRangeEnd && customRangeStart <= customRangeEnd;
    }
    return true;
  }, [title, durationMinutes, timeOfDayPrefs, useAdvancedSlots, selectedDates, hasAnySlots, coordSimpleTimeframe, customRangeStart, customRangeEnd]);

  const hostSettingsLines = useAdvancedSlots
    ? formatHostSettingsLines(hasConnectedCalendar, checkHostCalendar, allowOffHoursGlobal, offHoursByDate)
    : [];

  const toggleTimeOfDay = (key: CoordTimeOfDayKey) => {
    setTimeOfDayPrefs(prev => {
      if (key === 'any') return new Set(['any']);
      const next = new Set(prev);
      next.delete('any');
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (next.size === 0) next.add('any');
      return next;
    });
  };

  const validParticipants = participants.filter(p => p.name.trim() && p.phone.trim());

  const addParticipant = () => {
    if (participants.length >= 6) return;
    setParticipants(p => [...p, { name: '', phone: '', role: '', knownAvailability: '', showKnownAvailability: false }]);
    setPhoneMasked(m => [...m, false]);
  };

  const removeParticipant = (i: number) => {
    setParticipants(p => p.filter((_, idx) => idx !== i));
    setPhoneMasked(m => m.filter((_, idx) => idx !== i));
  };

  const updateParticipant = (i: number, field: keyof ParticipantDraft, value: string | boolean) => {
    setParticipants(p => p.map((pt, idx) => idx === i ? { ...pt, [field]: value } : pt));
  };

  const smsParticipants = validParticipants.filter(p => !p.knownAvailability.trim());
  const preEnteredParticipants = validParticipants.filter(p => p.knownAvailability.trim());

  const handlePhoneBlur = (i: number) => {
    const phone = participants[i].phone.trim();
    if (phone) {
      updateParticipant(i, 'phone', blurFormatPhone(phone));
      setPhoneMasked(m => m.map((v, idx) => idx === i ? true : v));
    }
  };

  const handlePhoneClick = (i: number) => {
    setPhoneMasked(m => m.map((v, idx) => idx === i ? false : v));
  };

  const smsPreview = () => {
    const p = smsParticipants[0] || validParticipants[0] || { name: '[Name]' };
    const body = buildCoordInviteSmsBody({
      participantName: p.name,
      hostName,
      title: title.trim(),
      durationMinutes,
      useAdvancedSlots,
      selectedSlots,
      selectedDates,
      simpleTimeframe: coordSimpleTimeframe,
      timeOfDayPrefs: Array.from(timeOfDayPrefs),
      customRangeStart,
      customRangeEnd,
    });
    return `${body}\n\nReply STOP to opt out.`;
  };

  const handleSend = async () => {
    if (!profile) return;
    setSending(true);
    setSendError('');

    let datesForMeeting: string[];
    let slotsForMeeting: SelectedSlotsMap = {};
    let windowStart: string;
    let windowEnd: string;

    if (useAdvancedSlots) {
      datesForMeeting = selectedDates;
      slotsForMeeting = selectedSlots;
      ({ start: windowStart, end: windowEnd } = getWindowFromCoordDates(selectedDates));
    } else {
      datesForMeeting = getDatesForSimpleTimeframe(coordSimpleTimeframe, customRangeStart, customRangeEnd);
      ({ start: windowStart, end: windowEnd } = getWindowFromCoordDates(datesForMeeting));
    }

    const preferredTimesPayload: CoordPreferredTimesPayload = {
      schedulingIntent: useAdvancedSlots ? 'specific_times' : 'general_timeframe',
      simpleTimeframe: useAdvancedSlots ? undefined : coordSimpleTimeframe,
      timeOfDayPreferences: useAdvancedSlots ? undefined : Array.from(timeOfDayPrefs),
      customRangeStart: coordSimpleTimeframe === 'custom' ? customRangeStart : undefined,
      customRangeEnd: coordSimpleTimeframe === 'custom' ? customRangeEnd : undefined,
      selectedSlots: slotsForMeeting,
      offHoursByDate: useAdvancedSlots ? offHoursByDate : {},
      allowOffHoursGlobal: useAdvancedSlots ? allowOffHoursGlobal : false,
    };

    const { data: meeting, error: meetingErr } = await supabase
      .from('coordinated_meetings')
      .insert({
        host_id: profile.id,
        title: title.trim(),
        description: null,
        location: location.trim() || null,
        duration_minutes: durationMinutes,
        status: 'collecting_availability',
        proposed_window_start: windowStart,
        proposed_window_end: windowEnd,
        selected_dates: datesForMeeting,
        preferred_times: preferredTimesPayload,
        check_host_calendar: useAdvancedSlots && checkHostCalendar,
        allow_off_hours: useAdvancedSlots && (allowOffHoursGlobal || Object.values(offHoursByDate).some(Boolean)),
      })
      .select()
      .maybeSingle();

    if (meetingErr || !meeting) {
      setSendError(meetingErr?.message || 'Failed to create coordination. Please try again.');
      setSending(false);
      return;
    }

    const rows = validParticipants.map(p => {
      const known = p.knownAvailability.trim();
      return {
        meeting_id: meeting.id,
        name: p.name.trim(),
        phone: normalizePhoneE164(p.phone.trim()),
        role: p.role.trim(),
        availability_response: known || null,
        availability_pre_entered: !!known,
      };
    });

    const { data: insertedParticipants, error: partErr } = await supabase
      .from('coordinated_meeting_participants')
      .insert(rows)
      .select('id, availability_pre_entered, availability_response');

    if (partErr || !insertedParticipants) {
      setSendError(partErr?.message || 'Failed to add participants.');
      setSending(false);
      return;
    }

    const timeframe = { start: windowStart, end: windowEnd };
    for (let i = 0; i < insertedParticipants.length; i++) {
      const part = insertedParticipants[i];
      const draft = validParticipants[i];
      if (!part.availability_pre_entered || !draft.knownAvailability.trim()) continue;
      const slots = await parseCoordAvailability(draft.knownAvailability.trim(), timeframe);
      await supabase
        .from('coordinated_meeting_participants')
        .update({ parsed_slots: slots })
        .eq('id', part.id);
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    fetch(`${supabaseUrl}/functions/v1/coordinate-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
      body: JSON.stringify({ meeting_id: meeting.id }),
    }).catch(() => {});

    onCreated(meeting as CoordMeeting);
    setSending(false);
  };

  const pillBase = (active: boolean) =>
    `min-h-[48px] min-w-[72px] px-4 py-2 rounded-full text-[15px] font-semibold border transition-all flex items-center justify-center ${
      active
        ? 'text-white border-transparent'
        : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
    }`;

  return (
    /* pb-28 leaves room for the sticky Next button on mobile */
    <div className="max-w-2xl pb-28 md:pb-0">
      <StepIndicator step={step} />

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <SectionLabel>Meeting title <span className="text-red-500 normal-case">*</span></SectionLabel>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Property Showing — 123 Main St"
              className={INP}
            />
          </div>

          <div>
            <SectionLabel>Location <span className="font-normal normal-case text-slate-400">(optional)</span></SectionLabel>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="123 Main St, City, State"
                className={INP + ' pl-11'}
              />
            </div>
          </div>

          <div>
            <SectionLabel>Duration</SectionLabel>
            <div className="flex flex-wrap gap-2.5">
              {DURATION_PRESETS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationPreset(d)}
                  className={pillBase(durationPreset === d)}
                  style={durationPreset === d ? { background: BRAND, borderColor: BRAND } : {}}
                >
                  {d < 60 ? `${d} min` : d === 60 ? '1h' : '2h'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDurationPreset('custom')}
                className={pillBase(durationPreset === 'custom')}
                style={durationPreset === 'custom' ? { background: BRAND, borderColor: BRAND } : {}}
              >
                Custom
              </button>
            </div>
            {durationPreset === 'custom' && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={customHours}
                    onChange={e => setCustomHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-[60px] min-w-[60px] h-[52px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[16px] text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                    aria-label="Hours"
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    step={5}
                    value={customMinutes}
                    onChange={e => setCustomMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    className="w-[60px] min-w-[60px] h-[52px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[16px] text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                    aria-label="Minutes"
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">minutes</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <SectionLabel>When should this meeting happen?</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
              {(Object.keys(COORD_SIMPLE_TIMEFRAME_LABELS) as CoordSimpleTimeframe[]).map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCoordSimpleTimeframe(preset)}
                  className={[
                    'min-h-[52px] px-4 py-3 rounded-xl text-[15px] font-semibold border-2 transition-all text-center',
                    coordSimpleTimeframe === preset
                      ? 'text-white border-transparent'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300',
                  ].join(' ')}
                  style={coordSimpleTimeframe === preset ? { background: BRAND, borderColor: BRAND } : {}}
                >
                  {COORD_SIMPLE_TIMEFRAME_LABELS[preset]}
                </button>
              ))}
            </div>
            {coordSimpleTimeframe === 'custom' && (
              <div className="flex flex-col sm:flex-row gap-3 mt-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">From</label>
                  <input type="date" value={customRangeStart} onChange={e => setCustomRangeStart(e.target.value)} className={INP} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">To</label>
                  <input type="date" value={customRangeEnd} onChange={e => setCustomRangeEnd(e.target.value)} min={customRangeStart || undefined} className={INP} />
                </div>
              </div>
            )}
            {coordSimpleTimeframe === 'custom' && customRangeStart && customRangeEnd && customRangeStart > customRangeEnd && (
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-3">
                End date must be on or after the start date.
              </p>
            )}
          </div>

          <div>
            <SectionLabel>What time of day works?</SectionLabel>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-2">Select all that apply</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(COORD_TIME_OF_DAY_LABELS) as CoordTimeOfDayKey[]).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleTimeOfDay(key)}
                  className={[
                    'min-h-[52px] px-4 py-3 rounded-xl text-[15px] font-semibold border-2 transition-all text-center',
                    timeOfDayPrefs.has(key)
                      ? 'text-white border-transparent'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300',
                  ].join(' ')}
                  style={timeOfDayPrefs.has(key) ? { background: BRAND, borderColor: BRAND } : {}}
                >
                  {COORD_TIME_OF_DAY_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(v => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-slate-50 dark:bg-slate-800/60 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Advanced options</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Pick specific dates &amp; times</span>
              <ChevronDown className={`h-5 w-5 text-slate-400 shrink-0 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} />
            </button>
            {showAdvancedOptions && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Power users only: propose exact dates and time slots instead of a general timeframe. Participants will be asked to confirm within these windows.
                </p>
                {!hostDataLoaded && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Loading calendar data…
                  </p>
                )}
                <MultiSelectCalendar
                  viewMonth={calendarMonth}
                  onViewMonthChange={setCalendarMonth}
                  selectedDates={selectedDates}
                  onToggleDate={toggleDate}
                />
                {selectedDates.length > 0 && (
                  <HostAvailabilitySection
                    hasConnectedCalendar={hasConnectedCalendar}
                    checkHostCalendar={checkHostCalendar}
                    onCheckHostCalendarChange={handleCheckHostCalendarChange}
                    allowOffHoursGlobal={allowOffHoursGlobal}
                    onAllowOffHoursGlobalChange={handleAllowOffHoursGlobalChange}
                    offHoursByDate={offHoursByDate}
                  />
                )}
                <PerDayTimeSlotPicker
                  selectedDates={selectedDates}
                  selectedSlots={selectedSlots}
                  offHoursByDate={offHoursByDate}
                  allowOffHoursGlobal={allowOffHoursGlobal}
                  onToggleSlot={toggleSlot}
                  onRemoveDate={removeDate}
                  onToggleOffHours={toggleOffHoursForDate}
                  onApplyPreset={applyDayPreset}
                  onAddCustomTime={addCustomTime}
                  onClearDay={clearDaySlots}
                  hasConnectedCalendar={hasConnectedCalendar}
                  checkHostCalendar={checkHostCalendar}
                  calendarBusyReady={calendarBusyReady}
                  hostAvailability={hostAvailability}
                  calendarBusyPeriods={calendarBusyPeriods}
                  hostBookings={hostBookings}
                  durationMinutes={durationMinutes}
                />
                {useAdvancedSlots && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Using specific times — SMS will list your selected slots.
                  </p>
                )}
              </div>
            )}
          </div>

          <SelectionSummary
            selectedSlots={useAdvancedSlots ? selectedSlots : {}}
            durationMinutes={durationMinutes}
            hostSettingsLines={hostSettingsLines}
            approachLine={approachLine}
          />

          <div className="hidden md:flex gap-3 pt-2">
            <button onClick={onCancel}
              className="min-h-[48px] px-5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button onClick={() => setStep(2)} disabled={!step1Valid}
              className="min-h-[48px] flex items-center gap-2 px-5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40"
              style={{ background: BRAND }}>
              Next: Add Participants <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-xl text-sm"
            style={{ background: '#eef0fb', color: BRAND, border: `1px solid ${BRAND}30` }}>
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p>Phone numbers are never shared between participants. Each person communicates through a private masked number via SMS or WhatsApp.</p>
              <p className="text-[13px] opacity-90">
                Already know when someone is free? Enter their times below — they won&apos;t get a text. Everyone else will reply with what works for them.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {participants.map((p, i) => (
              <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <SectionLabel>Person {i + 1}</SectionLabel>
                  {participants.length > 2 && (
                    <button onClick={() => removeParticipant(i)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors rounded-lg -mr-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Name */}
                <div>
                  <SectionLabel>Full name</SectionLabel>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updateParticipant(i, 'name', e.target.value)}
                    placeholder="Full name"
                    className={INP}
                    autoCapitalize="words"
                  />
                </div>

                {/* Phone */}
                <div>
                  <SectionLabel>Phone number</SectionLabel>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phoneMasked[i] ? maskPhone(p.phone) : p.phone}
                      onChange={e => { if (!phoneMasked[i]) updateParticipant(i, 'phone', e.target.value); }}
                      onBlur={() => handlePhoneBlur(i)}
                      onClick={() => { if (phoneMasked[i]) handlePhoneClick(i); }}
                      placeholder={PHONE_PLACEHOLDER}
                      className={INP + ' pl-11' + (phoneMasked[i] ? ' cursor-pointer text-slate-500' : '')}
                      readOnly={phoneMasked[i]}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">{PHONE_HINT}</p>
                </div>

                {/* Role */}
                <div>
                  <SectionLabel>Role <span className="font-normal normal-case text-slate-400">(optional)</span></SectionLabel>
                  <input
                    type="text"
                    value={p.role}
                    onChange={e => updateParticipant(i, 'role', e.target.value)}
                    placeholder="e.g. Renter, Listing Agent, Patient..."
                    className={INP}
                    list={`roles-${i}`}
                  />
                  <datalist id={`roles-${i}`}>
                    {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
                  </datalist>
                </div>

                {/* Optional known availability */}
                <div>
                  {!p.showKnownAvailability ? (
                    <button
                      type="button"
                      onClick={() => updateParticipant(i, 'showKnownAvailability', true)}
                      className="w-full text-left p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 hover:border-[#5864C6]/50 hover:bg-[#5864C6]/5 dark:hover:bg-[#5864C6]/10 transition-colors"
                    >
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        + I already have this person&apos;s available times
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        e.g. listing agent said Sat 2–4pm, or specialist is free Tue mornings
                      </p>
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          updateParticipant(i, 'showKnownAvailability', false);
                          updateParticipant(i, 'knownAvailability', '');
                        }}
                        className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors font-medium"
                      >
                        − Remove pre-entered times
                      </button>
                      <SectionLabel>Their available times</SectionLabel>
                      <textarea
                        value={p.knownAvailability}
                        onChange={e => updateParticipant(i, 'knownAvailability', e.target.value)}
                        placeholder="e.g. Saturday 2–4pm, Sunday morning anytime, Tue or Wed after 3pm"
                        rows={2}
                        className={INP.replace('h-[52px]', '') + ' py-3 resize-none min-h-[80px]'}
                      />
                      <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                        This person won&apos;t receive a text — we&apos;ll use what you enter and only message the others for their availability.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {participants.length < 6 && (
            <button onClick={addParticipant}
              className="w-full min-h-[52px] flex items-center justify-center gap-2 px-4 text-[15px] font-semibold rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
              <Plus className="h-5 w-5" /> Add another person
            </button>
          )}

          {validParticipants.length < 2 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              Add at least 2 participants to continue.
            </p>
          )}

          <div className="hidden md:flex gap-3 pt-2">
            <button onClick={() => setStep(1)}
              className="min-h-[48px] flex items-center gap-1 px-5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => setStep(3)} disabled={validParticipants.length < 2}
              className="min-h-[48px] flex items-center gap-2 px-5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40"
              style={{ background: BRAND }}>
              Review & Send <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <SectionLabel>Meeting</SectionLabel>
            <p className="font-bold text-slate-900 dark:text-white text-lg">{title}</p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />
                {fmtCoordDuration(durationMinutes)}
              </span>
              {location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {location}</span>}
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />
                {approachLine}
              </span>
            </div>
            {useAdvancedSlots && formatSelectedSlotsLines(selectedSlots).length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                {formatSelectedSlotsLines(selectedSlots).map(line => (
                  <p key={line} className="text-sm text-slate-600 dark:text-slate-300">{line}</p>
                ))}
              </div>
            )}
          </div>

          {useAdvancedSlots && hostSettingsLines.length > 0 && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <SectionLabel>Host availability</SectionLabel>
              {hostSettingsLines.map(line => (
                <p key={line} className="text-sm text-slate-600 dark:text-slate-300">{line}</p>
              ))}
            </div>
          )}

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <SectionLabel>Participants ({validParticipants.length})</SectionLabel>
            {validParticipants.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: BRAND }}>
                  {(p.name[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.role || 'No role'} · {maskPhone(p.phone)}
                    {p.knownAvailability.trim() ? ' · Availability pre-entered ✓' : ' · SMS request will be sent'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {smsParticipants.length > 0 ? (
            <div>
              <SectionLabel>SMS / WhatsApp preview{smsParticipants.length > 1 ? ` (${smsParticipants.length} messages)` : ''}</SectionLabel>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="flex items-start gap-2.5">
                  <MessageSquare className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {smsPreview()}
                  </p>
                </div>
                {smsParticipants.length > 1 && (
                  <p className="text-xs text-slate-400 mt-2 pl-7">
                    + {smsParticipants.length - 1} more personalized message{smsParticipants.length > 2 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300">
              All participants have pre-entered availability — no SMS messages will be sent.
            </div>
          )}

          {preEnteredParticipants.length > 0 && smsParticipants.length > 0 && (
            <p className="text-xs text-slate-400">
              {preEnteredParticipants.map(p => p.name).join(', ')} will not receive a text — availability already provided.
            </p>
          )}

          <div className="p-4 bg-[#eef0fb] dark:bg-[#5864C6]/10 border border-[#5864C6]/20 rounded-xl">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              After participants reply, you&apos;ll receive an SMS with the best available time.
              You confirm before anything is booked.
            </p>
          </div>

          {sendError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {sendError}
            </div>
          )}

          <div className="hidden md:flex gap-3 pt-2">
            <button onClick={() => setStep(2)}
              className="min-h-[48px] flex items-center gap-1 px-5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={handleSend} disabled={sending}
              className="min-h-[48px] flex items-center gap-2 px-6 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50"
              style={{ background: BRAND }}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {sending ? 'Sending...' : 'Send Availability Requests'}
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile sticky bottom bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-4 py-3 safe-area-bottom">
        {step === 1 && (
          <div className="space-y-3">
            <SelectionSummary
              selectedSlots={useAdvancedSlots ? selectedSlots : {}}
              durationMinutes={durationMinutes}
              hostSettingsLines={hostSettingsLines}
              approachLine={approachLine}
            />
            <div className="flex gap-3">
              <button onClick={onCancel}
                className="h-[56px] px-5 font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-[15px]">
                Cancel
              </button>
              <button onClick={() => setStep(2)} disabled={!step1Valid}
                className="flex-1 h-[56px] flex items-center justify-center gap-2 font-bold text-white rounded-xl transition-all disabled:opacity-40 text-[15px] shadow-lg"
                style={{ background: BRAND }}>
                Next: Add Participants <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="h-[56px] px-5 flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors text-[15px]">
              <ChevronLeft className="h-5 w-5" /> Back
            </button>
            <button onClick={() => setStep(3)} disabled={validParticipants.length < 2}
              className="flex-1 h-[56px] flex items-center justify-center gap-2 font-bold text-white rounded-xl transition-all disabled:opacity-40 text-[15px] shadow-lg"
              style={{ background: BRAND }}>
              Review & Send <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
        {step === 3 && (
          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="h-[56px] px-5 flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors text-[15px]">
              <ChevronLeft className="h-5 w-5" /> Back
            </button>
            <button onClick={handleSend} disabled={sending}
              className="flex-1 h-[56px] flex items-center justify-center gap-2 font-bold text-white rounded-xl transition-all disabled:opacity-50 text-[15px] shadow-lg"
              style={{ background: BRAND }}>
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              {sending ? 'Sending...' : 'Send Availability Requests'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Meeting detail ────────────────────────────────────────────────────────────

function MeetingDetail({ meeting: initialMeeting, onBack, onStatusChange }: {
  meeting: CoordMeeting;
  onBack: () => void;
  onStatusChange: (id: string, status: CoordStatus) => void;
}) {
  const [meeting, setMeeting] = useState(initialMeeting);
  const [participants, setParticipants] = useState<CoordParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('coordinated_meeting_participants')
      .select('id, meeting_id, name, role, masked_twilio_number, availability_response, availability_pre_entered, parsed_slots, opted_out, confirmed, created_at')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true });
    setParticipants((data ?? []) as CoordParticipant[]);
    const { data: m } = await supabase
      .from('coordinated_meetings')
      .select('*')
      .eq('id', meeting.id)
      .maybeSingle();
    if (m) {
      setMeeting(m as CoordMeeting);
      onStatusChange(m.id, m.status as CoordStatus);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    refreshTimer.current = setInterval(load, 15000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id]);

  const responded = participants.filter(p => p.availability_response && !p.availability_pre_entered);
  const preEntered = participants.filter(p => p.availability_pre_entered);
  const respondedOrPreEntered = participants.filter(p => p.availability_response);
  const optedOut = participants.filter(p => p.opted_out);
  const active = participants.filter(p => !p.opted_out);
  const meta = STATUS_META[meeting.status];

  const handleCancel = async () => {
    await supabase.from('coordinated_meetings').update({ status: 'cancelled' }).eq('id', meeting.id);
    onStatusChange(meeting.id, 'cancelled');
    setMeeting(m => ({ ...m, status: 'cancelled' }));
  };

  const handleConfirm = async (slotIso: string) => {
    await supabase.from('coordinated_meetings').update({ status: 'confirmed', confirmed_time: slotIso }).eq('id', meeting.id);
    await supabase.from('coordinated_meeting_participants').update({ confirmed: true }).eq('meeting_id', meeting.id).eq('opted_out', false);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    fetch(`${supabaseUrl}/functions/v1/coordinate-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
      body: JSON.stringify({ type: 'confirm', meeting_id: meeting.id, confirmed_time: slotIso }),
    }).catch(() => {});
    load();
  };

  const getCandidateSlots = (): string[] => {
    const stored = meeting.preferred_times?.candidateSlots;
    if (stored?.length) return stored;
    if (active.length < 2) return [];
    const slotSets = active
      .map(p => p.parsed_slots ?? [])
      .filter(s => s.length > 0);
    if (slotSets.length < 2) return [];
    const hostBuckets = hostSelectedSlotsToBuckets(getSelectedSlotsFromMeeting(meeting), meeting.duration_minutes);
    return findParticipantOverlaps(slotSets, meeting.duration_minutes, hostBuckets);
  };

  const overlapSlots = meeting.status === 'match_found' ? getCandidateSlots() : [];

  return (
    <div className="max-w-2xl space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{meeting.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Created {fmtCoordDate(meeting.created_at)}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ color: meta.color, background: meta.bg }}>
          {meta.label}
        </span>
      </div>

      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />
            {meeting.duration_minutes < 60 ? `${meeting.duration_minutes} min` : `${meeting.duration_minutes / 60}h`}
          </span>
          {meeting.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {meeting.location}</span>}
          {meeting.confirmed_time && (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> {fmtDateTime(meeting.confirmed_time)}
            </span>
          )}
        </div>
        {meeting.proposed_window_start && (
          <p className="text-xs text-slate-400 mt-2">
            Window: {fmtCoordDate(meeting.proposed_window_start)} – {meeting.proposed_window_end ? fmtCoordDate(meeting.proposed_window_end) : ''}
          </p>
        )}
      </div>

      {meeting.status === 'match_found' && overlapSlots.length > 0 && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: BRAND }} /> Best match found — confirm via SMS (reply YES) or tap a time below:
          </p>
          {overlapSlots.map((iso, i) => (
            <button key={iso} onClick={() => handleConfirm(iso)}
              className="w-full min-h-[52px] flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-all text-sm font-medium text-slate-700 dark:text-slate-300">
              <span>Option {i + 1}: {fmtDateTime(iso)}</span>
              <Check className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      )}

      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {respondedOrPreEntered.length} of {active.length} participant{active.length !== 1 ? 's' : ''} ready
            {preEntered.length > 0 && responded.length > 0 && (
              <span className="font-normal text-slate-500"> · {preEntered.length} pre-entered, {responded.length} replied</span>
            )}
          </p>
          <button onClick={load}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: active.length ? `${(respondedOrPreEntered.length / active.length) * 100}%` : '0%', background: BRAND }} />
        </div>
      </div>

      <div className="space-y-3">
        <SectionLabel>Participants</SectionLabel>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : participants.map(p => {
          const hasResponse = !!p.availability_response;
          const isPreEntered = p.availability_pre_entered;
          return (
            <div key={p.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5"
                  style={{ background: BRAND }}>
                  {(p.name[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between flex-wrap">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      p.opted_out ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' :
                      p.confirmed ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' :
                      isPreEntered ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' :
                      hasResponse ? 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' :
                      'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                    }`}>
                      {p.opted_out ? 'Opted out' : p.confirmed ? 'Confirmed ✓' : isPreEntered ? 'Pre-entered ✓' : hasResponse ? 'Responded ✓' : 'Waiting'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{p.role || 'No role'}</p>
                  {isPreEntered && hasResponse && (
                    <div className="mt-2.5 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5 uppercase tracking-wide">Availability pre-entered:</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 italic">&quot;{p.availability_response}&quot;</p>
                    </div>
                  )}
                  {!isPreEntered && hasResponse && (
                    <div className="mt-2.5 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5 uppercase tracking-wide">Their response:</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 italic">&quot;{p.availability_response}&quot;</p>
                    </div>
                  )}
                  {p.parsed_slots && p.parsed_slots.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.parsed_slots.map((slot, si) => (
                        <span key={si} className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: '#eef0fb', color: BRAND }}>
                          {fmtCoordDate(new Date(slot.date + 'T12:00:00').toISOString())} {slot.start_time}–{slot.end_time}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {optedOut.length > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          {optedOut.map(p => p.name).join(', ')} opted out of SMS.
        </p>
      )}

      {meeting.status !== 'cancelled' && meeting.status !== 'confirmed' && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button onClick={handleCancel}
            className="min-h-[48px] px-2 text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors font-semibold">
            Cancel this coordination
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const HUB_PATH = '/dashboard/group-scheduling';
const COORDINATE_PATH = '/dashboard/coordinate';

export function CoordinateMeetingsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [meetings, setMeetings] = useState<CoordMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [selected, setSelected] = useState<CoordMeeting | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('coordinated_meetings')
      .select('*')
      .eq('host_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setMeetings((data ?? []) as CoordMeeting[]); setLoading(false); });
  }, [profile?.id]);

  useEffect(() => {
    if (loading) return;

    if (searchParams.get('new') === '1') {
      setView('new');
      return;
    }

    if (location.pathname === COORDINATE_PATH && !searchParams.get('meeting')) {
      setView('new');
      return;
    }

    const meetingId = searchParams.get('meeting');
    if (meetingId) {
      const meeting = meetings.find(m => m.id === meetingId);
      if (meeting) {
        setSelected(meeting);
        setView('detail');
        return;
      }
    }

    if (
      location.pathname !== COORDINATE_PATH &&
      !location.pathname.endsWith('/group-scheduling/coordinate')
    ) {
      setView('list');
    }
  }, [loading, searchParams, meetings, location.pathname]);

  const hostName = profile?.full_name || 'Your host';

  const isCoordinateRoute =
    location.pathname === COORDINATE_PATH ||
    location.pathname.endsWith('/group-scheduling/coordinate');

  const wantsNewForm =
    view === 'new' ||
    searchParams.get('new') === '1' ||
    (isCoordinateRoute && !searchParams.get('meeting'));

  const meetingId = searchParams.get('meeting');

  const handleCreated = (m: CoordMeeting) => {
    setMeetings(prev => [m, ...prev]);
    setSelected(m);
    setView('detail');
    navigate(`${COORDINATE_PATH}?meeting=${m.id}`, { replace: true });
  };

  const handleStatusChange = (id: string, status: CoordStatus) => {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const goHub = () => navigate(HUB_PATH);

  if (loading) {
    return (
      <main className="p-4 md:p-8 max-w-4xl flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </main>
    );
  }

  if (view === 'detail' && selected) return (
    <main className="p-4 md:p-8 max-w-3xl">
      <MeetingDetail meeting={selected} onBack={goHub} onStatusChange={handleStatusChange} />
    </main>
  );

  if (meetingId && !selected) {
    return (
      <main className="p-4 md:p-8 max-w-4xl flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </main>
    );
  }

  if (wantsNewForm) return (
    <main className="p-4 md:p-8 max-w-3xl">
      <button onClick={goHub}
        className="min-h-[44px] flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors mb-6 -ml-1 px-1">
        <ChevronLeft className="h-4 w-4" /> Back to Group Scheduling
      </button>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
        <Users className="h-6 w-6" style={{ color: BRAND }} /> Coordinate Unknown Availability
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-xl leading-relaxed">
        Find a meeting time between multiple people via SMS — no app or link needed, phone numbers stay private.
      </p>
      <NewCoordForm onCreated={handleCreated} onCancel={goHub} hostName={hostName} />
    </main>
  );

  return <Navigate to={HUB_PATH} replace />;
}
