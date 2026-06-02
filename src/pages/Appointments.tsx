import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Booking, Service } from '../lib/types';
import { formatRecurrenceHostLabel, getSeriesRootId } from '../lib/recurring';
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

    const { error: err } = await supabase.from('bookings').insert({
      host_id: profile.id,
      service_id: serviceId || null,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      status: 'confirmed',
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
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
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Guest Email</label>
              <input
                type="email"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Service</label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
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
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>
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

type ViewMode = 'agenda' | 'month' | 'week' | 'day';

// ── Page ──────────────────────────────────────────────────────────────────────

interface ReminderOverride {
  id: string;
  booking_id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  offset_minutes: number;
  message: string;
}

export function AppointmentsPage() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('month');
  const [search, setSearch] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showCalendarConnect, setShowCalendarConnect] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  // Reminder override panel
  const [reminderBooking, setReminderBooking] = useState<Booking | null>(null);
  const [reminderOverrides, setReminderOverrides] = useState<ReminderOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [newReminderChannel, setNewReminderChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [newReminderOffset, setNewReminderOffset] = useState(-60);
  const [newReminderMsg, setNewReminderMsg] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
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
    const [bookRes, svcRes, extEvtRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, services(name, color, duration_minutes, location_type, location)')
        .eq('host_id', profile.id)
        .order('start_time', { ascending: true }),
      supabase.from('services').select('*').eq('host_id', profile.id),
      supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at, all_day, connected_calendars(provider)')
        .eq('host_id', profile.id)
        .order('start_at', { ascending: true }),
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
    }));
    setExternalEvents(evts);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [profile]);

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
        b.guest_email.toLowerCase().includes(q) ||
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

  const openReminderPanel = async (booking: Booking) => {
    setReminderBooking(booking);
    setLoadingOverrides(true);
    const { data } = await supabase
      .from('event_reminder_overrides')
      .select('*')
      .eq('booking_id', booking.id)
      .order('offset_minutes');
    setReminderOverrides((data ?? []) as ReminderOverride[]);
    setLoadingOverrides(false);
  };

  const handleAddOverride = async () => {
    if (!profile || !reminderBooking) return;
    setSavingOverride(true);
    const { data } = await supabase.from('event_reminder_overrides').insert({
      booking_id: reminderBooking.id,
      host_id: profile.id,
      channel: newReminderChannel,
      offset_minutes: newReminderOffset,
      message: newReminderMsg.trim(),
    }).select().maybeSingle();
    if (data) setReminderOverrides(prev => [...prev, data as ReminderOverride]);
    setNewReminderMsg('');
    setSavingOverride(false);
  };

  const handleDeleteOverride = async (id: string) => {
    await supabase.from('event_reminder_overrides').delete().eq('id', id);
    setReminderOverrides(prev => prev.filter(r => r.id !== id));
  };

  const handleCancelBooking = async (id: string) => {
    await supabase.from('bookings').update({ status: 'canceled' }).eq('id', id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'canceled' as const } : b));
    if (detailBooking?.id === id) setDetailBooking(null);
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
        <div className="flex items-center gap-2 flex-wrap">
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
                      isSelected ? 'bg-emerald-600 text-white' :
                      isToday ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold' :
                      'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {d}
                    {hasBooking && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick links */}
          <div className="text-xs text-slate-500 dark:text-slate-400 space-x-2 flex flex-wrap gap-1">
            <button onClick={() => { setSelectedDate(toDateKey(today)); setAgendaAnchor('future'); }} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">today</button>
            <span>|</span>
            <button onClick={() => {
              const t = new Date(today); t.setDate(t.getDate() + 1);
              setSelectedDate(toDateKey(t)); setAgendaAnchor('future');
            }} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">tomorrow</button>
            <span>|</span>
            <button onClick={() => setAgendaAnchor('future')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">upcoming</button>
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
                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : view === 'month' ? (
            /* ── MONTH VIEW ── */
            <div className="overflow-x-auto -mx-2 sm:mx-0">
            <div className="min-w-[320px] bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
                {DAY_SHORT.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="min-h-[90px] border-b border-r border-slate-100 dark:border-slate-800/60" />;
                  const dk = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const isToday = dk === toDateKey(today);
                  const dayBookings = grouped.get(dk) ?? [];
                  const dayExternal = externalEvents.filter(e => toDateKey(new Date(e.start_at)) === dk);
                  // Combine both sources for display, cap at 3 total visible rows
                  const totalCount = dayBookings.length + dayExternal.length;
                  const slotsLeft = 3;
                  const externalToShow = dayExternal.slice(0, slotsLeft);
                  const bookingsToShow = dayBookings.slice(0, Math.max(0, slotsLeft - externalToShow.length));
                  const overflow = totalCount - externalToShow.length - bookingsToShow.length;
                  return (
                    <div key={dk}
                      onClick={() => { setSelectedDate(dk); setView('day'); }}
                      className={`min-h-[90px] border-b border-r border-slate-100 dark:border-slate-800/60 p-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isToday ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}>
                      <span className={`text-xs font-semibold inline-flex h-5 w-5 items-center justify-center rounded-full ${isToday ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{d}</span>
                      <div className="mt-1 space-y-0.5">
                        {externalToShow.map(e => (
                          <div key={e.id} className="text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${e.provider === 'google' ? 'bg-red-400' : e.provider === 'outlook' ? 'bg-blue-400' : 'bg-slate-400'}`} />
                            <span className="truncate">{e.all_day ? e.title : `${formatTime(e.start_at)} ${e.title}`}</span>
                          </div>
                        ))}
                        {bookingsToShow.map(b => (
                          <div key={b.id} className="text-[10px] px-1 py-0.5 rounded truncate text-white flex items-center gap-0.5" style={{ backgroundColor: b.is_critical ? '#ef4444' : ((b as any).services?.color ?? '#5864C6') }}>
                            {b.is_critical && <span className="shrink-0">⚠</span>}
                            <span className="truncate">{formatTime(b.start_time)} {b.guest_name}</span>
                          </div>
                        ))}
                        {overflow > 0 && <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">+{overflow} more</div>}
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
              const startOfWeek = new Date(today);
              startOfWeek.setDate(today.getDate() - today.getDay());
              const weekDays = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                return d;
              });
              return (
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="min-w-[420px] bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
                    {weekDays.map(d => {
                      const dk = toDateKey(d);
                      const isToday = dk === toDateKey(today);
                      return (
                        <div key={dk} className={`py-3 text-center border-r last:border-r-0 border-slate-100 dark:border-slate-800 ${isToday ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">{DAY_SHORT[d.getDay()]}</p>
                          <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{d.getDate()}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-7 min-h-[300px]">
                    {weekDays.map(d => {
                      const dk = toDateKey(d);
                      const dayBookings = grouped.get(dk) ?? [];
                      const dayExternal = externalEvents.filter(e => toDateKey(new Date(e.start_at)) === dk);
                      const isToday = dk === toDateKey(today);
                      const isEmpty = dayBookings.length === 0 && dayExternal.length === 0;
                      return (
                        <div key={dk} className={`border-r last:border-r-0 border-slate-100 dark:border-slate-800/60 p-1.5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${isToday ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''}`}
                          onClick={() => { setSelectedDate(dk); setView('day'); }}>
                          {isEmpty ? (
                            <p className="text-[10px] text-slate-300 dark:text-slate-700 text-center mt-4">—</p>
                          ) : (
                            <div className="space-y-0.5">
                              {dayExternal.slice(0, 3).map(e => (
                                <div key={e.id} className="text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${e.provider === 'google' ? 'bg-red-400' : e.provider === 'outlook' ? 'bg-blue-400' : 'bg-slate-400'}`} />
                                  <span className="truncate">{e.all_day ? e.title : `${formatTime(e.start_at)} ${e.title}`}</span>
                                </div>
                              ))}
                              {dayBookings.map(b => (
                                <div key={b.id} className="text-[10px] px-1 py-0.5 rounded truncate text-white flex items-center gap-0.5" style={{ backgroundColor: b.is_critical ? '#ef4444' : ((b as any).services?.color ?? '#5864C6') }}>
                                  {b.is_critical && <span className="shrink-0">⚠</span>}
                                  <span className="truncate">{formatTime(b.start_time)} {b.guest_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
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
              return (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className={`px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between ${isToday ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate()-1); setSelectedDate(toDateKey(d)); }} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                      <span className={`text-sm font-semibold ${isToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {DAY_NAMES[selectedDateObj.getDay()]}, {MONTH_NAMES[selectedDateObj.getMonth()]} {selectedDateObj.getDate()}, {selectedDateObj.getFullYear()}
                        {isToday && <span className="ml-2 text-emerald-500 font-normal">Today</span>}
                      </span>
                      <button onClick={() => { const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate()+1); setSelectedDate(toDateKey(d)); }} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <button onClick={() => { setShowAddEvent(true); }} className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors"><Plus className="h-3.5 w-3.5" />Add</button>
                  </div>
                  {dayBookings.length === 0 && dayExternal.length === 0 ? (
                    <div className="text-center py-16">
                      <CalendarDays className="h-8 w-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">No meetings this day.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {dayExternal.map(e => (
                        <div key={e.id} className="flex items-center gap-4 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/20">
                          <Lock className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                          <p className="text-xs text-slate-400 dark:text-slate-500 w-28 shrink-0">{e.all_day ? 'All day' : `${formatTime(e.start_at)} – ${formatTime(e.end_at)}`}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate italic flex-1">{e.title}</p>
                        </div>
                      ))}
                      {dayBookings.map(b => {
                        const svc = (b as any).services;
                        const LocIcon = getLocationIcon(svc?.location_type);
                        const isCanceled = b.status === 'canceled';
                        const isCompleted = b.status === 'completed';
                        const isTentative = b.status === 'tentative';
                        const isPendingApproval = b.status === 'pending_approval';
                        const isInactive = isCanceled || isCompleted;
                        return (
                          <div key={b.id} onClick={() => b.is_recurring && setDetailBooking(b)}
                            className={`flex items-start gap-4 px-4 py-3 ${isInactive ? 'opacity-55' : ''} ${b.is_recurring ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''}`}>
                            <div className="w-28 shrink-0"><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatTime(b.start_time)} – {formatTime(b.end_time)}</p></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: svc?.color ?? '#5864C6' }} /><p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{svc?.name ?? 'Appointment'}</p>
                                {b.is_recurring && <span title="Recurring booking"><Repeat className="h-3.5 w-3.5 text-slate-400" /></span>}
                                {b.is_critical && <span className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full font-semibold flex items-center gap-0.5"><BellRing className="h-3 w-3" />Critical</span>}
                                {isTentative && <span className="text-xs px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full">Tentative</span>}
                                {isPendingApproval && <span className="text-xs px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full">Pending</span>}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{b.guest_name} · {b.guest_email}</p>
                              {svc?.location && <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400"><LocIcon className="h-3 w-3" /><span className="truncate">{svc.location}</span></div>}
                            </div>
                            <button
                              onClick={() => handleToggleCritical(b)}
                              className={`shrink-0 p-1.5 rounded transition-colors ${b.is_critical ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-300 dark:text-slate-600 hover:text-red-400'}`}
                              title={b.is_critical ? 'Remove critical alert' : 'Mark as critical meeting'}
                            >
                              <BellRing className="h-3.5 w-3.5" />
                            </button>
                            {!isInactive && (
                              <div className="shrink-0 flex items-center gap-1">
                                {(isTentative || isPendingApproval) && (
                                  <button onClick={() => handleApproveBooking(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition-colors rounded" title="Approve"><Check className="h-3.5 w-3.5" /></button>
                                )}
                                {!isTentative && !isPendingApproval && (
                                  <button onClick={() => handleCompleteBooking(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition-colors rounded" title="Mark complete"><Check className="h-3.5 w-3.5" /></button>
                                )}
                                <button onClick={() => handleCancelBooking(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors rounded" title="Cancel"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          ) : sortedDateKeys.length === 0 ? (
            <div className="text-center py-20">
              <CalendarDays className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No meetings found.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Meetings scheduled through your page will appear here.</p>
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
                    <div className={`flex items-center justify-between px-4 py-2 sticky top-0 z-10 ${
                      isToday
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-y border-emerald-100 dark:border-emerald-900/40'
                        : 'bg-slate-100 dark:bg-slate-800/60 border-y border-slate-200 dark:border-slate-700/50'
                    }`}>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${
                        isToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {DAY_NAMES[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
                        {isToday && <span className="ml-2 text-emerald-500">· Today</span>}
                      </span>
                      <button
                        onClick={() => { setSelectedDate(dk); setShowAddEvent(true); }}
                        className="p-0.5 text-slate-400 hover:text-emerald-600 transition-colors rounded"
                        title="Add event on this day"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {/* External calendar busy blocks */}
                      {dayExternal.map(e => (
                        <div key={e.id} className="flex items-center gap-4 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/20">
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
                              e.provider === 'outlook' ? 'bg-brand-400' : 'bg-slate-400'
                            }`} />
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate italic">{e.title}</p>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full capitalize shrink-0">
                              {e.provider}
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
                          <div key={b.id} onClick={() => b.is_recurring && setDetailBooking(b)}
                            className={`flex items-start gap-4 px-4 py-3 bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isInactive ? 'opacity-55' : ''} ${b.is_recurring ? 'cursor-pointer' : ''}`}>
                            <div className="pt-0.5 shrink-0">
                              <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-all ${
                                isCompleted ? 'bg-emerald-500 border-emerald-500' :
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
                                {b.is_recurring && <Repeat className="h-3.5 w-3.5 text-slate-400 shrink-0" title="Recurring booking" />}
                                {b.is_critical && <span className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full font-semibold flex items-center gap-0.5"><BellRing className="h-3 w-3" />Critical</span>}
                                {isCanceled && <span className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full">Canceled</span>}
                                {isCompleted && <span className="text-xs px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full">Completed</span>}
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
                              onClick={() => openReminderPanel(b)}
                              className="shrink-0 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors rounded-lg px-1.5 py-1 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              title="Reminders for this event"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => handleToggleCritical(b)}
                              className={`shrink-0 p-1.5 rounded transition-colors ${b.is_critical ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-300 dark:text-slate-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10'}`}
                              title={b.is_critical ? 'Remove critical alert' : 'Mark as critical — sends SMS to you 5 and 1 min before'}
                            >
                              <BellRing className="h-3.5 w-3.5" />
                            </button>

                            {!isInactive && (
                              <div className="shrink-0 flex items-center gap-1">
                                {(isTentative || isPendingApproval) && (
                                  <button onClick={() => handleApproveBooking(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition-colors rounded" title="Approve — confirm this booking">
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {!isTentative && !isPendingApproval && (
                                  <button onClick={() => handleMarkTentative(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-amber-500 transition-colors rounded" title="Mark as tentative">
                                    <Clock className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {!isTentative && !isPendingApproval && (
                                  <button onClick={() => handleCompleteBooking(b.id)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition-colors rounded" title="Mark complete">
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
      {reminderBooking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setReminderBooking(null)}>
          <div
            className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Reminders for this event</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {(reminderBooking as any).services?.name ?? 'Meeting'} · {reminderBooking.guest_name} · {formatTime(reminderBooking.start_time)}
                </p>
              </div>
              <button onClick={() => setReminderBooking(null)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Info */}
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2.5">
                These reminders are specific to this event only and override the default reminder settings.
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
                      onChange={e => setNewReminderChannel(e.target.value as 'email' | 'sms' | 'whatsapp')}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
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
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
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
    </main>
  );
}
