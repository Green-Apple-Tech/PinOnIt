import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { PageChecklist } from '../components/PageChecklist';
import type { AvailabilitySlot, DateOverride, ScheduleBreak } from '../lib/types';
import { Plus, Trash2, X, Check, Loader2, CalendarX, CalendarDays, Settings, Zap, BellOff, Coffee, ChevronDown, ChevronUp, Clock, Info } from 'lucide-react';
import { CalendarConnections } from '../components/CalendarConnections';
import type { CalendarConflictSettings } from '../lib/types';
import { DEFAULT_CALENDAR_CONFLICT_SETTINGS } from '../lib/types';

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

const DEFAULT_START = '10:00';
const DEFAULT_MID_END = '12:00';
const DEFAULT_MID_START = '13:00';
const DEFAULT_END = '15:00';
const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri

type AvailTab = 'weekly' | 'overrides' | 'calendar';

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayShort = (d: number) => DAY_SHORT[WEEK_DAYS.indexOf(d)];

// M T W T F S S labels mapped to day numbers [1,2,3,4,5,6,0]
const BREAK_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const selectCls =
  'px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition';

// ── Multi-date picker ────────────────────────────────────────────────────────

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  const start = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < start; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CAL_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface MultiDatePickerProps {
  selected: Set<string>;
  onToggle: (date: string) => void;
}

function MultiDatePicker({ selected, onToggle }: MultiDatePickerProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const days = buildCalendarDays(year, month);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {CAL_DAY_LABELS.map((l, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 py-0.5">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isPast = dk < todayKey;
          const isSelected = selected.has(dk);
          const isToday = dk === todayKey;
          return (
            <button
              key={dk}
              onClick={() => !isPast && onToggle(dk)}
              disabled={isPast}
              className={`aspect-square flex items-center justify-center rounded text-xs font-medium transition-all relative ${
                isSelected
                  ? 'bg-red-500 text-white'
                  : isToday
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold'
                  : isPast
                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
      {selected.size > 0 && (
        <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
          {selected.size} date{selected.size > 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

// Each day can have one or two time windows (window2 = optional afternoon)
type DayConfig = {
  enabled: boolean;
  start: string;
  end: string;
  // second window (e.g. after lunch)
  split: boolean;
  start2: string;
  end2: string;
};

const DEFAULT_BREAKS: ScheduleBreak[] = [
  { id: 'work-break', label: 'Work break', start: '12:00', end: '13:00', enabled: false, days: [1,2,3,4,5] },
];

const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60];
const CUTOFF_OPTIONS = [0, 1, 2, 4, 8, 12, 24, 48];

function defaultDayConfig(enabled: boolean): DayConfig {
  return { enabled, start: DEFAULT_START, end: DEFAULT_MID_END, split: false, start2: DEFAULT_MID_START, end2: DEFAULT_END };
}

export function AvailabilityPage({ embedded }: { embedded?: boolean } = {}) {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<AvailTab>(() => {
    const t = searchParams.get('tab');
    return (t === 'calendar' || t === 'overrides') ? t : 'weekly';
  });

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [calendarCount, setCalendarCount] = useState(0);
  const [settingDefaults, setSettingDefaults] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dayConfigs, setDayConfigs] = useState<Record<number, DayConfig>>({});

  const [breaks, setBreaks] = useState<ScheduleBreak[]>(DEFAULT_BREAKS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [cutoffHours, setCutoffHours] = useState(4);
  const [conflictSettings, setConflictSettings] = useState<CalendarConflictSettings>(DEFAULT_CALENDAR_CONFLICT_SETTINGS);
  const [savingConflict, setSavingConflict] = useState(false);

  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  const [ovDates, setOvDates] = useState<Set<string>>(new Set());
  const [ovMode, setOvMode] = useState<'blocked' | 'custom' | 'ooo'>('blocked');
  const [ovStart, setOvStart] = useState('09:00');
  const [ovEnd, setOvEnd] = useState('17:00');
  const [ovReason, setOvReason] = useState('');
  const [ovOooMsg, setOvOooMsg] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    if (!profile) return;

    if (profile.schedule_breaks?.length) {
      const saved = profile.schedule_breaks as ScheduleBreak[];
      setBreaks(
        DEFAULT_BREAKS.map((def) => {
          const found = saved.find((s) => s.id === def.id);
          return found ? { ...found, days: found.days ?? def.days } : def;
        }).concat(saved.filter((s) => !DEFAULT_BREAKS.some((d) => d.id === s.id)))
      );
    }
    if (profile.meeting_buffer_minutes != null) {
      setBufferMinutes(profile.meeting_buffer_minutes);
    }
    if (profile.reschedule_cutoff_hours != null) {
      setCutoffHours(profile.reschedule_cutoff_hours);
    }
    if (profile.calendar_conflict_settings) {
      setConflictSettings({ ...DEFAULT_CALENDAR_CONFLICT_SETTINGS, ...profile.calendar_conflict_settings });
    }

    supabase
      .from('availability')
      .select('*')
      .eq('host_id', profile.id)
      .order('day_of_week')
      .then(({ data }) => {
        const fetched = (data ?? []) as AvailabilitySlot[];
        setSlots(fetched);
        const configs: Record<number, DayConfig> = {};
        WEEK_DAYS.forEach((d) => {
          const daySlots = fetched.filter((s) => s.day_of_week === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
          if (daySlots.length >= 2) {
            configs[d] = {
              enabled: true,
              start: daySlots[0].start_time,
              end: daySlots[0].end_time,
              split: true,
              start2: daySlots[1].start_time,
              end2: daySlots[1].end_time,
            };
          } else if (daySlots.length === 1) {
            configs[d] = { enabled: true, start: daySlots[0].start_time, end: daySlots[0].end_time, split: false, start2: DEFAULT_MID_START, end2: DEFAULT_END };
          } else {
            configs[d] = defaultDayConfig(false);
          }
        });
        setDayConfigs(configs);
        setSlotsLoading(false);
      });

    supabase
      .from('date_overrides')
      .select('*')
      .eq('host_id', profile.id)
      .order('override_date')
      .then(({ data }) => {
        setOverrides((data as DateOverride[]) ?? []);
        setOverridesLoading(false);
      });

    supabase
      .from('connected_calendars')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', profile.id)
      .then(({ count }) => setCalendarCount(count ?? 0));
  }, [profile]);

  const handleSetDefaults = async () => {
    if (!profile) return;
    setSettingDefaults(true);
    await supabase.from('availability').delete().eq('host_id', profile.id);
    // Two rows per enabled day: morning (10-12) and afternoon (13-15)
    const rows = DEFAULT_DAYS.flatMap((d) => [
      { host_id: profile.id, day_of_week: d, start_time: DEFAULT_START, end_time: DEFAULT_MID_END, is_active: true },
      { host_id: profile.id, day_of_week: d, start_time: DEFAULT_MID_START, end_time: DEFAULT_END, is_active: true },
    ]);
    const { data } = await supabase.from('availability').insert(rows).select();
    const fetched = (data ?? []) as AvailabilitySlot[];
    setSlots(fetched);
    const configs: Record<number, DayConfig> = {};
    WEEK_DAYS.forEach((d) => {
      if (DEFAULT_DAYS.includes(d)) {
        configs[d] = { enabled: true, start: DEFAULT_START, end: DEFAULT_MID_END, split: true, start2: DEFAULT_MID_START, end2: DEFAULT_END };
      } else {
        configs[d] = defaultDayConfig(false);
      }
    });
    setDayConfigs(configs);
    setSettingDefaults(false);
  };

  const updateDay = (day: number, patch: Partial<DayConfig>) => {
    setDayConfigs((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const handleSaveSchedule = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from('availability').delete().eq('host_id', profile.id);
    const rows: { host_id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean }[] = [];
    WEEK_DAYS.forEach((d) => {
      const cfg = dayConfigs[d];
      if (!cfg?.enabled) return;
      rows.push({ host_id: profile.id, day_of_week: d, start_time: cfg.start, end_time: cfg.end, is_active: true });
      if (cfg.split) {
        rows.push({ host_id: profile.id, day_of_week: d, start_time: cfg.start2, end_time: cfg.end2, is_active: true });
      }
    });
    if (rows.length > 0) {
      const { data } = await supabase.from('availability').insert(rows).select();
      setSlots((data ?? []) as AvailabilitySlot[]);
    } else {
      setSlots([]);
    }
    await supabase.from('profiles').update({
      schedule_breaks: breaks,
      meeting_buffer_minutes: bufferMinutes,
      reschedule_cutoff_hours: cutoffHours,
    }).eq('id', profile.id);
    setSaving(false);
  };

  const handleSaveConflictSettings = async () => {
    if (!profile) return;
    setSavingConflict(true);
    await supabase.from('profiles').update({ calendar_conflict_settings: conflictSettings }).eq('id', profile.id);
    setSavingConflict(false);
  };

  const setConflict = (key: keyof CalendarConflictSettings, val: boolean) => {
    setConflictSettings((prev) => ({ ...prev, [key]: val }));
  };

  const updateBreak = (id: string, patch: Partial<ScheduleBreak>) => {
    setBreaks((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } : b));
  };

  const toggleBreakDay = (id: string, day: number) => {
    setBreaks((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      const days = b.days.includes(day) ? b.days.filter((d) => d !== day) : [...b.days, day];
      return { ...b, days };
    }));
  };

  const addCustomBreak = () => {
    const id = `custom-${Date.now()}`;
    setBreaks((prev) => [...prev, { id, label: 'Break', start: '11:00', end: '11:30', enabled: true, days: [1,2,3,4,5] }]);
  };

  const removeBreak = (id: string) => {
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleAddOverrides = async () => {
    if (!profile || ovDates.size === 0) return;
    setSavingOverride(true);
    const isBlocked = ovMode === 'blocked' || ovMode === 'ooo';
    const dates = Array.from(ovDates).sort();
    const inserted: DateOverride[] = [];
    for (const date of dates) {
      const payload: Record<string, unknown> = {
        host_id: profile.id,
        override_date: date,
        is_blocked: isBlocked,
        reason: ovMode === 'ooo'
          ? `Out of office${ovOooMsg ? `: ${ovOooMsg}` : ''}`
          : ovReason,
      };
      if (!isBlocked) {
        payload.start_time = ovStart;
        payload.end_time = ovEnd;
      }
      const { data } = await supabase
        .from('date_overrides')
        .upsert(payload, { onConflict: 'host_id,override_date' })
        .select()
        .maybeSingle();
      if (data) inserted.push(data as DateOverride);
    }
    setOverrides((prev) => {
      const existing = prev.filter((o) => !ovDates.has(o.override_date));
      return [...existing, ...inserted].sort((a, b) => a.override_date.localeCompare(b.override_date));
    });
    setShowOverrideForm(false);
    setOvDates(new Set());
    setOvMode('blocked');
    setOvReason('');
    setOvOooMsg('');
    setSavingOverride(false);
  };

  const handleDeleteOverride = async (id: string) => {
    await supabase.from('date_overrides').delete().eq('id', id);
    setOverrides((prev) => prev.filter((o) => o.id !== id));
  };

  const resetOverrideForm = () => {
    setShowOverrideForm(false);
    setOvDates(new Set());
    setOvMode('blocked');
    setOvReason('');
    setOvOooMsg('');
  };

  const hasEnabledDays = WEEK_DAYS.some((d) => dayConfigs[d]?.enabled);

  const Wrapper = embedded ? 'div' : 'main';
  return (
    <Wrapper className={embedded ? 'w-full' : 'p-6 md:p-8 max-w-2xl'}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Availability</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Control when guests can schedule meetings with you.</p>
        </div>
      )}

      {/* Contextual checklist */}
      <PageChecklist
        storageKey="availability_checklist"
        items={[
          { id: 'schedule', label: 'Set your weekly schedule', why: 'Guests can only book during your available hours', done: slots.length > 0, action: () => setTab('weekly') },
          { id: 'calendar', label: 'Connect a calendar', why: 'Prevents double-bookings by checking your real availability', done: calendarCount > 0, action: () => setTab('calendar') },
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-800">
        {([
          { key: 'weekly' as AvailTab, label: 'Schedule', icon: CalendarDays },
          { key: 'overrides' as AvailTab, label: 'Date overrides', icon: CalendarX },
          { key: 'calendar' as AvailTab, label: 'Connect calendars', icon: Settings },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── CONNECT CALENDARS ── */}
      {tab === 'calendar' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Connect your calendars</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Block busy times automatically and prevent double-bookings across all your calendars.
              </p>
            </div>
            <div className="p-5">
              <CalendarConnections />
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-2">How it works</h3>
            <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: '#5864C6' }} />When a guest picks a time, we check your connected calendars for conflicts.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: '#5864C6' }} />Conflicting slots are hidden automatically — no double-bookings.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: '#5864C6' }} />Works with Google Calendar, Outlook, Apple iCloud, and any iCal feed.</li>
            </ul>
          </div>

          {/* Calendar Conflict Settings */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Calendar conflict settings</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Control which calendar events block your booking availability.
              </p>
            </div>
            <div className="p-5 space-y-4">
              {([
                {
                  key: 'block_all_day_busy' as const,
                  label: 'Block all-day busy events (vacation, PTO, out of office)',
                  desc: 'Blocks full days marked as busy — including vacation days, PTO, and out-of-office events.',
                  defaultOn: true,
                },
                {
                  key: 'block_free_all_day' as const,
                  label: 'Block free all-day events (birthdays, public holidays)',
                  desc: 'Blocks days with free all-day events like birthdays and national holidays.',
                  defaultOn: false,
                },
                {
                  key: 'block_declined' as const,
                  label: 'Block declined events',
                  desc: 'Block time for events you have declined. Usually you are free during these.',
                  defaultOn: false,
                },
                {
                  key: 'block_tentative' as const,
                  label: 'Block tentative / maybe events',
                  desc: 'Block time for events you have marked as tentative or "maybe".',
                  defaultOn: false,
                },
              ] as { key: keyof CalendarConflictSettings; label: string; desc: string; defaultOn: boolean }[]).map(({ key, label, desc }) => {
                const on = conflictSettings[key];
                return (
                  <div key={key} className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setConflict(key, !on)}
                      className="mt-0.5 h-5 w-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors"
                      style={on
                        ? { backgroundColor: '#5864C6', borderColor: '#5864C6' }
                        : { backgroundColor: 'white', borderColor: '#cbd5e1' }
                      }
                    >
                      {on && <Check className="h-3 w-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                );
              })}

              {/* Note */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Birthdays and public holidays marked as Free will not block your availability. Vacation days and Out of Office marked as Busy will always block your availability.</span>
              </div>

              <button
                onClick={handleSaveConflictSettings}
                disabled={savingConflict}
                className="flex items-center gap-1.5 px-5 py-2.5 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 shadow-sm hover:opacity-90"
                style={{ backgroundColor: '#5864C6' }}
              >
                {savingConflict ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {savingConflict ? 'Saving…' : 'Save conflict settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WEEKLY SCHEDULE ── */}
      {tab === 'weekly' && (
        <>
          <div className="flex items-center justify-between mb-4 gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Check the days you're available and set your hours.
            </p>
            <button
              onClick={handleSetDefaults}
              disabled={settingDefaults}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              title="Mon–Fri 9 AM – 5 PM"
            >
              {settingDefaults ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Use defaults
            </button>
          </div>

          {slotsLoading ? (
            <div className="text-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {WEEK_DAYS.map((dayNum) => {
                  const cfg = dayConfigs[dayNum] ?? defaultDayConfig(false);
                  const isWeekend = dayNum === 0 || dayNum === 6;
                  return (
                    <div key={dayNum} className={`px-5 py-2.5 transition-colors ${cfg.enabled ? '' : 'opacity-50'}`}>
                      {/* Primary row: checkbox, day, first range, + button */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateDay(dayNum, { enabled: !cfg.enabled })}
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            cfg.enabled
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                          }`}
                        >
                          {cfg.enabled && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </button>

                        <span className={`w-9 text-sm font-semibold shrink-0 ${
                          isWeekend ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {dayShort(dayNum)}
                        </span>

                        {cfg.enabled ? (
                          <>
                            <select
                              value={cfg.start}
                              onChange={(e) => {
                                const s = e.target.value;
                                updateDay(dayNum, { start: s, end: cfg.end <= s ? (TIME_OPTIONS[TIME_OPTIONS.indexOf(s) + 2] ?? '23:30') : cfg.end });
                              }}
                              className={selectCls}
                            >
                              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                            </select>
                            <span className="text-slate-400 text-xs shrink-0">–</span>
                            <select
                              value={cfg.end}
                              onChange={(e) => updateDay(dayNum, { end: e.target.value })}
                              className={selectCls}
                            >
                              {TIME_OPTIONS.filter((t) => t > cfg.start).map((t) => (
                                <option key={t} value={t}>{formatTime(t)}</option>
                              ))}
                            </select>
                            {!cfg.split && (
                              <button
                                onClick={() => updateDay(dayNum, { split: true, start2: cfg.end <= DEFAULT_MID_START ? DEFAULT_MID_START : (TIME_OPTIONS[TIME_OPTIONS.indexOf(cfg.end) + 1] ?? '13:00'), end2: DEFAULT_END })}
                                className="h-6 w-6 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 dark:hover:text-indigo-400 dark:hover:border-indigo-700 transition-colors shrink-0"
                                title="Add second time window"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="flex-1 text-xs text-slate-400 dark:text-slate-600 italic">Unavailable</span>
                        )}
                      </div>

                      {/* Second range row — only when split */}
                      {cfg.enabled && cfg.split && (
                        <div className="flex items-center gap-3 mt-1.5 ml-8">
                          <div className="w-0.5 h-3 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                          <select
                            value={cfg.start2}
                            onChange={(e) => {
                              const s = e.target.value;
                              updateDay(dayNum, { start2: s, end2: cfg.end2 <= s ? (TIME_OPTIONS[TIME_OPTIONS.indexOf(s) + 2] ?? '23:30') : cfg.end2 });
                            }}
                            className={selectCls}
                          >
                            {TIME_OPTIONS.filter((t) => t > cfg.end).map((t) => (
                              <option key={t} value={t}>{formatTime(t)}</option>
                            ))}
                          </select>
                          <span className="text-slate-400 text-xs shrink-0">–</span>
                          <select
                            value={cfg.end2}
                            onChange={(e) => updateDay(dayNum, { end2: e.target.value })}
                            className={selectCls}
                          >
                            {TIME_OPTIONS.filter((t) => t > cfg.start2).map((t) => (
                              <option key={t} value={t}>{formatTime(t)}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => updateDay(dayNum, { split: false })}
                            className="h-6 w-6 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors shrink-0"
                            title="Remove second window"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!hasEnabledDays && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  No days selected — guests won't be able to book any meetings. Click "Use defaults" to quickly set Mon–Fri 9–5.
                </div>
              )}

              {/* ── Breaks ── */}
              <div className="mt-5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Coffee className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Breaks</h3>
                    <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">Block time during your day so no meetings can be booked</span>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {breaks.map((brk) => (
                    <div key={brk.id} className={`space-y-2 transition-opacity ${brk.enabled ? '' : 'opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        {/* Toggle */}
                        <button
                          onClick={() => updateBreak(brk.id, { enabled: !brk.enabled })}
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            brk.enabled
                              ? 'bg-amber-500 border-amber-500'
                              : 'border-slate-300 dark:border-slate-600 hover:border-amber-400'
                          }`}
                        >
                          {brk.enabled && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </button>

                        {/* Label */}
                        {brk.id.startsWith('custom') ? (
                          <input
                            value={brk.label}
                            onChange={(e) => updateBreak(brk.id, { label: e.target.value })}
                            className="w-32 px-2 py-1 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        ) : (
                          <span className="w-32 text-sm font-medium text-slate-800 dark:text-slate-200 shrink-0">{brk.label}</span>
                        )}

                        {/* Time range */}
                        <div className="flex items-center gap-1.5 flex-1">
                          <select
                            value={brk.start}
                            onChange={(e) => {
                              const s = e.target.value;
                              updateBreak(brk.id, {
                                start: s,
                                end: brk.end <= s ? (TIME_OPTIONS[TIME_OPTIONS.indexOf(s) + 1] ?? '23:30') : brk.end,
                              });
                            }}
                            className={`${selectCls} text-xs py-1.5`}
                          >
                            {TIME_OPTIONS.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                          </select>
                          <span className="text-slate-400 text-xs">–</span>
                          <select
                            value={brk.end}
                            onChange={(e) => updateBreak(brk.id, { end: e.target.value })}
                            className={`${selectCls} text-xs py-1.5`}
                          >
                            {TIME_OPTIONS.filter((t) => t > brk.start).map((t) => (
                              <option key={t} value={t}>{formatTime(t)}</option>
                            ))}
                          </select>
                        </div>

                        {brk.id.startsWith('custom') && (
                          <button
                            onClick={() => removeBreak(brk.id)}
                            className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Day-of-week toggles */}
                      <div className="flex items-center gap-1 ml-8">
                        {WEEK_DAYS.map((dayNum, idx) => {
                          const isOn = brk.days.includes(dayNum);
                          return (
                            <button
                              key={dayNum}
                              onClick={() => toggleBreakDay(brk.id, dayNum)}
                              className={`h-6 w-6 rounded-full text-[11px] font-bold transition-all ${
                                isOn
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400'
                              }`}
                              title={['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][idx]}
                            >
                              {BREAK_DAY_LABELS[idx]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addCustomBreak}
                    className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold transition-colors mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add another break
                  </button>
                </div>
              </div>

              {/* ── Advanced ── */}
              <div className="mt-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Advanced</span>
                    {bufferMinutes > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-semibold rounded-full">
                        {bufferMinutes}min buffer
                      </span>
                    )}
                    {cutoffHours !== 4 && (
                      <span className="ml-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-full">
                        {cutoffHours === 0 ? 'reschedule anytime' : `${cutoffHours}h cutoff`}
                      </span>
                    )}
                  </div>
                  {showAdvanced
                    ? <ChevronUp className="h-4 w-4 text-slate-400" />
                    : <ChevronDown className="h-4 w-4 text-slate-400" />
                  }
                </button>
                {showAdvanced && (
                  <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Buffer between meetings
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Add a gap after every meeting so you have time to prepare, take notes, or take a breath.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {BUFFER_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setBufferMinutes(opt)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            bufferMinutes === opt
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
                          }`}
                        >
                          {opt === 0 ? 'None' : `${opt} min`}
                        </button>
                      ))}
                    </div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 mt-5">
                      Guest reschedule cutoff
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Guests can text <span className="font-semibold">2</span> or <span className="font-semibold">reschedule</span> to get a link and pick a new time — until this cutoff. Default is 4 hours.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CUTOFF_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCutoffHours(opt)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            cutoffHours === opt
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
                          }`}
                        >
                          {opt === 0 ? 'Until start' : `${opt} hr`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSaveSchedule}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 shadow-sm hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? 'Saving…' : 'Save schedule'}
                </button>
                {saving === false && slots.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Currently: {slots.filter((s) => s.is_active).length} active slot{slots.filter((s) => s.is_active).length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── DATE OVERRIDES ── */}
      {tab === 'overrides' && (
        <>
          <div className="flex items-center justify-between mb-4 gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Block days off, set custom hours, or mark out-of-office for specific dates.
            </p>
            {!showOverrideForm && (
              <button
                onClick={() => setShowOverrideForm(true)}
                className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 shrink-0 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
              >
                <Plus className="h-4 w-4" /> Add override
              </button>
            )}
          </div>

          {showOverrideForm && (
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-5">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Add date override</h3>
                <button onClick={resetOverrideForm} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Select date{ovDates.size !== 1 ? 's' : ''} — click to toggle
                  </p>
                  <MultiDatePicker selected={ovDates} onToggle={(d) => {
                    setOvDates((prev) => {
                      const next = new Set(prev);
                      if (next.has(d)) next.delete(d); else next.add(d);
                      return next;
                    });
                  }} />
                  {ovDates.size === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">Pick at least one date above.</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'blocked', label: 'Block day', desc: 'No meetings', icon: <X className="h-4 w-4" /> },
                      { key: 'custom', label: 'Custom hours', desc: 'Set availability', icon: <CalendarDays className="h-4 w-4" /> },
                      { key: 'ooo', label: 'Out of office', desc: 'Auto-reply', icon: <BellOff className="h-4 w-4" /> },
                    ] as const).map(({ key, label, desc, icon }) => (
                      <button
                        key={key}
                        onClick={() => setOvMode(key)}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          ovMode === key
                            ? key === 'ooo'
                              ? 'bg-amber-50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-500'
                              : key === 'blocked'
                              ? 'bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-500'
                              : 'bg-indigo-50 border-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-500'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className={`mb-1 ${
                          ovMode === key
                            ? key === 'ooo' ? 'text-amber-600 dark:text-amber-400' : key === 'blocked' ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400'
                        }`}>{icon}</div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {ovMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Available from</label>
                      <select
                        value={ovStart}
                        onChange={(e) => {
                          setOvStart(e.target.value);
                          if (ovEnd <= e.target.value) setOvEnd(TIME_OPTIONS[TIME_OPTIONS.indexOf(e.target.value) + 1] ?? '23:30');
                        }}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                      >
                        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Available until</label>
                      <select
                        value={ovEnd}
                        onChange={(e) => setOvEnd(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                      >
                        {TIME_OPTIONS.filter((t) => t > ovStart).map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {ovMode === 'ooo' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                      Out-of-office message <span className="font-normal">(optional, shown to guests)</span>
                    </label>
                    <textarea
                      value={ovOooMsg}
                      onChange={(e) => setOvOooMsg(e.target.value)}
                      rows={2}
                      placeholder="e.g. I'm on vacation and will be back on June 2nd."
                      className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition resize-none"
                    />
                  </div>
                )}

                {ovMode === 'blocked' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Reason (private, optional)</label>
                    <input
                      type="text"
                      value={ovReason}
                      onChange={(e) => setOvReason(e.target.value)}
                      placeholder="e.g. Holiday, Conference, Personal"
                      className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                    />
                  </div>
                )}

                <button
                  onClick={handleAddOverrides}
                  disabled={savingOverride || ovDates.size === 0}
                  className="px-5 py-2.5 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                >
                  {savingOverride ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save {ovDates.size > 0 ? `${ovDates.size} date${ovDates.size > 1 ? 's' : ''}` : 'override'}
                </button>
              </div>
            </div>
          )}

          {overridesLoading ? (
            <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" /></div>
          ) : (
            <div className="space-y-2">
              {overrides.map((ov) => {
                const isOoo = ov.reason?.startsWith('Out of office');
                return (
                  <div key={ov.id} className={`p-4 bg-white dark:bg-slate-900/50 border rounded-xl flex items-center justify-between gap-4 ${
                    isOoo ? 'border-amber-200 dark:border-amber-800/40' : ov.is_blocked ? 'border-red-200 dark:border-red-800/40' : 'border-slate-200 dark:border-slate-800'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isOoo ? 'bg-amber-50 dark:bg-amber-900/20' : ov.is_blocked ? 'bg-red-50 dark:bg-red-900/20' : 'bg-indigo-50 dark:bg-indigo-900/20'
                      }`}>
                        {isOoo
                          ? <BellOff className="h-4 w-4 text-amber-500" />
                          : ov.is_blocked
                          ? <X className="h-4 w-4 text-red-500" />
                          : <CalendarDays className="h-4 w-4 text-indigo-600" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {new Date(ov.override_date + 'T12:00:00').toLocaleDateString('en-US', {
                            weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                        <p className={`text-xs mt-0.5 ${
                          isOoo ? 'text-amber-600 dark:text-amber-400' : ov.is_blocked ? 'text-red-400' : 'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {isOoo
                            ? ov.reason
                            : ov.is_blocked
                            ? `Blocked${ov.reason ? ` — ${ov.reason}` : ''}`
                            : `Custom hours: ${formatTime(ov.start_time!)} – ${formatTime(ov.end_time!)}`
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteOverride(ov.id)}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              {overrides.length === 0 && !showOverrideForm && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <CalendarX className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">No overrides yet</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Block holidays, vacations, or set custom hours for specific dates.</p>
                  <button
                    onClick={() => setShowOverrideForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-full transition-all hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                  >
                    <Plus className="h-4 w-4" /> Add override
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Wrapper>
  );
}
