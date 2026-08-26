import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Booking, Service } from '../lib/types';
import { formatRecurrenceHostLabel, getSeriesRootId } from '../lib/recurring';
import { parseBlockInput } from '../lib/bookingBlocks';
import { toast } from '../components/Toast';
import { syncBookingToExternalCalendarsAsHost } from '../lib/writeCalendarEvent';
import { BookingAlsoRemindPicker } from '../components/BookingAlsoRemindPicker';
import { parseAlsoRemindIds } from '../lib/reminderAlso';
import { CalendarConnections } from '../components/CalendarConnections';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  MapPin,
  Video,
  Phone,
  Globe,
  Plus,
  Search,
  Bell,
  BellRing,
  Check,
  X,
  Loader2,
  Lock,
  Upload,
  RefreshCw,
  Repeat,
  Mail,
  MessageSquare,
  Ban,
  Flag,
} from 'lucide-react';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

interface CalendarEvent {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  provider: string;
  also_remind_ids?: string[] | null;
}

type ReminderChannel = 'email' | 'sms' | 'whatsapp';

const REMINDER_OFFSETS = [
  { value: -15, label: '15 min before' },
  { value: -30, label: '30 min before' },
  { value: -60, label: '1 hour before' },
  { value: -120, label: '2 hours before' },
  { value: -240, label: '4 hours before' },
  { value: -1440, label: '1 day before' },
] as const;

function ExtraReminderFields({
  channels,
  onToggleChannel,
  offset,
  onOffset,
}: {
  channels: ReminderChannel[];
  onToggleChannel: (ch: ReminderChannel) => void;
  offset: number;
  onOffset: (n: number) => void;
}) {
  const opts: { id: ReminderChannel; label: string; icon: typeof Mail }[] = [
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'sms', label: 'SMS', icon: Phone },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Extra reminder</p>
      <div className="flex flex-wrap gap-2">
        {opts.map(({ id, label, icon: Icon }) => {
          const on = channels.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggleChannel(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                on
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
      {channels.length > 0 && (
        <select
          value={offset}
          onChange={(e) => onOffset(Number(e.target.value))}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          {REMINDER_OFFSETS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ── Add Event Modal ────────────────────────────────────────────────────────────

interface AddEventModalProps {
  services: Service[];
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}

function AddEventModal({ services, defaultDate, onClose, onSaved }: AddEventModalProps) {
  const { profile } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [extraChannels, setExtraChannels] = useState<ReminderChannel[]>([]);
  const [extraOffset, setExtraOffset] = useState(-60);

  const toggleExtra = (ch: ReminderChannel) => {
    setExtraChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

  const handleSave = async () => {
    if (!guestName.trim() || !date || !time || !serviceId || !profile) return;
    setError('');
    setSaving(true);
    const svc = services.find(s => s.id === serviceId);
    const startDt = new Date(`${date}T${time}:00`);
    const endDt = new Date(startDt.getTime() + (svc?.duration_minutes ?? 60) * 60000);

    // Conflict detection: check for overlapping confirmed bookings
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, guest_name, start_time, end_time')
      .eq('host_id', profile.id)
      .eq('status', 'confirmed')
      .lt('start_time', endDt.toISOString())
      .gt('end_time', startDt.toISOString());

    if (conflicts && conflicts.length > 0) {
      const conflict = conflicts[0];
      setError(`Conflicts with existing booking for ${conflict.guest_name} at ${new Date(conflict.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`);
      setSaving(false);
      return;
    }

    const { data: created, error: err } = await supabase.from('bookings').insert({
      host_id: profile.id,
      service_id: serviceId || null,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim() || null,
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      status: 'confirmed',
    }).select('id').maybeSingle();
    setSaving(false);
    if (err) { setError(err.message); return; }
    if (created?.id && extraChannels.length > 0) {
      await supabase.from('event_reminder_overrides').insert(
        extraChannels.map((channel) => ({
          booking_id: created.id,
          host_id: profile.id,
          channel,
          offset_minutes: extraOffset,
          message: '',
        })),
      );
    }
    if (created?.id) {
      void syncBookingToExternalCalendarsAsHost({ bookingId: created.id, hostId: profile.id });
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Meeting</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-2">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Guest Name</label>
              <input
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Guest Email</label>
              <input
                type="email"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Service</label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
              >
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
              />
            </div>
          </div>
          <ExtraReminderFields
            channels={extraChannels}
            onToggleChannel={toggleExtra}
            offset={extraOffset}
            onOffset={setExtraOffset}
          />
          <button
            onClick={handleSave}
            disabled={saving || !guestName.trim() || !serviceId}
            className="w-full py-3 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm" style={{ backgroundColor: '#5864C6' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Add Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function groupByDate(bookings: Booking[]): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = toDateKey(new Date(b.start_time));
    const list = map.get(key) ?? [];
    list.push(b);
    map.set(key, list);
  }
  return map;
}

const CALENDAR_HOUR_START = 7;
const CALENDAR_HOUR_END = 21;

function formatHourLabel(h: number) {
  if (h === 12) return '12 PM';
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

const CALENDAR_REMINDER_HINT_KEY = 'calendar_reminder_hint_v2';
const EVENT_HOVER_HINT = 'Click for extra reminder · Right-click for Email / SMS / WhatsApp';

function EventHoverHint() {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-[70] mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 sm:block dark:bg-slate-700">
      {EVENT_HOVER_HINT}
    </span>
  );
}

function MonthBookingCard({ booking, onOpen, onContext }: { booking: Booking; onOpen: () => void; onContext: (e: React.MouseEvent) => void }) {
  const svc = (booking as Booking & { services?: { name?: string; color?: string } }).services;
  const title = svc?.name ?? 'Appointment';
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContext(e); }}
      className="group relative z-0 hover:z-20 text-sm px-2 py-1.5 rounded-md shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer"
    >
      <EventHoverHint />
      <div className="flex items-start gap-1.5">
        <span className="h-2 w-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: svc?.color ?? '#5864C6' }} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatTime(booking.start_time)}</p>
          {booking.guest_name && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{booking.guest_name}</p>}
        </div>
      </div>
    </div>
  );
}

function WeekBookingCard({ booking, onOpen, onContext }: { booking: Booking; onOpen: () => void; onContext: (e: React.MouseEvent) => void }) {
  const svc = (booking as Booking & { services?: { name?: string; color?: string } }).services;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContext(e); }}
      className="group relative z-0 hover:z-20 text-sm p-2 rounded-md shadow-sm border border-slate-100 dark:border-slate-700 mb-1.5 cursor-pointer"
      style={{ backgroundColor: `${svc?.color ?? '#5864C6'}18`, borderLeftColor: svc?.color ?? '#5864C6', borderLeftWidth: 3 }}
    >
      <EventHoverHint />
      <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">{svc?.name ?? 'Appointment'}</p>
      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{booking.guest_name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</p>
    </div>
  );
}

function CurrentTimeLine({ hourStart = CALENDAR_HOUR_START, hourEnd = CALENDAR_HOUR_END }: { hourStart?: number; hourEnd?: number }) {
  const now = new Date();
  const totalMinutes = (hourEnd - hourStart) * 60;
  const currentMinutes = (now.getHours() - hourStart) * 60 + now.getMinutes();
  if (currentMinutes < 0 || currentMinutes > totalMinutes) return null;
  const topPct = (currentMinutes / totalMinutes) * 100;
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${topPct}%` }}>
      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
      <div className="flex-1 border-t-2 border-red-500" />
    </div>
  );
}

type ViewMode = 'agenda' | 'month' | 'week' | 'day';

// ── Page ──────────────────────────────────────────────────────────────────────

interface ReminderOverride {
  id: string;
  booking_id: string | null;
  calendar_event_id?: string | null;
  channel: ReminderChannel;
  offset_minutes: number;
  message: string;
}

type ReminderTarget =
  | { kind: 'booking'; booking: Booking }
  | { kind: 'external'; event: CalendarEvent };

interface EventMenuState {
  x: number;
  y: number;
  target: ReminderTarget;
}

export function AppointmentsPage() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'agenda' : 'month',
  );
  const [search, setSearch] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showCalendarConnect, setShowCalendarConnect] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  // Reminder override panel
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null);
  const [reminderOverrides, setReminderOverrides] = useState<ReminderOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [newReminderChannel, setNewReminderChannel] = useState<ReminderChannel>('email');
  const [newReminderOffset, setNewReminderOffset] = useState(-60);
  const [newReminderMsg, setNewReminderMsg] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
  const [eventMenu, setEventMenu] = useState<EventMenuState | null>(null);
  const [showReminderHint, setShowReminderHint] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [cancelMsg, setCancelMsg] = useState('');
  const icsInputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(today));
  const [agendaAnchor, setAgendaAnchor] = useState<'future' | 'all'>('future');

  const loadData = async () => {
    if (!profile) return;
    const [bookRes, svcRes, extEvtRes, personalRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, services(name, color, duration_minutes, location_type, location)')
        .eq('host_id', profile.id)
        .order('start_time', { ascending: true }),
      supabase.from('services').select('*').eq('host_id', profile.id),
      supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at, all_day, also_remind_ids, connected_calendars(provider)')
        .eq('host_id', profile.id)
        .order('start_at', { ascending: true }),
      supabase
        .from('personal_reminders')
        .select('id, title, due_at')
        .eq('host_id', profile.id)
        .eq('status', 'active')
        .order('due_at', { ascending: true }),
    ]);
    setBookings((bookRes.data ?? []) as Booking[]);
    setServices((svcRes.data ?? []) as Service[]);
    const evts = (extEvtRes.data ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      start_at: e.start_at,
      end_at: e.end_at,
      all_day: e.all_day,
      provider: e.connected_calendars?.provider ?? 'external',
      also_remind_ids: e.also_remind_ids,
    }));
    const personal = (personalRes.data ?? []).map((r: { id: string; title: string; due_at: string }) => {
      const start = new Date(r.due_at);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        id: `personal:${r.id}`,
        title: r.title,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: false,
        provider: 'personal',
      } satisfies CalendarEvent;
    });
    setExternalEvents([...evts, ...personal]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [profile]);

  useEffect(() => {
    if (loading) return;
    try {
      if (localStorage.getItem(CALENDAR_REMINDER_HINT_KEY) === '1') return;
    } catch { /* ignore */ }
    setShowReminderHint(true);
  }, [loading]);

  const dismissReminderHint = () => {
    try { localStorage.setItem(CALENDAR_REMINDER_HINT_KEY, '1'); } catch { /* ignore */ }
    setShowReminderHint(false);
  };

  useEffect(() => {
    if (!eventMenu) return;
    const close = () => setEventMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [eventMenu]);

  // Handle OAuth callback params from calendar connect redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('calendar_connected');
    const err = params.get('calendar_error');
    if (connected || err) {
      window.history.replaceState({}, '', window.location.pathname);
      if (connected) loadData();
    }
  }, []);

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (agendaAnchor === 'future') list = list.filter(b => new Date(b.start_time) >= today);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.guest_name.toLowerCase().includes(q) ||
        (b.guest_email ?? '').toLowerCase().includes(q) ||
        (b as any).services?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, agendaAnchor, search]);

  const filteredExternal = useMemo(() => {
    let list = externalEvents;
    if (agendaAnchor === 'future') list = list.filter(e => new Date(e.start_at) >= today);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q));
    }
    return list;
  }, [externalEvents, agendaAnchor, search]);

  const grouped = useMemo(() => groupByDate(filteredBookings), [filteredBookings]);

  const bookingDays = useMemo(() => {
    const s = new Set<string>();
    for (const b of bookings) s.add(toDateKey(new Date(b.start_time)));
    for (const e of externalEvents) s.add(toDateKey(new Date(e.start_at)));
    return s;
  }, [bookings, externalEvents]);

  const sortedDateKeys = useMemo(() => {
    const keys = new Set(grouped.keys());
    for (const e of filteredExternal) keys.add(toDateKey(new Date(e.start_at)));
    return Array.from(keys).sort();
  }, [grouped, filteredExternal]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [calYear, calMonth]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-sync`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      const json = await res.json();
      const total = Object.values(json.results ?? {}).reduce((acc: number, r: any) => acc + (r.synced ?? 0), 0);
      setSyncMsg(`Synced ${total} event${total !== 1 ? 's' : ''}`);
      await loadData();
    } catch {
      setSyncMsg('Sync failed');
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(''), 4000);
  };

  const handleIcsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const events: { title: string; start: string; end: string }[] = [];
    let cur: Partial<{ title: string; start: string; end: string }> = {};
    const parseIcsDate = (v: string) => {
      const d = v.replace(/[TZ]/g, '');
      return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(8,10)}:${d.slice(10,12)}:${d.slice(12,14)}`;
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (line === 'BEGIN:VEVENT') { cur = {}; }
      else if (line.startsWith('SUMMARY:')) { cur.title = line.replace('SUMMARY:', ''); }
      else if (line.startsWith('DTSTART')) { cur.start = parseIcsDate(line.split(':')[1] ?? ''); }
      else if (line.startsWith('DTEND')) { cur.end = parseIcsDate(line.split(':')[1] ?? ''); }
      else if (line === 'END:VEVENT' && cur.title && cur.start && cur.end) {
        events.push(cur as { title: string; start: string; end: string });
        cur = {};
      }
    }
    if (events.length === 0) { setSyncMsg('No events found in file'); setTimeout(() => setSyncMsg(''), 4000); return; }
    const rows = events.map(ev => ({
      host_id: profile.id,
      calendar_id: null,
      title: ev.title,
      start_at: ev.start,
      end_at: ev.end,
      all_day: false,
      provider: 'ics',
    }));
    await supabase.from('calendar_events').upsert(rows, { onConflict: 'calendar_id,provider_event_id' }).select();
    setSyncMsg(`Imported ${events.length} event${events.length !== 1 ? 's' : ''}`);
    setTimeout(() => setSyncMsg(''), 4000);
    await loadData();
    if (icsInputRef.current) icsInputRef.current.value = '';
  };

  const openReminderPanel = async (target: ReminderTarget, channel?: ReminderChannel) => {
    setEventMenu(null);
    if (target.kind === 'external' && target.event.provider === 'personal') {
      // Personal "Remind me" items already have their own channel schedule — no override panel.
      return;
    }
    setReminderTarget(target);
    if (channel) setNewReminderChannel(channel);
    setLoadingOverrides(true);
    const q = supabase.from('event_reminder_overrides').select('*');
    const { data } = target.kind === 'booking'
      ? await q.eq('booking_id', target.booking.id).order('offset_minutes')
      : await q.eq('calendar_event_id', target.event.id).order('offset_minutes');
    setReminderOverrides((data ?? []) as ReminderOverride[]);
    setLoadingOverrides(false);
  };

  const openEventMenu = (e: React.MouseEvent, target: ReminderTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setEventMenu({ x: e.clientX, y: e.clientY, target });
  };

  const handleAddOverride = async () => {
    if (!profile || !reminderTarget) return;
    setSavingOverride(true);
    const row = {
      host_id: profile.id,
      channel: newReminderChannel,
      offset_minutes: newReminderOffset,
      message: newReminderMsg.trim(),
      booking_id: reminderTarget.kind === 'booking' ? reminderTarget.booking.id : null,
      calendar_event_id: reminderTarget.kind === 'external' ? reminderTarget.event.id : null,
    };
    const { data } = await supabase.from('event_reminder_overrides').insert(row).select().maybeSingle();
    if (data) setReminderOverrides(prev => [...prev, data as ReminderOverride]);
    setNewReminderMsg('');
    setSavingOverride(false);
  };

  const quickAddReminder = async (target: ReminderTarget, channel: ReminderChannel) => {
    if (!profile) return;
    setEventMenu(null);
    await supabase.from('event_reminder_overrides').insert({
      host_id: profile.id,
      channel,
      offset_minutes: -60,
      message: '',
      booking_id: target.kind === 'booking' ? target.booking.id : null,
      calendar_event_id: target.kind === 'external' ? target.event.id : null,
    });
    const label = channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email';
    setSyncMsg(`${label} reminder set for 1 hour before`);
    setTimeout(() => setSyncMsg(''), 4000);
  };

  const handleDeleteOverride = async (id: string) => {
    await supabase.from('event_reminder_overrides').delete().eq('id', id);
    setReminderOverrides(prev => prev.filter(r => r.id !== id));
  };

  const handleCancelBooking = async (id: string) => {
    const b = bookings.find((x) => x.id === id);
    await supabase.from('bookings').update({ status: 'canceled' }).eq('id', id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'canceled' as const } : b));
    if (detailBooking?.id === id) setDetailBooking(null);
    if (b && profile?.id) {
      void syncBookingToExternalCalendarsAsHost({ bookingId: id, hostId: profile.id, action: 'delete' });
    }
  };

  const blockGuestFromBooking = async (
    booking: Booking,
    reason: 'blocked' | 'spam',
    as: 'email' | 'domain' = 'email',
  ) => {
    if (!profile?.id || !booking.guest_email) {
      toast.error('This meeting has no email to block.');
      return;
    }
    const parsed = parseBlockInput(booking.guest_email);
    if (!parsed) {
      toast.error('That email does not look valid.');
      return;
    }
    const value =
      as === 'domain'
        ? (parsed.matchType === 'domain' ? parsed.value : parsed.value.slice(parsed.value.lastIndexOf('@') + 1))
        : parsed.value;
    const matchType = as === 'domain' ? 'domain' : parsed.matchType;
    const { error } = await supabase.from('booking_blocks').upsert(
      {
        host_id: profile.id,
        match_type: matchType,
        value,
        reason,
      },
      { onConflict: 'host_id,match_type,value' },
    );
    if (error) {
      toast.error('Could not add that block.');
      return;
    }
    const label = matchType === 'domain' ? `@${value}` : value;
    toast.success(
      reason === 'spam'
        ? `${label} marked as spam — they cannot book again.`
        : `${label} is blocked from booking.`,
    );
    setEventMenu(null);
  };

  const notifyRecurringCancellation = async (booking: Booking, serviceName: string) => {
    const hostName = profile?.full_name || 'your host';
    const message = `Your recurring ${serviceName} with ${hostName} has been cancelled. No future bookings will be scheduled.`;
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ notify_cancellation: true, booking_id: booking.id, message }),
      });
    } catch { /* best-effort */ }
    setCancelMsg(`Cancelled recurring series — guest notified by email if configured.`);
    setTimeout(() => setCancelMsg(''), 5000);
  };

  const handleCancelRecurringOccurrence = async (booking: Booking) => {
    await handleCancelBooking(booking.id);
  };

  const handleCancelAllFutureRecurring = async (booking: Booking) => {
    const rootId = getSeriesRootId(booking);
    const { data: series } = await supabase
      .from('bookings')
      .select('id, start_time')
      .or(`id.eq.${rootId},parent_booking_id.eq.${rootId}`)
      .gte('start_time', booking.start_time)
      .neq('status', 'canceled');

    const ids = (series ?? []).map(b => b.id);
    if (ids.length) {
      await supabase.from('bookings').update({ status: 'canceled' }).in('id', ids);
      setBookings(prev => prev.map(b => ids.includes(b.id) ? { ...b, status: 'canceled' as const } : b));
    }
    const svcName = (booking as Booking & { services?: Service }).services?.name ?? 'appointment';
    await notifyRecurringCancellation(booking, svcName);
    setDetailBooking(null);
  };
  const handleCompleteBooking = async (id: string) => {
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'completed' as const } : b));
  };
  const handleApproveBooking = async (id: string) => {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'confirmed' as const } : b));
    if (profile?.id) {
      void syncBookingToExternalCalendarsAsHost({ bookingId: id, hostId: profile.id });
    }
  };
  const handleMarkTentative = async (id: string) => {
    await supabase.from('bookings').update({ status: 'tentative' }).eq('id', id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'tentative' as const } : b));
  };
  const handleToggleCritical = async (b: Booking) => {
    const next = !b.is_critical;
    await supabase.from('bookings').update({ is_critical: next }).eq('id', b.id);
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, is_critical: next } : x));
  };

  function getLocationIcon(type: string | undefined) {
    if (type === 'video') return Video;
    if (type === 'phone') return Phone;
    if (type === 'in_person') return MapPin;
    return Globe;
  }

  return (
    <main className="p-6 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" style={{ color: '#5864C6' }} />
            Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            View and manage all your scheduled meetings.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {syncMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{syncMsg}</span>
          )}
          {cancelMsg && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs truncate">{cancelMsg}</span>
          )}
          {/* Import .ics */}
          <input ref={icsInputRef} type="file" accept=".ics" onChange={handleIcsImport} className="sr-only" />
          <button
            onClick={() => icsInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-all"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          {/* Sync */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-all disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </button>
          {/* Add / Connect Calendars */}
          <button
            onClick={() => setShowCalendarConnect(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-all"
          >
            <Plus className="h-4 w-4" /> Add or Connect Calendars
          </button>
          {/* Add Event */}
          <button
            onClick={() => setShowAddEvent(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
          >
            <Plus className="h-4 w-4" /> Add Meeting
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: mini calendar + calendar connections */}
        <aside className="hidden lg:flex flex-col gap-4 w-56 shrink-0">
          {/* Mini calendar */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={prevMonth} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
              <button onClick={nextMonth} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAY_SHORT.map(d => (
                <div key={d} className="text-center text-[9px] font-medium text-slate-400 dark:text-slate-500 py-0.5">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((d, i) => {
                if (!d) return <div key={`e-${i}`} />;
                const dk = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const isToday = dk === toDateKey(today);
                const isSelected = dk === selectedDate;
                const hasBooking = bookingDays.has(dk);
                return (
                  <button
                    key={dk}
                    onClick={() => { setSelectedDate(dk); setView('agenda'); }}
                    className={`aspect-square flex flex-col items-center justify-center rounded text-xs font-medium transition-all relative ${
                      isSelected ? 'bg-indigo-700 text-white' :
                      isToday ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-500 font-bold' :
                      'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {d}
                    {hasBooking && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick links */}
          <div className="text-xs text-slate-500 dark:text-slate-400 space-x-2 flex flex-wrap gap-1">
            <button onClick={() => { setSelectedDate(toDateKey(today)); setAgendaAnchor('future'); }} className="hover:text-indigo-600 dark:hover:text-indigo-500 transition-colors">today</button>
            <span>|</span>
            <button onClick={() => {
              const t = new Date(today); t.setDate(t.getDate() + 1);
              setSelectedDate(toDateKey(t)); setAgendaAnchor('future');
            }} className="hover:text-indigo-600 dark:hover:text-indigo-500 transition-colors">tomorrow</button>
            <span>|</span>
            <button onClick={() => setAgendaAnchor('future')} className="hover:text-indigo-600 dark:hover:text-indigo-500 transition-colors">upcoming</button>
          </div>

          {/* Connected external calendars */}
          <CalendarConnections compact />
        </aside>

        {/* Right: agenda / calendar view */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs font-medium">
              {(['agenda','month','week','day'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-2 capitalize transition-colors ${
                    view === v
                      ? 'text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  style={view === v ? { backgroundColor: '#5864C6' } : {}}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 min-w-[140px] text-center">
                {MONTH_NAMES[calMonth]} {calYear}{agendaAnchor === 'future' ? ' – Future' : ''}
              </span>
              <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search meetings..."
                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : view === 'month' ? (
            /* ── MONTH VIEW ── */
            <div className="w-full">
            <div className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-visible">
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
                {DAY_SHORT.map(d => (
                  <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="min-h-[100px] lg:min-h-[120px] border-b border-r border-slate-100 dark:border-slate-800/60" />;
                  const dk = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const isToday = dk === toDateKey(today);
                  const dayBookings = grouped.get(dk) ?? [];
                  const dayExternal = externalEvents.filter(e => toDateKey(new Date(e.start_at)) === dk);
                  const totalCount = dayBookings.length + dayExternal.length;
                  const slotsLeft = 3;
                  const externalToShow = dayExternal.slice(0, slotsLeft);
                  const bookingsToShow = dayBookings.slice(0, Math.max(0, slotsLeft - externalToShow.length));
                  const overflow = totalCount - externalToShow.length - bookingsToShow.length;
                  return (
                    <div key={dk}
                      onClick={() => { setSelectedDate(dk); setView('day'); }}
                      className={`min-h-[100px] lg:min-h-[120px] border-b border-r border-slate-100 dark:border-slate-800/60 p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isToday ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
                      <span className={`text-sm font-semibold inline-flex h-6 w-6 items-center justify-center rounded-full ${isToday ? 'bg-[#5864C6] text-white' : 'text-slate-700 dark:text-slate-300'}`}>{d}</span>
                      <div className="mt-1.5 space-y-1">
                        {externalToShow.map(e => (
                          <div
                            key={e.id}
                            onClick={(ev) => { ev.stopPropagation(); void openReminderPanel({ kind: 'external', event: e }); }}
                            onContextMenu={(ev) => openEventMenu(ev, { kind: 'external', event: e })}
                            className="group relative z-0 hover:z-20 text-sm px-2 py-1 rounded-md flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 shadow-sm cursor-pointer"
                          >
                            <EventHoverHint />
                            <span className={`h-2 w-2 rounded-full shrink-0 ${e.provider === 'google' ? 'bg-red-400' : e.provider === 'outlook' ? 'bg-blue-400' : e.provider === 'personal' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                            <span className="truncate">{e.all_day ? e.title : `${formatTime(e.start_at)} ${e.title}`}</span>
                          </div>
                        ))}
                        {bookingsToShow.map(b => (
                          <MonthBookingCard
                            key={b.id}
                            booking={b}
                            onOpen={() => { void openReminderPanel({ kind: 'booking', booking: b }); }}
                            onContext={(ev) => openEventMenu(ev, { kind: 'booking', booking: b })}
                          />
                        ))}
                        {overflow > 0 && <div className="text-xs font-medium text-slate-500 dark:text-slate-400 pl-1">+{overflow} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          ) : view === 'week' ? (
            /* ── WEEK VIEW ── */
            (() => {
              const startOfWeek = new Date(selectedDate + 'T12:00:00');
              startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
              const weekDays = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                return d;
              });
              const hourCount = CALENDAR_HOUR_END - CALENDAR_HOUR_START;
              const columnMinHeight = hourCount * 48;
              return (
                <div className="w-full overflow-x-auto">
                <div className="w-full min-w-[720px] bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-visible">
                  <div className="grid grid-cols-[4rem_repeat(7,1fr)] border-b border-slate-200 dark:border-slate-800">
                    <div className="border-r border-slate-100 dark:border-slate-800" />
                    {weekDays.map(d => {
                      const dk = toDateKey(d);
                      const isToday = dk === toDateKey(today);
                      return (
                        <div key={dk} className={`py-3 text-center border-r last:border-r-0 border-slate-100 dark:border-slate-800 ${isToday ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                          <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">{DAY_SHORT[d.getDay()]}</p>
                          <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-[#5864C6]' : 'text-slate-700 dark:text-slate-300'}`}>{d.getDate()}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-[4rem_repeat(7,1fr)] relative" style={{ minHeight: columnMinHeight }}>
                    <div className="border-r border-slate-100 dark:border-slate-800">
                      {Array.from({ length: hourCount }, (_, i) => CALENDAR_HOUR_START + i).map(h => (
                        <div key={h} className="h-12 text-sm text-slate-500 dark:text-slate-400 pr-2 text-right border-b border-slate-50 dark:border-slate-800/40 pt-1">
                          {formatHourLabel(h)}
                        </div>
                      ))}
                    </div>
                    {weekDays.map(d => {
                      const dk = toDateKey(d);
                      const dayBookings = grouped.get(dk) ?? [];
                      const dayExternal = externalEvents.filter(e => toDateKey(new Date(e.start_at)) === dk);
                      const isToday = dk === toDateKey(today);
                      return (
                        <div key={dk} className={`relative border-r last:border-r-0 border-slate-100 dark:border-slate-800/60 ${isToday ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''}`}
                          style={{ minHeight: columnMinHeight }}
                          onClick={() => { setSelectedDate(dk); setView('day'); }}>
                          {Array.from({ length: hourCount }, (_, i) => (
                            <div key={i} className="h-12 border-b border-slate-50 dark:border-slate-800/40" />
                          ))}
                          <div className="absolute inset-x-1 top-0 space-y-1 p-1 pointer-events-none">
                            {dayExternal.map(e => (
                              <div
                                key={e.id}
                                onClick={(ev) => { ev.stopPropagation(); void openReminderPanel({ kind: 'external', event: e }); }}
                                onContextMenu={(ev) => openEventMenu(ev, { kind: 'external', event: e })}
                                className="group relative z-0 hover:z-20 text-sm p-2 rounded-md shadow-sm bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 pointer-events-auto cursor-pointer"
                              >
                                <EventHoverHint />
                                <p className="font-semibold truncate">{e.title}</p>
                                <p className="text-xs mt-0.5">{e.all_day ? 'All day' : formatTime(e.start_at)}</p>
                              </div>
                            ))}
                            {dayBookings.map(b => (
                              <div key={b.id} className="pointer-events-auto">
                                <WeekBookingCard
                                  booking={b}
                                  onOpen={() => { void openReminderPanel({ kind: 'booking', booking: b }); }}
                                  onContext={(ev) => openEventMenu(ev, { kind: 'booking', booking: b })}
                                />
                              </div>
                            ))}
                          </div>
                          {isToday && <CurrentTimeLine />}
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
              );
            })()
          ) : view === 'day' ? (
            /* ── DAY VIEW ── */
            (() => {
              const dayBookings = (bookings).filter(b => toDateKey(new Date(b.start_time)) === selectedDate);
              const dayExternal = externalEvents.filter(e => toDateKey(new Date(e.start_at)) === selectedDate);
              const selectedDateObj = new Date(selectedDate + 'T12:00:00');
              const isToday = selectedDate === toDateKey(today);
              const hours = Array.from({ length: CALENDAR_HOUR_END - CALENDAR_HOUR_START + 1 }, (_, i) => CALENDAR_HOUR_START + i);
              return (
                <div className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-visible">
                  <div className={`px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between ${isToday ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate()-1); setSelectedDate(toDateKey(d)); }} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                      <span className={`text-base font-semibold ${isToday ? 'text-[#5864C6]' : 'text-slate-700 dark:text-slate-300'}`}>
                        {DAY_NAMES[selectedDateObj.getDay()]}, {MONTH_NAMES[selectedDateObj.getMonth()]} {selectedDateObj.getDate()}, {selectedDateObj.getFullYear()}
                        {isToday && <span className="ml-2 text-[#5864C6] font-normal">Today</span>}
                      </span>
                      <button onClick={() => { const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate()+1); setSelectedDate(toDateKey(d)); }} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <button onClick={() => { setShowAddEvent(true); }} className="flex items-center gap-1 text-sm text-[#5864C6] hover:opacity-80 transition-colors"><Plus className="h-4 w-4" />Add</button>
                  </div>
                  {dayBookings.length === 0 && dayExternal.length === 0 ? (
                    <div className="relative">
                      {hours.map(h => (
                        <div key={h} className="flex border-b border-slate-100 dark:border-slate-800/60 min-h-[60px]">
                          <div className="w-16 lg:w-20 shrink-0 text-sm text-slate-500 dark:text-slate-400 pr-3 pt-2 text-right border-r border-slate-100 dark:border-slate-800/60">{formatHourLabel(h)}</div>
                          <div className="flex-1" />
                        </div>
                      ))}
                      {isToday && (
                        <div className="absolute inset-0 left-16 lg:left-20 pointer-events-none">
                          <CurrentTimeLine />
                        </div>
                      )}
                      <div className="text-center py-12">
                        <CalendarDays className="h-8 w-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 dark:text-slate-500">No meetings this day.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      {hours.map(h => {
                        const hourBookings = dayBookings.filter(b => new Date(b.start_time).getHours() === h);
                        const hourExternal = dayExternal.filter(e => !e.all_day && new Date(e.start_at).getHours() === h);
                        const allDayExternal = h === CALENDAR_HOUR_START ? dayExternal.filter(e => e.all_day) : [];
                        return (
                          <div key={h} className="flex border-b border-slate-100 dark:border-slate-800/60 min-h-[60px]">
                            <div className="w-16 lg:w-20 shrink-0 text-sm text-slate-500 dark:text-slate-400 pr-3 pt-2 text-right border-r border-slate-100 dark:border-slate-800/60">{formatHourLabel(h)}</div>
                            <div className="flex-1 p-2 space-y-2">
                              {allDayExternal.map(e => (
                                <div
                                  key={e.id}
                                  onClick={() => { void openReminderPanel({ kind: 'external', event: e }); }}
                                  onContextMenu={(ev) => openEventMenu(ev, { kind: 'external', event: e })}
                                  className="group relative z-0 hover:z-20 text-sm p-2 rounded-lg shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <EventHoverHint />
                                  <p className="font-semibold">{e.title}</p>
                                  <p className="text-xs mt-0.5">All day</p>
                                </div>
                              ))}
                              {hourExternal.map(e => (
                                <div
                                  key={e.id}
                                  onClick={() => { void openReminderPanel({ kind: 'external', event: e }); }}
                                  onContextMenu={(ev) => openEventMenu(ev, { kind: 'external', event: e })}
                                  className="group relative z-0 hover:z-20 text-sm p-2 rounded-lg shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <EventHoverHint />
                                  <p className="font-semibold">{e.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{formatTime(e.start_at)} – {formatTime(e.end_at)}</p>
                                </div>
                              ))}
                              {hourBookings.map(b => {
                                const svc = (b as Booking & { services?: { name?: string; color?: string; location?: string; location_type?: string } }).services;
                                const LocIcon = getLocationIcon(svc?.location_type);
                                return (
                                  <div
                                    key={b.id}
                                    onClick={() => { void openReminderPanel({ kind: 'booking', booking: b }); }}
                                    onContextMenu={(ev) => openEventMenu(ev, { kind: 'booking', booking: b })}
                                    className="group relative z-0 hover:z-20 rounded-lg shadow-sm p-3 border border-slate-100 dark:border-slate-700 min-h-[56px] cursor-pointer"
                                    style={{ backgroundColor: `${svc?.color ?? '#5864C6'}12`, borderLeftColor: svc?.color ?? '#5864C6', borderLeftWidth: 4 }}
                                  >
                                    <EventHoverHint />
                                    <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: svc?.color ?? '#5864C6' }} />
                                      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{svc?.name ?? 'Appointment'}</p>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{b.guest_name}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{formatTime(b.start_time)} – {formatTime(b.end_time)}</p>
                                    {svc?.location && (
                                      <div className="flex items-center gap-1 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        <LocIcon className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{svc.location}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {isToday && (
                        <div className="absolute inset-0 left-16 lg:left-20 pointer-events-none">
                          <CurrentTimeLine />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ) : sortedDateKeys.length === 0 ? (
            <div className="text-center py-20">
              <CalendarDays className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No meetings on this calendar yet.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Share your booking link so clients can pick a time — they will show up here.</p>
              <Link to="/dashboard#share" className="inline-flex mt-4 text-sm font-semibold text-brand-600 hover:underline">Share your link →</Link>
            </div>
          ) : (
            /* ── AGENDA VIEW ── */
            <div className="space-y-0">
              {sortedDateKeys.map(dk => {
                const date = new Date(dk + 'T12:00:00');
                const isToday = dk === toDateKey(today);
                const dayBookings = grouped.get(dk) ?? [];
                const dayExternal = filteredExternal.filter(e => toDateKey(new Date(e.start_at)) === dk);
                return (
                  <div key={dk}>
                    {/* Date header */}
                    <div className={`flex items-center justify-between px-4 py-2 sticky top-14 md:top-0 z-10 ${
                      isToday
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-y border-indigo-100 dark:border-indigo-900/40'
                        : 'bg-slate-100 dark:bg-slate-800/60 border-y border-slate-200 dark:border-slate-700/50'
                    }`}>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${
                        isToday ? 'text-indigo-700 dark:text-indigo-500' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {DAY_NAMES[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
                        {isToday && <span className="ml-2 text-indigo-600">· Today</span>}
                      </span>
                      <button
                        onClick={() => { setSelectedDate(dk); setShowAddEvent(true); }}
                        className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors rounded"
                        title="Add event on this day"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {/* External calendar busy blocks */}
                      {dayExternal.map(e => (
                        <div
                          key={e.id}
                          onClick={() => { void openReminderPanel({ kind: 'external', event: e }); }}
                          onContextMenu={(ev) => openEventMenu(ev, { kind: 'external', event: e })}
                          className="group relative flex items-center gap-4 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/20 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/40"
                        >
                          <EventHoverHint />
                          <div className="pt-0.5 shrink-0">
                            <Lock className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                          </div>
                          <div className="w-28 shrink-0">
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {e.all_day ? 'All day' : `${formatTime(e.start_at)} – ${formatTime(e.end_at)}`}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${
                              e.provider === 'google' ? 'bg-red-400' :
                              e.provider === 'outlook' ? 'bg-brand-400' :
                              e.provider === 'personal' ? 'bg-amber-400' : 'bg-slate-400'
                            }`} />
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate italic">{e.title}</p>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full capitalize shrink-0">
                              {e.provider === 'personal' ? 'reminder' : e.provider}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* App bookings */}
                      {dayBookings.map(b => {
                        const svc = (b as any).services;
                        const LocIcon = getLocationIcon(svc?.location_type);
                        const isCanceled = b.status === 'canceled';
                        const isCompleted = b.status === 'completed';
                        const isTentative = b.status === 'tentative';
                        const isPendingApproval = b.status === 'pending_approval';
                        const isInactive = isCanceled || isCompleted;
                        return (
                          <div key={b.id}
                            onClick={() => { void openReminderPanel({ kind: 'booking', booking: b }); }}
                            onContextMenu={(ev) => openEventMenu(ev, { kind: 'booking', booking: b })}
                            className={`group relative flex items-start gap-4 px-4 py-3 bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${isInactive ? 'opacity-55' : ''}`}>
                            <EventHoverHint />
                            <div className="pt-0.5 shrink-0">
                              <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-all ${
                                isCompleted ? 'bg-indigo-600 border-indigo-600' :
                                isCanceled ? 'border-red-300 dark:border-red-700' :
                                isTentative ? 'border-amber-400 dark:border-amber-500' :
                                isPendingApproval ? 'border-orange-400 dark:border-orange-500' :
                                'border-slate-300 dark:border-slate-600'
                              }`}>
                                {isCompleted && <Check className="h-2.5 w-2.5 text-white" />}
                              </div>
                            </div>

                            <div className="w-28 shrink-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {formatTime(b.start_time)} – {formatTime(b.end_time)}
                              </p>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b.is_critical ? '#ef4444' : (svc?.color ?? '#5864C6') }} />
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                  {svc?.name ?? 'Appointment'}
                                </p>
                                {b.is_recurring && <Repeat className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-label="Recurring booking" />}
                                {b.is_critical && <span className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full font-semibold flex items-center gap-0.5"><BellRing className="h-3 w-3" />Critical</span>}
                                {isCanceled && <span className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full">Canceled</span>}
                                {isCompleted && <span className="text-xs px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full">Completed</span>}
                                {isTentative && <span className="text-xs px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full">Tentative</span>}
                                {isPendingApproval && <span className="text-xs px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full">Pending Approval</span>}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{b.guest_name} · {b.guest_email}</p>
                              {svc?.location && (
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                                  <LocIcon className="h-3 w-3" />
                                  <span className="truncate">{svc.location}</span>
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                              <Clock className="h-3 w-3" />
                              {svc?.duration_minutes ?? '?'}m
                            </div>

                            <button
                              onClick={(e) => { e.stopPropagation(); void openReminderPanel({ kind: 'booking', booking: b }); }}
                              className="shrink-0 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors rounded-lg px-1.5 py-1 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              title="Extra reminder — SMS, WhatsApp, or email"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleCritical(b); }}
                              className={`shrink-0 p-1.5 rounded transition-colors ${b.is_critical ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-300 dark:text-slate-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10'}`}
                              title={b.is_critical ? 'Remove critical alert' : 'Mark as critical — SMS & WhatsApp 1h + 15m, email 1 day + 4h (voice optional)'}
                            >
                              <BellRing className="h-3.5 w-3.5" />
                            </button>

                            {!isInactive && (
                              <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {(isTentative || isPendingApproval) && (
                                  <button onClick={() => handleApproveBooking(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-indigo-600 transition-colors rounded" title="Approve — confirm this booking">
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {!isTentative && !isPendingApproval && (
                                  <button onClick={() => handleMarkTentative(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-amber-500 transition-colors rounded" title="Mark as tentative">
                                    <Clock className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {!isTentative && !isPendingApproval && (
                                  <button onClick={() => handleCompleteBooking(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-indigo-600 transition-colors rounded" title="Mark complete">
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button onClick={() => handleCancelBooking(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors rounded" title="Cancel">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddEvent && (
        <AddEventModal
          services={services}
          defaultDate={selectedDate}
          onClose={() => setShowAddEvent(false)}
          onSaved={loadData}
        />
      )}

      {showReminderHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={dismissReminderHint}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#5864C61A' }}>
                  <BellRing className="h-5 w-5" style={{ color: '#5864C6' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick reminders</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Click on any event to add a quick reminder.
                  </p>
                </div>
              </div>
              <button onClick={dismissReminderHint} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <button
                type="button"
                onClick={dismissReminderHint}
                className="w-full py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:opacity-90"
                style={{ backgroundColor: '#5864C6' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {showCalendarConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowCalendarConnect(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add or Connect Calendars</h2>
              <button onClick={() => setShowCalendarConnect(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <CalendarConnections />
            </div>
          </div>
        </div>
      )}

      {/* Reminder override panel */}
      {reminderTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setReminderTarget(null)}>
          <div
            className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Event reminders</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {reminderTarget.kind === 'booking'
                    ? `${(reminderTarget.booking as Booking & { services?: { name?: string } }).services?.name ?? 'Meeting'} · ${reminderTarget.booking.guest_name} · ${formatTime(reminderTarget.booking.start_time)}`
                    : `${reminderTarget.event.title} · ${reminderTarget.event.all_day ? 'All day' : formatTime(reminderTarget.event.start_at)}`}
                </p>
              </div>
              <button onClick={() => setReminderTarget(null)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {reminderTarget.kind === 'booking' ? (
                <BookingAlsoRemindPicker
                  bookingId={reminderTarget.booking.id}
                  serviceId={reminderTarget.booking.service_id}
                  alsoRemindIds={parseAlsoRemindIds(reminderTarget.booking.also_remind_ids)}
                  onSaved={(ids) => {
                    setBookings((prev) =>
                      prev.map((b) => (b.id === reminderTarget.booking.id ? { ...b, also_remind_ids: ids } : b)),
                    );
                    setReminderTarget((t) =>
                      t?.kind === 'booking' && t.booking.id === reminderTarget.booking.id
                        ? { ...t, booking: { ...t.booking, also_remind_ids: ids } }
                        : t,
                    );
                  }}
                />
              ) : (
                <BookingAlsoRemindPicker
                  calendarEventId={reminderTarget.event.id}
                  alsoRemindIds={parseAlsoRemindIds(reminderTarget.event.also_remind_ids)}
                  onSaved={(ids) => {
                    setExternalEvents((prev) =>
                      prev.map((e) => (e.id === reminderTarget.event.id ? { ...e, also_remind_ids: ids } : e)),
                    );
                    setReminderTarget((t) =>
                      t?.kind === 'external' && t.event.id === reminderTarget.event.id
                        ? { ...t, event: { ...t.event, also_remind_ids: ids } }
                        : t,
                    );
                  }}
                />
              )}

              {/* Info */}
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
                {reminderTarget.kind === 'external' ? (
                  <>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">When should reminders go out?</p>
                    Add a time below (e.g. 1 hour before). Checked coworkers get a copy at that time — email, SMS, or WhatsApp per their roster settings.
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Optional: extra one-off reminder</p>
                    PinOnIt already sends your normal guest reminders for this booking. Add another timing here if you want one more nudge. Checked coworkers get a copy too.
                  </>
                )}
              </div>

              {/* Existing overrides */}
              {loadingOverrides ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : reminderOverrides.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">No custom reminders for this event yet.</p>
              ) : (
                <div className="space-y-2">
                  {reminderOverrides.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <Bell className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">
                          {r.channel} — {Math.abs(r.offset_minutes) >= 60
                            ? `${Math.abs(r.offset_minutes) / 60}h`
                            : `${Math.abs(r.offset_minutes)}m`} before
                        </p>
                        {r.message && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{r.message}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteOverride(r.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new override */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Add custom reminder</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Channel</label>
                    <select
                      value={newReminderChannel}
                      onChange={e => setNewReminderChannel(e.target.value as ReminderChannel)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">How far before</label>
                    <select
                      value={newReminderOffset}
                      onChange={e => setNewReminderOffset(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                    >
                      <option value={-15}>15 min before</option>
                      <option value={-30}>30 min before</option>
                      <option value={-60}>1 hour before</option>
                      <option value={-120}>2 hours before</option>
                      <option value={-240}>4 hours before</option>
                      <option value={-480}>8 hours before</option>
                      <option value={-1440}>1 day before</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Custom message (optional)</label>
                  <textarea
                    value={newReminderMsg}
                    onChange={e => setNewReminderMsg(e.target.value)}
                    rows={2}
                    placeholder="Leave blank to use your default reminder template"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition resize-none"
                  />
                </div>
                <button
                  onClick={handleAddOverride}
                  disabled={savingOverride}
                  className="w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
                >
                  {savingOverride ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  Add Reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetailBooking(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Repeat className="h-5 w-5 text-slate-500" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recurring booking</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Recurring — {(detailBooking as Booking & { services?: Service }).services?.name ?? 'Appointment'}{' '}
                  {detailBooking.recurrence_frequency ? formatRecurrenceHostLabel(detailBooking.recurrence_frequency) : ''}
                </p>
              </div>
              <button onClick={() => setDetailBooking(null)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p><strong>{detailBooking.guest_name}</strong> · {detailBooking.guest_email}</p>
              <p>{new Date(detailBooking.start_time).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              {detailBooking.guest_address && (
                <p className="flex items-start gap-1.5 pt-1">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                  <span className="whitespace-pre-wrap">{detailBooking.guest_address}</span>
                </p>
              )}
            </div>
            {detailBooking.status !== 'canceled' && (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => handleCancelRecurringOccurrence(detailBooking)}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Cancel this occurrence only
                </button>
                <button onClick={() => handleCancelAllFutureRecurring(detailBooking)}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                  Cancel all future occurrences
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {eventMenu && (
        <div
          className="fixed z-[60] min-w-[200px] py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-sm"
          style={{ left: Math.min(eventMenu.x, window.innerWidth - 240), top: Math.min(eventMenu.y, window.innerHeight - 320) }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Extra reminder · 1h before</p>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => { void quickAddReminder(eventMenu.target, 'email'); }}
          >
            <Mail className="h-4 w-4 text-slate-400" /> Email
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => { void quickAddReminder(eventMenu.target, 'sms'); }}
          >
            <Phone className="h-4 w-4 text-slate-400" /> SMS
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => { void quickAddReminder(eventMenu.target, 'whatsapp'); }}
          >
            <MessageSquare className="h-4 w-4 text-slate-400" /> WhatsApp
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => { void openReminderPanel(eventMenu.target); }}
          >
            <Bell className="h-4 w-4 text-slate-400" /> Customize…
          </button>
          {eventMenu.target.kind === 'booking' && eventMenu.target.booking.guest_email && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  if (eventMenu.target.kind !== 'booking') return;
                  void blockGuestFromBooking(eventMenu.target.booking, 'blocked');
                }}
              >
                <Ban className="h-4 w-4 text-slate-400" /> Block this email
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  if (eventMenu.target.kind !== 'booking') return;
                  void blockGuestFromBooking(eventMenu.target.booking, 'blocked', 'domain');
                }}
              >
                <Globe className="h-4 w-4 text-slate-400" /> Block this domain
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  if (eventMenu.target.kind !== 'booking') return;
                  void blockGuestFromBooking(eventMenu.target.booking, 'spam');
                }}
              >
                <Flag className="h-4 w-4 text-slate-400" /> Mark as spam
              </button>
            </>
          )}
          {eventMenu.target.kind === 'booking' && eventMenu.target.booking.is_recurring && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                if (eventMenu.target.kind === 'booking') setDetailBooking(eventMenu.target.booking);
                setEventMenu(null);
              }}
            >
              <Repeat className="h-4 w-4 text-slate-400" /> Recurring options
            </button>
          )}
        </div>
      )}
    </main>
  );
}
