/** Shared types and helpers for multi-party SMS coordination. */

export type CoordSchedulingIntent = 'specific_times' | 'general_timeframe';

export type CoordSimpleTimeframe =
  | 'next_3_days'
  | 'this_week'
  | 'next_2_weeks'
  | 'next_month'
  | 'custom';

export type CoordTimeOfDayKey = 'morning' | 'midday' | 'afternoon' | 'any';

export type CoordSelectedSlotsMap = Record<string, string[]>;

export interface CoordPreferredTimesPayload {
  schedulingIntent?: CoordSchedulingIntent;
  simpleTimeframe?: CoordSimpleTimeframe;
  timeOfDayPreferences?: CoordTimeOfDayKey[];
  customRangeStart?: string;
  customRangeEnd?: string;
  selectedSlots?: CoordSelectedSlotsMap;
  offHoursByDate?: Record<string, boolean>;
  allowOffHoursGlobal?: boolean;
}

export interface CoordParsedSlot {
  date: string;
  start_time: string;
  end_time: string;
}

export const COORD_SIMPLE_TIMEFRAME_LABELS: Record<CoordSimpleTimeframe, string> = {
  next_3_days: 'Next 3 days',
  this_week: 'This week',
  next_2_weeks: 'Next 2 weeks',
  next_month: 'Next month',
  custom: 'Custom range',
};

export const COORD_SIMPLE_TIMEFRAME_SMS: Record<CoordSimpleTimeframe, string> = {
  next_3_days: 'the next 3 days',
  this_week: 'this week',
  next_2_weeks: 'the next 2 weeks',
  next_month: 'the next month',
  custom: 'the selected dates',
};

export const COORD_TIME_OF_DAY_LABELS: Record<CoordTimeOfDayKey, string> = {
  morning: 'Morning',
  midday: 'Mid-day',
  afternoon: 'Afternoon',
  any: 'Any time',
};

const COORD_TIME_OF_DAY_SMS: Record<CoordTimeOfDayKey, string> = {
  morning: 'mornings',
  midday: 'mid-day',
  afternoon: 'afternoons',
  any: 'any time of day',
};

export function toLocalDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtCoordDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtCoordDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h}h ${m}m`;
}

export function formatDurationForCoordSms(minutes: number): string {
  if (minutes < 60) return `${minutes}-minute`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return h === 1 ? '1-hour' : `${h}-hour`;
  return `${h}h ${m}m`;
}

export function formatTimeOfDayPhrase(keys: CoordTimeOfDayKey[]): string {
  if (!keys.length || keys.includes('any')) return COORD_TIME_OF_DAY_SMS.any;
  const parts = keys.map(k => COORD_TIME_OF_DAY_SMS[k]);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function getWindowFromCoordDates(dates: string[]) {
  const sorted = [...dates].sort();
  if (sorted.length === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { start: today.toISOString(), end: end.toISOString() };
  }
  return {
    start: new Date(sorted[0] + 'T00:00:00').toISOString(),
    end: new Date(sorted[sorted.length - 1] + 'T23:59:59').toISOString(),
  };
}

export function getDatesForSimpleTimeframe(
  preset: CoordSimpleTimeframe,
  customStart?: string,
  customEnd?: string,
): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === 'next_3_days') {
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return toLocalDateInput(d);
    });
  }

  if (preset === 'this_week') {
    const dates: string[] = [];
    const end = new Date(today);
    end.setDate(today.getDate() + (6 - today.getDay()));
    for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(toLocalDateInput(new Date(d)));
    }
    return dates;
  }

  if (preset === 'next_2_weeks') {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return toLocalDateInput(d);
    });
  }

  if (preset === 'next_month') {
    const dates: string[] = [];
    const end = new Date(today);
    end.setDate(today.getDate() + 30);
    for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(toLocalDateInput(new Date(d)));
    }
    return dates;
  }

  if (preset === 'custom' && customStart && customEnd && customStart <= customEnd) {
    const dates: string[] = [];
    const start = new Date(`${customStart}T12:00:00`);
    const end = new Date(`${customEnd}T12:00:00`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(toLocalDateInput(new Date(d)));
    }
    return dates;
  }

  return [];
}

export function buildSimpleCoordSummary(
  timeframe: CoordSimpleTimeframe,
  timeOfDay: CoordTimeOfDayKey[],
  customStart?: string,
  customEnd?: string,
): string {
  let tf = COORD_SIMPLE_TIMEFRAME_SMS[timeframe];
  if (timeframe === 'custom' && customStart && customEnd) {
    tf = `${fmtCoordDate(new Date(`${customStart}T12:00:00`).toISOString())} – ${fmtCoordDate(new Date(`${customEnd}T12:00:00`).toISOString())}`;
  }
  return `Within ${tf} · ${formatTimeOfDayPhrase(timeOfDay)}`;
}

function formatCustomRangeSms(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `between ${fmt(start)} and ${fmt(end)}`;
}

function formatCoordSlotsForSms(
  selectedSlots: CoordSelectedSlotsMap,
  selectedDates: string[],
): string {
  const fmtDay = (dateStr: string) =>
    new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const fmtTime = (time24: string) => {
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const min = parseInt(mStr || '0', 10);
    const suffix = h < 12 ? 'am' : 'pm';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    if (min === 0) return `${hour12}${suffix}`;
    return `${hour12}:${String(min).padStart(2, '0')}${suffix}`;
  };

  const dates = selectedDates.length ? [...selectedDates].sort() : Object.keys(selectedSlots).sort();
  return dates
    .map(d => {
      const times = selectedSlots[d] ?? [];
      if (!times.length) return null;
      return `${fmtDay(d)}: ${times.map(fmtTime).join(', ')}`;
    })
    .filter(Boolean)
    .join('; ');
}

/** SMS body before the "Reply STOP" footer. */
export function buildCoordInviteSmsBody(opts: {
  participantName: string;
  hostName: string;
  title: string;
  durationMinutes: number;
  useAdvancedSlots: boolean;
  selectedSlots: CoordSelectedSlotsMap;
  selectedDates: string[];
  simpleTimeframe: CoordSimpleTimeframe;
  timeOfDayPrefs: CoordTimeOfDayKey[];
  customRangeStart?: string;
  customRangeEnd?: string;
}): string {
  const {
    participantName,
    hostName,
    title,
    durationMinutes,
    useAdvancedSlots,
    selectedSlots,
    selectedDates,
    simpleTimeframe,
    timeOfDayPrefs,
    customRangeStart,
    customRangeEnd,
  } = opts;

  const dur = formatDurationForCoordSms(durationMinutes);
  const titleClause = title.trim() ? ` ("${title.trim()}")` : '';

  if (useAdvancedSlots) {
    const slotsStr = formatCoordSlotsForSms(selectedSlots, selectedDates);
    let msg = `Hi ${participantName}! ${hostName} is looking for a ${dur} meeting${titleClause}`;
    if (slotsStr) msg += ` during these times: ${slotsStr}`;
    return `${msg}. Reply with times that work for you.`;
  }

  const tf =
    simpleTimeframe === 'custom' && customRangeStart && customRangeEnd
      ? formatCustomRangeSms(customRangeStart, customRangeEnd)
      : COORD_SIMPLE_TIMEFRAME_SMS[simpleTimeframe];
  const tod = formatTimeOfDayPhrase(timeOfDayPrefs);
  return `Hi ${participantName}! ${hostName} is looking for a ${dur} meeting within ${tf}${titleClause} — ${tod}. Reply with times that work for you.`;
}

export async function parseCoordAvailability(
  response: string,
  timeframe: { start: string; end: string },
): Promise<CoordParsedSlot[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/parse-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ response, timeframe }),
    });
    const data = await res.json();
    return (data.slots ?? []) as CoordParsedSlot[];
  } catch {
    return [];
  }
}
