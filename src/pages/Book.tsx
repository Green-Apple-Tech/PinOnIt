import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Profile, Service, AvailabilitySlot, Booking, BookingQuestion, DateOverride, PaidBookingSettings, CalendarConflictSettings } from '../lib/types';
import { LOCATION_TYPES, TIMEZONES, DEFAULT_CALENDAR_CONFLICT_SETTINGS } from '../lib/types';
import {
  addRecurrence,
  countRecurringSeriesOnSlot,
  formatRecurrenceBadge,
  formatRecurrencePeriod,
  getRecurrenceEndType,
  getUpcomingRecurrenceDates,
  shouldStopRecurrence,
} from '../lib/recurring';
import { PHONE_PLACEHOLDER, PHONE_HINT, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { SmsBookingConsentCheckbox } from '../components/SmsConsentText';
import {
  buildNotifyViaPayload,
  resolveBookingSmsConsent,
  shouldRecordSmsOptIn,
} from '../lib/bookingSmsConsent';
import { resolveTermsText } from '../lib/terms';
import { stripePromise } from '../lib/stripe';
import { StripeBookingCheckout } from '../components/StripeBookingCheckout';
import {
  Calendar,
  Clock,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  User,
  Mail,
  Globe,
  ChevronLeft,
  ChevronRight,
  Phone,
  Video,
  AlertCircle,
  Bell,
  MessageSquare,
  MessageCircle,
  Shield,
  Zap,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

const REMINDER_CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'voice', label: 'Voice Call', icon: Phone },
] as const;

const REMINDER_TIMES = [
  { id: '15min', label: '15 min before' },
  { id: '30min', label: '30 min before' },
  { id: '1hour', label: '1 hour before' },
  { id: '2hour', label: '2 hours before' },
  { id: '6hour', label: '6 hours before' },
  { id: '24hour', label: '24 hours before' },
] as const;

function reminderChannelLabel(id: string): string {
  return REMINDER_CHANNELS.find((c) => c.id === id)?.label ?? id;
}

function reminderTimeLabel(id: string): string {
  return REMINDER_TIMES.find((t) => t.id === id)?.label ?? id;
}

type BookPaymentMethod = 'stripe' | 'venmo' | 'paypal' | 'cashapp' | 'zelle' | 'skip';

interface BookPaymentOption {
  id: BookPaymentMethod;
  label: string;
  subtitle: string;
  url?: string;
  panelBg: string;
  panelText: string;
}

export interface ServicePaymentHandles {
  paypal_handle: string;
  venmo_handle: string;
  cashapp_handle: string;
  zelle_handle: string;
}

function getServicePaymentHandles(svc: Service): ServicePaymentHandles {
  const ext = svc as Service & {
    paypal_me_link?: string | null;
    cashapp_tag?: string | null;
    zelle_contact?: string | null;
  };
  return {
    paypal_handle: (ext.paypal_handle ?? ext.paypal_me_link ?? '').trim(),
    venmo_handle: (ext.venmo_handle ?? '').trim().replace(/^@/, ''),
    cashapp_handle: (ext.cashapp_handle ?? ext.cashapp_tag ?? '').trim().replace(/^\$/, ''),
    zelle_handle: (ext.zelle_handle ?? ext.zelle_contact ?? '').trim(),
  };
}

function hasAnyPaymentHandle(handles: ServicePaymentHandles): boolean {
  return !!(handles.paypal_handle || handles.venmo_handle || handles.cashapp_handle || handles.zelle_handle);
}

const SERVICE_SELECT = '*';

function buildPaymentOptions(svc: Service, stripeAvailable: boolean): BookPaymentOption[] {
  const handles = getServicePaymentHandles(svc);
  const extended = svc as Service & { paypal_currency?: string };
  const amount = (svc.price_cents / 100).toFixed(2);
  const currency = extended.paypal_currency ?? 'USD';
  const opts: BookPaymentOption[] = [];

  opts.push({
    id: 'stripe',
    label: 'Card',
    subtitle: stripeAvailable ? 'Pay with Stripe' : 'Card payment (contact host if unavailable)',
    panelBg: 'bg-slate-50 dark:bg-slate-800/50',
    panelText: 'text-slate-700 dark:text-slate-300',
  });

  if (handles.paypal_handle) {
    const base = handles.paypal_handle.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^paypal\.me\//, 'paypal.me/');
    const paypalPath = base.startsWith('paypal.me/') ? base : `paypal.me/${base}`;
    const url = `https://${paypalPath}/${amount}${currency !== 'USD' ? `?country.x=${currency}&locale.x=en_${currency.slice(0, 2).toUpperCase()}` : ''}`;
    opts.push({
      id: 'paypal',
      label: 'PayPal',
      subtitle: handles.paypal_handle,
      url,
      panelBg: 'bg-blue-50 dark:bg-blue-950/30',
      panelText: 'text-blue-700 dark:text-blue-300',
    });
  }

  if (handles.venmo_handle) {
    opts.push({
      id: 'venmo',
      label: 'Venmo',
      subtitle: formatVenmoDisplay(handles.venmo_handle),
      url: `https://venmo.com/${handles.venmo_handle}?txn=pay&amount=${amount}&note=${encodeURIComponent(svc.name)}`,
      panelBg: 'bg-blue-50 dark:bg-blue-950/30',
      panelText: 'text-blue-700 dark:text-blue-300',
    });
  }

  if (handles.cashapp_handle) {
    opts.push({
      id: 'cashapp',
      label: 'Cash App',
      subtitle: formatCashappDisplay(handles.cashapp_handle),
      url: `https://cash.app/${handles.cashapp_handle}/${amount}`,
      panelBg: 'bg-green-50 dark:bg-green-950/30',
      panelText: 'text-green-700 dark:text-green-300',
    });
  }

  if (handles.zelle_handle) {
    opts.push({
      id: 'zelle',
      label: 'Zelle',
      subtitle: handles.zelle_handle,
      url: 'https://www.zellepay.com/',
      panelBg: 'bg-purple-50 dark:bg-purple-950/30',
      panelText: 'text-purple-700 dark:text-purple-300',
    });
  }

  opts.push({
    id: 'skip',
    label: 'Skip',
    subtitle: 'Pay later — arrange with your host',
    panelBg: 'bg-slate-50 dark:bg-slate-800/50',
    panelText: 'text-slate-600 dark:text-slate-400',
  });

  return opts;
}

function formatVenmoDisplay(handle: string): string {
  return `@${handle.replace(/^@/, '')}`;
}

function formatCashappDisplay(tag: string): string {
  return `$${tag.replace(/^\$/, '')}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const BOOKING_NAVY = '#1a1f36';

function formatTimezoneDisplay(tz: string): string {
  try {
    const time = new Date().toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase();
    const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? tz.replace(/_/g, ' ');
    return `${name} (${time})`;
  } catch {
    return tz.replace(/_/g, ' ');
  }
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function formatSelectedDateLabel(dateKey: string): string {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getLocationIcon(type: Service['location_type']) {
  switch (type) {
    case 'video': return Video;
    case 'phone': return Phone;
    case 'in_person': return MapPin;
    default: return Globe;
  }
}

interface BusyPeriod { start: Date; end: Date }

interface CalendarEvent {
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

const BLOCKING_TITLE_KEYWORDS = [
  "vacation", "pto", "out of office", "ooo", "leave", "sick day", "sick leave",
  "annual leave", "personal day", "time off", "parental leave",
];

function titleIndicatesBlocking(title: string): boolean {
  const t = (title ?? "").toLowerCase();
  return BLOCKING_TITLE_KEYWORDS.some((kw) => t.includes(kw));
}

/**
 * Decides whether a synced calendar event should block a booking slot.
 * Returns true = block this time, false = ignore it.
 */
function shouldBlockCalendarEvent(
  e: CalendarEvent,
  settings: CalendarConflictSettings,
): boolean {
  // Always ignore cancelled events (shouldn't be synced, but defensive)
  if (e.show_status === "cancelled") return false;

  // iCal TRANSP:TRANSPARENT / Google transparency=transparent → explicitly free
  // UNLESS it's an OOF or the title says vacation/PTO
  const isExplicitlyFree = e.transparency === "transparent" || e.show_status === "free";
  const isOOF = e.show_status === "oof";
  const isTentative = e.show_status === "tentative";
  const isDeclined = e.attendee_self_status === "declined";
  const isBirthdayOrHoliday = e.is_birthday_cal || e.is_holiday_cal;

  // Declined events
  if (isDeclined) {
    return settings.block_declined;
  }

  // Tentative events
  if (isTentative) {
    return settings.block_tentative;
  }

  // All-day events
  if (e.all_day) {
    // OOF all-day always blocks (regardless of settings) — it's always truly unavailable
    if (isOOF) return true;

    // Title-keyed blocking (Vacation, PTO, etc.) always blocks
    if (titleIndicatesBlocking(e.title)) return true;

    // Birthday/holiday calendar events
    if (isBirthdayOrHoliday) {
      return settings.block_free_all_day;
    }

    // Free all-day (e.g. public holidays not in a holidays cal, reminders)
    if (isExplicitlyFree) {
      return settings.block_free_all_day;
    }

    // Busy all-day (vacation, PTO, generic blocked day)
    return settings.block_all_day_busy;
  }

  // Timed (non-all-day) events: explicitly free = never block
  if (isExplicitlyFree && !isOOF) return false;

  // All other timed events are busy — block
  return true;
}

function buildSlots(availability: AvailabilitySlot[], existingBookings: Booking[], service: Service, dateOverrides: DateOverride[], year: number, month: number, busyTimes: BusyPeriod[] = []): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const now = new Date();
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

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dk = toDateKey(date);
    if (date < now || date > windowEnd) continue;

    const override = overrideMap.get(dk);
    if (override?.is_blocked) continue;

    let windows: { start: string; end: string }[] = [];
    if (override && !override.is_blocked && override.start_time && override.end_time) {
      windows = [{ start: override.start_time, end: override.end_time }];
    } else {
      const daySlots = availByDay.get(date.getDay()) ?? [];
      windows = daySlots.map((s) => ({ start: s.start_time, end: s.end_time }));
    }
    if (!windows.length) continue;

    const bookingsOnDay = existingBookings.filter((b) => toDateKey(new Date(b.start_time)) === dk);
    if (service.max_bookings_per_day !== null && bookingsOnDay.length >= service.max_bookings_per_day) continue;

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
        const slotKey = `${String(slotH).padStart(2,'0')}:${String(slotM).padStart(2,'0')}`;
        const slotStart = new Date(year, month, d, slotH, slotM);
        const slotEnd = new Date(slotStart.getTime() + (service.duration_minutes + service.buffer_after_minutes) * 60000);
        const blockStart = new Date(slotStart.getTime() - service.buffer_before_minutes * 60000);
        if (slotStart < minNotice) { cur += increment; continue; }
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
  }
  return result;
}

function ReminderWizard({
  accentColor,
  selectedChannels,
  setSelectedChannels,
  selectedTimes,
  setSelectedTimes,
  saving,
  onBack,
  onSave,
  guestPhone,
  smsOptIn,
  setSmsOptIn,
  whatsappOptIn,
  setWhatsappOptIn,
}: {
  accentColor: string;
  selectedChannels: string[];
  setSelectedChannels: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTimes: string[];
  setSelectedTimes: React.Dispatch<React.SetStateAction<string[]>>;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  hostName?: string;
  guestPhone?: string;
  smsOptIn: boolean;
  setSmsOptIn: React.Dispatch<React.SetStateAction<boolean>>;
  whatsappOptIn: boolean;
  setWhatsappOptIn: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((c) => c !== id) : prev) : [...prev, id]
    );
  };

  const toggleTime = (id: string) => {
    setSelectedTimes((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((t) => t !== id) : prev) : [...prev, id]
    );
  };

  const { smsConsentGranted, whatsappConsentGranted } = resolveBookingSmsConsent(
    guestPhone ?? '',
    smsOptIn,
    whatsappOptIn,
  );
  const canSave =
    selectedChannels.length > 0 &&
    selectedTimes.length > 0 &&
    (!selectedChannels.includes('sms') || smsConsentGranted) &&
    (!selectedChannels.includes('whatsapp') || whatsappConsentGranted);

  return (
    <div className="py-8 max-w-md mx-auto">
      <div className="mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-sm transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to confirmation
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-5 w-5" style={{ color: accentColor }} />
          <h2 className="text-xl font-bold">Add more reminders</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Choose how and when you'd like to be reminded about your appointment.</p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Remind me via</p>
        <div className="grid grid-cols-2 gap-2">
          {REMINDER_CHANNELS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleChannel(id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedChannels.includes(id)
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                selectedChannels.includes(id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 dark:border-slate-500'
              }`}>
                {selectedChannels.includes(id) && <Check className="h-3 w-3 text-white" />}
              </div>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
        {(selectedChannels.includes('sms') || selectedChannels.includes('whatsapp')) && (
          <div className="mt-3 space-y-2">
            {selectedChannels.includes('sms') && (
              <SmsBookingConsentCheckbox
                checked={smsOptIn}
                onChange={setSmsOptIn}
                showDetails={false}
              />
            )}
            {selectedChannels.includes('whatsapp') && (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  I agree to receive WhatsApp appointment reminders at the phone number I provided.
                </span>
              </label>
            )}
            {selectedChannels.includes('sms') && !guestPhone?.trim() && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Add a phone number on your booking to receive SMS reminders.</p>
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">How far in advance</p>
        <div className="grid grid-cols-2 gap-2">
          {REMINDER_TIMES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleTime(id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedTimes.includes(id)
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                selectedTimes.includes(id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 dark:border-slate-500'
              }`}>
                {selectedTimes.includes(id) && <Check className="h-3 w-3 text-white" />}
              </div>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="w-full py-3 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: accentColor }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save reminders & finish
        </button>
      </div>
    </div>
  );
}

function displayBio(bio?: string | null): string {
  const text = bio?.trim() ?? '';
  if (!text || text.toLowerCase() === 'my bio') return '';
  return text;
}

interface SingleUseLinkRecord {
  id: string;
  host_id: string;
  service_id: string;
  token: string;
  label: string | null;
  used: boolean;
  expires_at: string | null;
}

export function BookPage() {
  const { slug, token } = useParams<{ slug?: string; token?: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isPaidBookingPage = Boolean(
    slug && !token && location.pathname.replace(/\/$/, '').endsWith('/services'),
  );
  const [host, setHost] = useState<Profile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [linkExpired, setLinkExpired] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [calendarBusyTimes, setCalendarBusyTimes] = useState<BusyPeriod[]>([]);
  const [questions, setQuestions] = useState<BookingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [singleUseLink, setSingleUseLink] = useState<SingleUseLinkRecord | null>(null);
  const [singleUseLinkInvalid, setSingleUseLinkInvalid] = useState(false);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<'service' | 'datetime' | 'details' | 'confirmed' | 'reminders'>('service');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['1hour']);
  const [remindersDone, setRemindersDone] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [guestTimezone, setGuestTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
  const [guestNotes, setGuestNotes] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [ndaAgreed, setNdaAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingSecret, setFetchingSecret] = useState(false);
  const [stripePaymentId, setStripePaymentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<BookPaymentMethod>('skip');
  const [recurringAcknowledged, setRecurringAcknowledged] = useState(false);

  const timeRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLDivElement>(null);

  const handleDateSelect = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
    setSelectedSlot(null);
    setTimeout(() => timeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, []);

  const handleSlotSelect = useCallback((slot: string) => {
    setSelectedSlot(slot);
    setTimeout(() => continueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, []);

  const goToDetails = useCallback(() => {
    setStep('details');
    setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, []);

  useEffect(() => {
    const prefillFromProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', session.user.id)
        .single();

      const sessionEmail = session.user.email?.trim();
      if (profile?.full_name) {
        setGuestName((prev) => prev || profile.full_name!);
      }
      if (sessionEmail) {
        setGuestEmail((prev) => prev || sessionEmail);
      } else if (profile?.email) {
        setGuestEmail((prev) => prev || profile.email!);
      }
      if (profile?.phone) {
        setPhone((prev) => prev || profile.phone!);
      }
    };
    prefillFromProfile();
  }, []);

  useEffect(() => {
    if (!phone.trim()) {
      setSmsOptIn(false);
      setWhatsappOptIn(false);
    }
  }, [phone]);

  useEffect(() => {
    if (!slug && !token) return;

    // Check expiry param before loading anything
    const expiresParam = searchParams.get('expires');
    if (expiresParam) {
      const expiresAt = parseInt(expiresParam, 10);
      if (!isNaN(expiresAt) && Date.now() > expiresAt) {
        setLinkExpired(true);
        setLoading(false);
        return;
      }
    }

    (async () => {
      let hostId: string;
      let serviceId: string | null = null;
      let loadedProfile: Profile | null = null;

      if (token) {
        // Single-use link flow: look up by token
        const { data: link } = await supabase
          .from('single_use_links')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (!link) { setSingleUseLinkInvalid(true); setLoading(false); return; }

        const linkRecord = link as SingleUseLinkRecord;

        if (linkRecord.used) { setSingleUseLinkInvalid(true); setLoading(false); return; }
        if (linkRecord.expires_at && new Date(linkRecord.expires_at) < new Date()) {
          setSingleUseLinkInvalid(true); setLoading(false); return;
        }

        setSingleUseLink(linkRecord);
        hostId = linkRecord.host_id;
        serviceId = linkRecord.service_id;

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', hostId).maybeSingle();
        if (!profile) { setLoading(false); return; }
        loadedProfile = profile as Profile;
        setHost(loadedProfile);
      } else {
        const { data: profile } = await supabase.from('profiles').select('*').eq('slug', slug!).maybeSingle();
        if (!profile) { setLoading(false); return; }
        loadedProfile = profile as Profile;
        setHost(loadedProfile);
        hostId = profile.id;
      }

      const [svcRes, availRes, bookRes, ovRes, calEvtRes] = await Promise.all([
        serviceId
          ? supabase.from('services').select(SERVICE_SELECT).eq('id', serviceId).eq('is_active', true)
          : supabase.from('services').select(SERVICE_SELECT).eq('host_id', hostId).eq('is_active', true),
        supabase.from('availability').select('*').eq('host_id', hostId).eq('is_active', true),
        supabase.from('bookings').select('*').eq('host_id', hostId).in('status', ['confirmed']),
        supabase.from('date_overrides').select('*').eq('host_id', hostId),
        supabase.from('calendar_events').select('start_at,end_at,all_day,show_status,transparency,attendee_self_status,is_birthday_cal,is_holiday_cal,title').eq('host_id', hostId),
      ]);

      const allServices = (svcRes.data as Service[]) ?? [];
      const publicServices = token
        ? allServices
        : allServices.filter((s) => s.meeting_type !== 'one_off');
      const typesParam = searchParams.get('types');
      const filteredServices = typesParam
        ? publicServices.filter((s) => typesParam.split(',').includes(s.id))
        : publicServices;
      setServices(filteredServices);

      setAvailability(availRes.data ?? []);
      setBookings(bookRes.data ?? []);
      setDateOverrides((ovRes.data as DateOverride[]) ?? []);

      // Resolve the host's calendar conflict settings (with defaults)
      const conflictSettings: CalendarConflictSettings = {
        ...DEFAULT_CALENDAR_CONFLICT_SETTINGS,
        ...(loadedProfile?.calendar_conflict_settings ?? {}),
      };

      const rawEvents = (calEvtRes.data ?? []) as CalendarEvent[];
      const busyPeriods: BusyPeriod[] = [];
      for (const e of rawEvents) {
        if (!shouldBlockCalendarEvent(e, conflictSettings)) continue;
        if (e.all_day) {
          // All-day events span entire calendar days — convert to UTC day boundaries
          const startDay = new Date(e.start_at);
          startDay.setUTCHours(0, 0, 0, 0);
          const endDay = new Date(e.end_at);
          // Google/iCal end date for all-day is exclusive (next day); Outlook is inclusive midnight
          // We use the stored end_at as-is since it already covers the full day
          endDay.setUTCHours(23, 59, 59, 999);
          busyPeriods.push({ start: startDay, end: endDay });
        } else {
          busyPeriods.push({ start: new Date(e.start_at), end: new Date(e.end_at) });
        }
      }
      setCalendarBusyTimes(busyPeriods);
      setLoading(false);
    })();
  }, [slug, token, searchParams]);

  // Auto-select service for single-use links (only one service is loaded)
  useEffect(() => {
    if (singleUseLink && services.length === 1 && !selectedService) {
      handleSelectService(services[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleUseLink, services]);

  const slotMap = useMemo(() => {
    if (!selectedService) return new Map<string, string[]>();
    return buildSlots(availability, bookings, selectedService, dateOverrides, calYear, calMonth, calendarBusyTimes);
  }, [selectedService, availability, bookings, dateOverrides, calYear, calMonth, calendarBusyTimes]);

  const isRecurringService = !!(selectedService?.is_recurring && selectedService.recurrence_frequency);

  const recurringPreviewDates = useMemo(() => {
    if (!isRecurringService || !selectedService?.recurrence_frequency || !selectedDate || !selectedSlot) return [];
    const [y, m, d] = selectedDate.split('-').map(Number);
    const [sh, sm] = selectedSlot.split(':').map(Number);
    const start = new Date(y, m - 1, d, sh, sm);
    return getUpcomingRecurrenceDates(start, selectedService.recurrence_frequency, 4);
  }, [isRecurringService, selectedService, selectedDate, selectedSlot]);

  const recurringFrequencyLabel = selectedService?.recurrence_frequency
    ? formatRecurrenceBadge(selectedService.recurrence_frequency)
    : '';

  const displaySlotMap = useMemo(() => {
    if (!selectedService?.is_recurring) return slotMap;
    const maxClients = selectedService.max_recurring_clients ?? 1;
    const next = new Map<string, string[]>();
    slotMap.forEach((slots, dk) => {
      const filtered = slots.filter(slot =>
        countRecurringSeriesOnSlot(bookings, selectedService.id, dk, slot) < maxClients
      );
      if (filtered.length) next.set(dk, filtered);
    });
    return next;
  }, [slotMap, selectedService, bookings]);

  const handleSelectService = async (svc: Service) => {
    const { data: freshSvc } = await supabase.from('services').select(SERVICE_SELECT).eq('id', svc.id).maybeSingle();
    const service = (freshSvc as Service | null) ?? svc;
    setSelectedService(service);
    if (freshSvc) {
      setServices((prev) => prev.map((s) => (s.id === service.id ? service : s)));
    }
    setSelectedDate(null); setSelectedSlot(null); setAnswers({});
    setRecurringAcknowledged(false);
    setPaymentConfirmed(false);
    setPaymentError('');
    setClientSecret(null);
    setFetchingSecret(false);
    setStripePaymentId(null);
    setPaymentMethod('skip');
    const { data } = await supabase.from('booking_questions').select('*').eq('service_id', svc.id).order('sort_order');
    setQuestions((data as BookingQuestion[]) ?? []);
    setStep('datetime');
  };

  const handleBook = async () => {
    if (!selectedService) return;
    const email = guestEmail.trim();
    if (!email) {
      setDetailsError('Email address is required');
      return;
    }
    setDetailsError('');
    setSubmitting(true);
    const booking = await createBookingRecord();
    if (booking) {
      setConfirmedBooking(booking);
      if (booking.reminder_channels?.length) setSelectedChannels(booking.reminder_channels);
      if (booking.reminder_times?.length) setSelectedTimes(booking.reminder_times);
      setStep('confirmed');
      if (selectedService.confirmation_redirect_url) {
        try {
          const redirectUrl = new URL(selectedService.confirmation_redirect_url);
          if (redirectUrl.protocol === 'https:') window.location.href = redirectUrl.href;
        } catch { /* invalid URL */ }
      }
    }
    setSubmitting(false);
  };

  const createBookingRecord = useCallback(async () => {
    if (!selectedService || !selectedDate || !selectedSlot || !host) return null;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const [sh, sm] = selectedSlot.split(':').map(Number);
    const startTime = new Date(y, m - 1, d, sh, sm);
    const endTime = new Date(startTime.getTime() + selectedService.duration_minutes * 60000);
    const isRecurring = !!(selectedService.is_recurring && selectedService.recurrence_frequency);
    const email = guestEmail.trim();
    const { guestPhone: phoneVal, smsConsentGranted, whatsappConsentGranted } =
      resolveBookingSmsConsent(phone, smsOptIn, whatsappOptIn);
    const notifyViaPayload = buildNotifyViaPayload(email, phone, smsOptIn, whatsappOptIn);
    const effectiveReminderChannels = selectedChannels.filter((ch) => {
      if (ch === 'sms') return smsConsentGranted;
      if (ch === 'whatsapp') return whatsappConsentGranted;
      return true;
    });
    const { data } = await supabase.from('bookings').insert({
      service_id: selectedService.id,
      host_id: host.id,
      guest_name: guestName,
      guest_email: email || null,
      guest_phone: phoneVal,
      notify_via: notifyViaPayload.length > 0 ? notifyViaPayload : null,
      guest_timezone: guestTimezone,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: guestNotes,
      status: 'confirmed',
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? selectedService.recurrence_frequency : null,
      reminder_channels: effectiveReminderChannels.length > 0 ? effectiveReminderChannels : ['email'],
      reminder_times: selectedTimes,
      stripe_payment_id: stripePaymentId,
    }).select().maybeSingle();
    if (data) {
      // Mark single-use link as used
      if (singleUseLink) {
        await supabase.from('single_use_links').update({
          used: true,
          used_at: new Date().toISOString(),
          booking_id: data.id,
        }).eq('id', singleUseLink.id);
      }

      if (questions.length > 0 && Object.keys(answers).length > 0) {
        const answerRows = questions.filter((q) => answers[q.id] !== undefined).map((q) => ({
          booking_id: data.id,
          question_id: q.id,
          answer: q.field_type === 'phone' ? normalizePhoneE164(answers[q.id] ?? '') : (answers[q.id] ?? ''),
        }));
        if (answerRows.length) await supabase.from('booking_answers').insert(answerRows);
      }

      if (shouldRecordSmsOptIn(phone, smsOptIn) && phoneVal) {
        supabase.from('sms_optins').insert({
          name: guestName.trim() || null,
          phone: phoneVal,
          consent: true,
          source: 'booking',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }).then(({ error }) => {
          if (error) console.warn('SMS opt-in record failed:', error.message);
        });
      }

      // Create Google Meet link if host has Google Calendar connected
      try {
        const meetPayload = {
          booking_id: data.id,
          host_id: host.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          summary: `${selectedService.name} with ${guestName}`,
          description: `Booked via PinOnIt\nGuest: ${guestName}${email ? ` (${email})` : ''}${phoneVal ? ` (${phoneVal})` : ''}${guestNotes ? `\nNotes: ${guestNotes}` : ''}`,
          guest_email: email || undefined,
          guest_name: guestName,
        };
        const meetRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-google-meet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify(meetPayload),
        });
        if (meetRes.ok) {
          const meetData = await meetRes.json();
          if (meetData.meet_link) (data as Booking).meet_link = meetData.meet_link;
        }
      } catch { /* non-blocking */ }

      // Create Teams meeting link if host has Outlook Calendar connected
      try {
        const teamsPayload = {
          booking_id: data.id,
          host_id: host.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          summary: `${selectedService.name} with ${guestName}`,
          guest_email: email || undefined,
          guest_name: guestName,
        };
        const teamsRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-teams-meeting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify(teamsPayload),
        });
        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          if (teamsData.teams_link && !(data as Booking).meet_link) {
            (data as Booking).meet_link = teamsData.teams_link;
          }
        }
      } catch { /* non-blocking */ }

      // Create Zoom meeting if host has Zoom connected and no video link yet
      try {
        if (!(data as Booking).meet_link) {
          const zoomRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-zoom-meeting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            body: JSON.stringify({
              booking_id: data.id,
              host_id: host.id,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              summary: `${selectedService.name} with ${guestName}`,
              guest_email: email || undefined,
              guest_name: guestName,
            }),
          });
          if (zoomRes.ok) {
            const zoomData = await zoomRes.json();
            if (zoomData.zoom_link) (data as Booking).meet_link = zoomData.zoom_link;
          }
        }
      } catch { /* non-blocking */ }

      if (isRecurring && selectedService.recurrence_frequency) {
        const freq = selectedService.recurrence_frequency;
        const endType = getRecurrenceEndType(selectedService.recurrence_end_date, selectedService.recurrence_end_occurrences);
        const nextStart = addRecurrence(startTime, freq);
        if (!shouldStopRecurrence(nextStart, 2, endType, selectedService.recurrence_end_date, selectedService.recurrence_end_occurrences)) {
          const nextEnd = new Date(nextStart.getTime() + selectedService.duration_minutes * 60000);
          await supabase.from('bookings').insert({
            service_id: selectedService.id,
            host_id: host.id,
            guest_name: guestName,
            guest_email: email || null,
            guest_phone: phoneVal,
            notify_via: notifyViaPayload.length > 0 ? notifyViaPayload : null,
            guest_timezone: guestTimezone,
            start_time: nextStart.toISOString(),
            end_time: nextEnd.toISOString(),
            notes: guestNotes,
            status: 'confirmed',
            is_recurring: true,
            recurrence_frequency: freq,
            parent_booking_id: data.id,
            reminder_channels: effectiveReminderChannels.length > 0 ? effectiveReminderChannels : ['email'],
            reminder_times: selectedTimes,
          });
        }
      }

      try {
        const { data: rules } = await supabase.from('reminder_rules').select('template_id').eq('host_id', host.id).eq('is_active', true);
        if (rules?.length) {
          for (const rule of rules) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
              body: JSON.stringify({ booking_id: data.id, template_id: rule.template_id }),
            }).catch(() => {});
          }
        }
      } catch { /* non-blocking */ }
    }
    return data as Booking | null;
  }, [selectedService, selectedDate, selectedSlot, host, guestName, guestEmail, phone, smsOptIn, whatsappOptIn, guestTimezone, guestNotes, questions, answers, singleUseLink, selectedChannels, selectedTimes, stripePaymentId]);

  useEffect(() => {
    setClientSecret(null);
    setFetchingSecret(false);
  }, [selectedService?.id]);

  useEffect(() => {
    if (paymentMethod !== 'stripe') return;
    if (clientSecret || fetchingSecret) return;
    if (step !== 'details' || !selectedService || selectedService.price_cents <= 0) return;

    const fetchSecret = async () => {
      setFetchingSecret(true);
      setPaymentError('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            amount: selectedService.price_cents,
            currency: 'usd',
            service_id: selectedService.id,
            host_id: selectedService.host_id,
            guest_email: guestEmail.trim() || undefined,
            guest_name: guestName.trim() || undefined,
          },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (error) throw error;
        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error(typeof data?.error === 'string' ? data.error : 'No client secret returned');
        }
      } catch (err) {
        setPaymentError('Unable to load payment form. Please try again.');
        console.error('Payment intent error:', err);
      } finally {
        setFetchingSecret(false);
      }
    };

    void fetchSecret();
  }, [paymentMethod, selectedService?.id, selectedService?.price_cents, selectedService?.host_id, step, clientSecret, fetchingSecret]);

  const handleSaveReminders = async () => {
    if (!confirmedBooking) return;
    setSavingReminders(true);
    const phoneRaw = confirmedBooking.guest_phone ?? phone;
    const { smsConsentGranted, whatsappConsentGranted } = resolveBookingSmsConsent(
      phoneRaw,
      smsOptIn,
      whatsappOptIn,
    );
    const effectiveChannels = selectedChannels.filter((ch) => {
      if (ch === 'sms') return smsConsentGranted;
      if (ch === 'whatsapp') return whatsappConsentGranted;
      return true;
    });
    const notifyViaUpdate = buildNotifyViaPayload(
      confirmedBooking.guest_email ?? '',
      phoneRaw,
      smsOptIn,
      whatsappOptIn,
    );
    if (confirmedBooking.action_token) {
      await supabase.rpc('save_guest_reminder_prefs', {
        p_booking_id: confirmedBooking.id,
        p_action_token: confirmedBooking.action_token,
        p_reminder_channels: effectiveChannels.length > 0 ? effectiveChannels : ['email'],
        p_reminder_times: selectedTimes,
        p_notify_via: notifyViaUpdate.length > 0 ? notifyViaUpdate : null,
      });
      setConfirmedBooking({
        ...confirmedBooking,
        reminder_channels: effectiveChannels.length > 0 ? effectiveChannels : ['email'],
        reminder_times: selectedTimes,
        notify_via: notifyViaUpdate.length > 0 ? notifyViaUpdate : null,
      });
    }
    setRemindersDone(true);
    setStep('confirmed');
    setSavingReminders(false);
  };

  const reminderSummary = useMemo(
    () =>
      selectedChannels.flatMap((ch) =>
        selectedTimes.map((time) => ({ channel: ch, time }))
      ),
    [selectedChannels, selectedTimes]
  );

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [calYear, calMonth]);

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); setSelectedDate(null); setSelectedSlot(null); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); setSelectedDate(null); setSelectedSlot(null); };

  // ── Theme system ──────────────────────────────────────────────────────────────
  type ThemeId = 'clean' | 'bold' | 'warm';
  interface ThemeDef {
    id: ThemeId; bg: string; surface: string; border: string;
    text: string; muted: string; btnBg: string; btnText: string; accentBar: string;
  }
  const THEMES_BOOK: ThemeDef[] = [
    { id: 'clean', bg: '#ffffff', surface: '#f8fafc', border: '#e2e8f0', text: '#0f172a', muted: '#64748b', btnBg: '#5864C6', btnText: '#ffffff', accentBar: '#5864C6' },
    { id: 'bold',  bg: '#141414', surface: '#1e1e1e', border: '#2a2a2a', text: '#f5f5f5', muted: '#a0a0a0', btnBg: '#ffffff', btnText: '#141414', accentBar: '#ffffff' },
    { id: 'warm',  bg: '#fdf6ec', surface: '#fef9f3', border: '#e8d5bc', text: '#3b2a1a', muted: '#8a6a50', btnBg: '#c0622a', btnText: '#ffffff', accentBar: '#c0622a' },
  ];
  const cleanTheme = THEMES_BOOK[0];
  const paidSettings = (host as any)?.paid_booking_settings as PaidBookingSettings | undefined;
  const paidThemeId = (((host as any)?.paid_booking_theme ?? 'clean') as ThemeId);

  const pageTheme = isPaidBookingPage
    ? (THEMES_BOOK.find((t) => t.id === paidThemeId) ?? cleanTheme)
    : cleanTheme;
  const isBoldTheme = pageTheme.id === 'bold';

  const pageBtnColor = isPaidBookingPage
    ? (paidSettings?.btn_color || pageTheme.btnBg)
    : (host?.brand_color ?? cleanTheme.btnBg);
  const pageBtnLabel = isPaidBookingPage ? (paidSettings?.btn_label || 'Book') : 'Book';
  const pageBgColor = isPaidBookingPage ? (paidSettings?.bg_color || pageTheme.bg) : cleanTheme.bg;
  const pageLayout = isPaidBookingPage ? (paidSettings?.layout ?? 'list') : 'list';
  const pageShowDesc = isPaidBookingPage ? (paidSettings?.show_descriptions ?? true) : true;
  const pageShowImages = isPaidBookingPage ? (paidSettings?.show_images ?? false) : false;
  const pageUseCategories = isPaidBookingPage ? (paidSettings?.use_categories ?? false) : false;
  const pageCategories = isPaidBookingPage ? (paidSettings?.categories ?? []) : [];
  const pageDisplayName = isPaidBookingPage
    ? (paidSettings?.display_name || host?.full_name || '')
    : (host?.full_name || '');
  const pageTagline = isPaidBookingPage
    ? (paidSettings?.tagline || host?.booking_page_header || '')
    : (host?.booking_page_header?.trim() || '');
  const pageBio = isPaidBookingPage
    ? displayBio(paidSettings?.bio || host?.bio)
    : displayBio(host?.bio);
  const pageBusinessPhoto = isPaidBookingPage
    ? (paidSettings?.business_photo_url || host?.avatar_url || null)
    : (host?.avatar_url || null);
  const pageTextColor = pageTheme.text;
  const pageMutedColor = pageTheme.muted;
  const pageSurfaceColor = pageTheme.surface;
  const pageBorderColor = pageTheme.border;

  const calendlyStyle = !isPaidBookingPage;
  const accentColor = calendlyStyle ? BOOKING_NAVY : pageBtnColor;
  const focusRing = calendlyStyle ? 'focus:ring-[#1a1f36]' : 'focus:ring-indigo-600';

  const serviceShowsDescription = (svc: Service) => {
    if (!pageShowDesc || !svc.description) return false;
    if (isPaidBookingPage) return (svc as Service).show_description_on_paid_booking ?? true;
    return (svc as Service).show_description_on_booking_page ?? true;
  };
  const isPaidService = selectedService ? selectedService.price_cents > 0 : false;
  const stripeAvailable = !!stripePromise;
  const paymentOptions = useMemo(
    () => (selectedService && isPaidService ? buildPaymentOptions(selectedService, stripeAvailable) : []),
    [selectedService, isPaidService, stripeAvailable]
  );
  const paymentHandles = useMemo(
    () => (selectedService ? getServicePaymentHandles(selectedService) : null),
    [selectedService]
  );
  const showP2PHandles = paymentHandles ? hasAnyPaymentHandle(paymentHandles) : false;
  const isHostViewer = !!(user?.id && host?.id && user.id === host.id);
  const selectedPaymentOption = paymentOptions.find((o) => o.id === paymentMethod);
  const showPaidBookingPayment = isPaidService && !(isRecurringService && (selectedService?.price_cents ?? 0) > 0);
  const termsDisplayText = resolveTermsText(host?.global_terms_text);
  const requiresTerms = !!(host?.global_require_terms && selectedService?.require_terms);
  const showTermsAgreement = requiresTerms;
  const termsBodyText = showTermsAgreement
    ? (selectedService?.cancellation_policy?.trim() || termsDisplayText)
    : '';
  const hasRequiredQuestions = questions.some((q) => q.required && !answers[q.id]?.trim());
  const requiresNda = !!selectedService?.require_nda;
  const requiresRecurringAck = isRecurringService && !recurringAcknowledged;
  const requiresPayment = showPaidBookingPayment && paymentMethod !== 'skip' && !paymentConfirmed;
  const isValid =
    guestName.trim() !== '' &&
    guestEmail.trim() !== '' &&
    (!requiresTerms || termsAgreed);
  const canSubmitDetails =
    isValid &&
    !hasRequiredQuestions &&
    (!requiresNda || ndaAgreed) &&
    !requiresRecurringAck &&
    !requiresPayment;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 transition-colors">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );

  if (singleUseLinkInvalid) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <div className="text-center max-w-sm px-6">
        <div className="h-16 w-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold mb-2">Link no longer valid</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">This single-use booking link has already been used or has expired. Contact the host for a new link.</p>
        <Link to="/" className="mt-6 inline-block text-[#5864C6] hover:opacity-80 text-sm font-medium">Go home</Link>
      </div>
    </div>
  );

  if (linkExpired) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <div className="text-center max-w-sm px-6">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">This link has expired</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">This scheduling link has expired. Please request a new link from your host.</p>
        <Link to="/" className="mt-6 inline-block text-[#5864C6] hover:opacity-80 text-sm font-medium">Go home</Link>
      </div>
    </div>
  );

  if (!host) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-slate-500 dark:text-slate-400">This scheduling page doesn't exist.</p>
        <Link to="/" className="mt-4 inline-block text-[#5864C6] hover:opacity-80 text-sm">Go home</Link>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors ${calendlyStyle ? 'bg-white text-slate-800' : ''}`} style={calendlyStyle ? undefined : { backgroundColor: pageBgColor, color: pageTextColor }}>
      {!calendlyStyle && <div className="h-1.5 w-full" style={{ backgroundColor: pageTheme.accentBar }} />}
      <header className={`${calendlyStyle ? 'bg-white border-b border-slate-200' : 'border-b sticky top-0 z-40 backdrop-blur-xl'} transition-colors`}
        style={calendlyStyle ? undefined : { borderColor: pageBorderColor, backgroundColor: pageBgColor + 'cc' }}>
        <div className={`${calendlyStyle ? 'max-w-6xl' : 'max-w-5xl'} mx-auto px-6 h-14 flex items-center justify-between`}>
          <Link to="/" className={`flex items-center gap-1.5 transition-colors text-sm ${calendlyStyle ? 'text-slate-500 hover:text-slate-800' : ''}`} style={calendlyStyle ? undefined : { color: pageMutedColor }}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            {singleUseLink && (
              <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full font-semibold text-[11px]">
                <Zap className="h-3 w-3" />
                Single-use link
              </span>
            )}
            {host?.plan === 'free' && !calendlyStyle ? (
              <Link
                to="/"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors font-medium"
              >
                <img src="/Screenshot_2026-04-29_at_2.49.32_PM.png" alt="Pin on It" className="h-4 w-auto opacity-70" />
                <span>Powered by Pin on It</span>
              </Link>
            ) : !calendlyStyle ? (
              <img src="/Screenshot_2026-04-29_at_2.49.32_PM.png" alt="Pin on It" className="h-5 w-auto opacity-40" />
            ) : null}
          </div>
        </div>
      </header>

      <main className={`${calendlyStyle ? 'max-w-6xl' : 'max-w-5xl'} mx-auto px-4 py-6 md:py-8`}>
        <div className={calendlyStyle ? 'bg-white shadow-lg rounded-2xl border border-slate-200 overflow-hidden' : ''}>
        <div className={calendlyStyle ? 'grid lg:grid-cols-[3fr_7fr]' : 'grid lg:grid-cols-[280px_1fr] gap-6 md:gap-8'}>
          <aside className={`${calendlyStyle ? 'p-6 md:p-8 lg:border-r border-slate-200 space-y-5' : 'space-y-4'}`}>
            <div className={`flex gap-4 ${calendlyStyle ? 'flex-col sm:flex-row lg:flex-col items-start' : 'items-center gap-3'}`}>
              {pageBusinessPhoto ? (
                <img
                  src={pageBusinessPhoto}
                  alt={pageDisplayName}
                  width={calendlyStyle ? 64 : 56}
                  height={calendlyStyle ? 64 : 56}
                  loading="lazy"
                  className={`rounded-full object-cover ${calendlyStyle ? 'h-16 w-16' : 'h-14 w-14'}`}
                />
              ) : (
                <div className={`rounded-full flex items-center justify-center text-white font-bold ${calendlyStyle ? 'h-16 w-16 text-xl' : 'h-14 w-14 text-lg'}`}
                  style={{ backgroundColor: accentColor + '33', border: `2px solid ${accentColor}` }}>
                  {(pageDisplayName || 'H').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className={`${calendlyStyle ? 'text-2xl font-bold text-slate-800' : 'font-semibold text-base'}`} style={calendlyStyle ? undefined : { color: pageTextColor }}>{pageDisplayName || 'Host'}</h1>
                {pageTagline && <p className={`mt-1 ${calendlyStyle ? 'text-base text-slate-500' : 'text-xs'}`} style={calendlyStyle ? undefined : { color: pageMutedColor }}>{pageTagline}</p>}
              </div>
            </div>
            {pageBio && <p className={`leading-relaxed ${calendlyStyle ? 'text-base text-slate-600' : 'text-sm'}`} style={calendlyStyle ? undefined : { color: pageMutedColor }}>{pageBio}</p>}
            {selectedService && (
              <div className={`border text-sm ${calendlyStyle ? 'p-5 rounded-xl border-slate-200 shadow-sm bg-white space-y-3' : 'p-4 rounded-xl space-y-2.5'}`}
                style={calendlyStyle ? undefined : { backgroundColor: pageSurfaceColor, borderColor: pageBorderColor }}>
                <div className="flex items-start gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: selectedService.color }} />
                  <span className={`${calendlyStyle ? 'text-xl font-semibold text-slate-800' : 'font-medium'}`} style={calendlyStyle ? undefined : { color: pageTextColor }}>{selectedService.name}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${calendlyStyle ? 'text-base text-slate-500' : ''}`} style={calendlyStyle ? undefined : { color: pageMutedColor }}><Clock className="h-4 w-4" />{selectedService.duration_minutes} min</div>
                {selectedService.location && (
                  <div className={`flex items-center gap-1.5 ${calendlyStyle ? 'text-base text-slate-500' : ''}`} style={calendlyStyle ? undefined : { color: pageMutedColor }}>
                    {(() => { const Icon = getLocationIcon(selectedService.location_type); return <Icon className="h-4 w-4" />; })()}
                    {LOCATION_TYPES[selectedService.location_type]}
                  </div>
                )}
                {selectedService.price_cents > 0 && (
                  <div className={`${calendlyStyle ? 'text-base font-semibold text-slate-800' : 'font-medium'}`} style={calendlyStyle ? undefined : { color: accentColor }}>
                    ${(selectedService.price_cents / 100).toFixed(2)}
                  </div>
                )}
                {selectedDate && (
                  <div className={`flex items-center gap-1.5 border-t pt-3 ${calendlyStyle ? 'text-slate-800' : ''}`} style={calendlyStyle ? undefined : { color: pageTextColor, borderColor: pageBorderColor }}>
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                )}
                {selectedSlot && <div className={`flex items-center gap-1.5 ${calendlyStyle ? 'text-slate-800' : ''}`} style={calendlyStyle ? undefined : { color: pageTextColor }}><Clock className="h-4 w-4" />{formatTime12(selectedSlot)}</div>}
              </div>
            )}
          </aside>

          <div className={calendlyStyle ? 'p-6 md:p-8' : ''}>
            {step === 'service' && (
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: pageTextColor }}>Book an appointment</h2>
                <p className="text-sm mb-6" style={{ color: pageMutedColor }}>Select a service to get started.</p>
                {(() => {
                  const renderSvc = (svc: Service) => {
                    const ext = svc as Service & { banner_image_url?: string | null; category?: string | null };
                    if (pageLayout === 'grid') {
                      return (
                        <button key={svc.id} onClick={() => handleSelectService(svc)}
                          className="flex flex-col rounded-xl overflow-hidden transition-all text-left shadow-sm border"
                          style={{ backgroundColor: pageSurfaceColor, borderColor: pageBorderColor }}>
                          {pageShowImages && ext.banner_image_url
                            ? <img src={ext.banner_image_url} alt={svc.name} width={112} height={112} loading="lazy" className="w-full h-28 object-cover" />
                            : pageShowImages && <div className="w-full h-20 flex items-center justify-center" style={{ backgroundColor: pageBorderColor }}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: svc.color }} /></div>
                          }
                          <div className="p-3.5 flex-1 flex flex-col gap-2">
                            <p className="font-semibold text-sm" style={{ color: pageTextColor }}>{svc.name}</p>
                            {serviceShowsDescription(svc) && <p className="text-xs line-clamp-2 flex-1" style={{ color: pageMutedColor }}>{svc.description}</p>}
                            <div className="flex items-center justify-between gap-2 mt-auto">
                              <span className="text-xs" style={{ color: pageMutedColor }}>{svc.duration_minutes} min{svc.price_cents > 0 ? ` · $${(svc.price_cents / 100).toFixed(2)}` : ' · Free'}</span>
                              <span style={{ backgroundColor: pageBtnColor, color: pageTheme.btnText }} className="px-3 py-1.5 text-xs font-semibold rounded-lg">{pageBtnLabel}</span>
                            </div>
                          </div>
                        </button>
                      );
                    }
                    return (
                      <button key={svc.id} onClick={() => handleSelectService(svc)}
                        className={`w-full p-4 rounded-xl transition-all text-left border ${isBoldTheme ? 'shadow-none' : 'shadow-sm'}`}
                        style={{ backgroundColor: pageSurfaceColor, borderColor: pageBorderColor }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {pageShowImages && (ext.banner_image_url
                              ? <img src={ext.banner_image_url} alt={svc.name} width={isBoldTheme ? 64 : 56} height={isBoldTheme ? 64 : 56} loading="lazy" className={`rounded-lg object-cover shrink-0 ${isBoldTheme ? 'h-16 w-16' : 'h-14 w-14'}`} />
                              : <div className={`rounded-lg shrink-0 flex items-center justify-center ${isBoldTheme ? 'h-16 w-16' : 'h-14 w-14'}`} style={{ backgroundColor: pageBorderColor }}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: svc.color }} /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {!pageShowImages && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: svc.color }} />}
                                <span className={`font-semibold ${isBoldTheme ? 'text-base' : ''}`} style={{ color: pageTextColor }}>{svc.name}</span>
                              </div>
                              {serviceShowsDescription(svc) && <p className="text-sm mb-1.5" style={{ color: pageMutedColor }}>{svc.description}</p>}
                              <p className="text-xs" style={{ color: pageMutedColor }}>
                                {svc.duration_minutes} min
                                {svc.price_cents > 0
                                  ? <span className="ml-2 font-semibold" style={{ color: pageBtnColor }}>${(svc.price_cents / 100).toFixed(2)}</span>
                                  : <span className="ml-2" style={{ color: pageMutedColor }}>Free</span>}
                              </p>
                            </div>
                          </div>
                          <span style={{ backgroundColor: pageBtnColor, color: pageTheme.btnText }} className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap self-center">{pageBtnLabel}</span>
                        </div>
                      </button>
                    );
                  };
                  if (pageUseCategories && pageCategories.length > 0) {
                    const grouped = pageCategories.map((cat) => ({ cat, svcs: services.filter((s) => (s as any).category === cat) })).filter((g) => g.svcs.length > 0);
                    const ungrouped = services.filter((s) => !pageCategories.includes((s as any).category));
                    return (
                      <div className="space-y-6">
                        {grouped.map(({ cat, svcs }) => (
                          <div key={cat}>
                            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: pageMutedColor }}>{cat}</p>
                            <div className={pageLayout === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>{svcs.map(renderSvc)}</div>
                          </div>
                        ))}
                        {ungrouped.length > 0 && <div className={pageLayout === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>{ungrouped.map(renderSvc)}</div>}
                      </div>
                    );
                  }
                  return (
                    <div className={pageLayout === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                      {services.map(renderSvc)}
                      {services.length === 0 && <p className="text-sm py-4" style={{ color: pageMutedColor }}>No services available.</p>}
                    </div>
                  );
                })()}
              </div>
            )}

            {step === 'datetime' && selectedService && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`font-bold ${calendlyStyle ? 'text-xl text-slate-800' : 'text-xl'}`} style={calendlyStyle ? undefined : { color: pageTextColor }}>Select date & time</h2>
                  <button onClick={() => { setStep('service'); setSelectedService(null); setSelectedDate(null); setSelectedSlot(null); }}
                    className={`text-sm transition-colors ${calendlyStyle ? 'text-slate-500 hover:text-slate-800' : ''}`} style={calendlyStyle ? undefined : { color: pageMutedColor }}>Change service</button>
                </div>
              <div className="flex flex-col gap-6">
                  {!selectedDate ? (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <button onClick={prevMonth} className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors rounded-lg">
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <h3 className={`font-semibold ${calendlyStyle ? 'text-base text-slate-800' : 'text-base'}`}>{MONTH_NAMES[calMonth]} {calYear}</h3>
                        <button onClick={nextMonth} className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors rounded-lg">
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 mb-2">
                        {DAY_SHORT.map((d) => <div key={d} className="text-center text-xs uppercase text-slate-400 font-medium py-1 tracking-wide">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-y-1">
                        {calendarDays.map((d, i) => {
                          if (!d) return <div key={`empty-${i}`} />;
                          const dk = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                          const hasSlots = displaySlotMap.has(dk);
                          const isToday = dk === toDateKey(today);
                          const isPast = new Date(calYear, calMonth, d) < today && !isToday;
                          const disabled = !hasSlots || isPast;
                          return (
                            <button key={dk} disabled={disabled} onClick={() => handleDateSelect(dk)}
                              className={`mx-auto h-9 w-9 flex items-center justify-center text-base font-medium transition-all rounded-full ${
                                disabled
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : isToday
                                    ? 'text-slate-800 ring-2 ring-[#1a1f36] ring-offset-1 hover:bg-[#EEF2FF]'
                                    : 'text-slate-800 hover:bg-[#EEF2FF]'
                              }`}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Timezone</label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                          <select
                            value={guestTimezone}
                            onChange={(e) => setGuestTimezone(e.target.value)}
                            className={`w-full appearance-none pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 ${focusRing} focus:outline-none focus:ring-2 transition`}
                          >
                            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{formatTimezoneDisplay(tz)}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">{formatTimezoneDisplay(guestTimezone)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-indigo-900">
                          {formatSelectedDateLabel(selectedDate)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedDate(null); setSelectedSlot(null); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {selectedDate && !selectedSlot && (
                    <div ref={timeRef}>
                      <h4 className="text-base font-medium text-slate-800 mb-3">Select a time</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {(displaySlotMap.get(selectedDate) ?? []).map((slot) => (
                          <button key={slot} type="button" onClick={() => handleSlotSelect(slot)}
                            className="py-3 px-4 rounded-lg text-sm font-medium transition-all bg-white border border-slate-200 text-slate-800 hover:bg-[#EEF2FF] hover:border-slate-300">
                            {formatTime12(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDate && selectedSlot && (
                    <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-indigo-900">{formatTime12(selectedSlot)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedSlot(null)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {!selectedDate && (
                    <p className="text-sm text-slate-500">Select a date to see available times.</p>
                  )}
                </div>
                {selectedDate && selectedSlot && isRecurringService && (
                  <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">This is a recurring booking</p>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                        {recurringFrequencyLabel}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">Your upcoming appointments:</p>
                      <ul className="space-y-1.5">
                        {recurringPreviewDates.map((dt, i) => (
                          <li key={i} className="text-sm text-slate-700">
                            ✓ {dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at{' '}
                            {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-slate-500 mt-2 italic">
                        ...and {selectedService?.recurrence_frequency === 'monthly' ? 'every month' : selectedService?.recurrence_frequency === 'biweekly' ? 'every 2 weeks' : 'every week'} after that
                      </p>
                    </div>
                  </div>
                )}
                {selectedDate && selectedSlot && (
                  <div ref={continueRef} className="mt-4 flex justify-end">
                    <button type="button" onClick={goToDetails} className={`w-full sm:w-auto px-6 py-3 text-white font-semibold transition-colors inline-flex items-center justify-center gap-2 min-h-[48px] ${calendlyStyle ? 'rounded-xl bg-[#1a1f36] hover:opacity-90' : 'rounded-lg'}`} style={calendlyStyle ? undefined : { backgroundColor: accentColor }}>
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 'details' && selectedService && selectedDate && selectedSlot && (
              <div ref={detailsRef}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold" style={{ color: pageTextColor }}>Your details</h2>
                  <button onClick={() => setStep('datetime')} className="text-sm transition-colors" style={{ color: pageMutedColor }}>Change time</button>
                </div>
                {/* Required fields legend */}
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-1">
                  <span className="text-red-400 font-bold">*</span> Required fields
                </p>
                <div className="space-y-4">
                  {isRecurringService && selectedService.recurrence_frequency && (
                    <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/60 dark:bg-indigo-950/20 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">This is a recurring booking</p>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                          {recurringFrequencyLabel}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Your upcoming appointments:</p>
                        <ul className="space-y-1.5">
                          {recurringPreviewDates.map((dt, i) => (
                            <li key={i} className="text-sm text-slate-700 dark:text-slate-300">
                              ✓ {dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at{' '}
                              {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
                          ...and {selectedService.recurrence_frequency === 'monthly' ? 'every month' : selectedService.recurrence_frequency === 'biweekly' ? 'every 2 weeks' : 'every week'} after that
                        </p>
                      </div>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={recurringAcknowledged} onChange={(e) => setRecurringAcknowledged(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          I understand this is a recurring booking and I will be scheduled each {formatRecurrencePeriod(selectedService.recurrence_frequency)}
                          {isPaidService ? ' (payment to be arranged with host)' : ''}
                        </span>
                      </label>
                      {isPaidService && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                          Recurring payment setup coming soon — host will be in touch to set up payment.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Full name <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <input type="text" placeholder="Jane Smith" value={guestName} onChange={(e) => setGuestName(e.target.value)} required
                          className={`w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition ${!guestName ? 'border-slate-300 dark:border-slate-700' : 'border-indigo-500 dark:border-indigo-600'}`} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Email address <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <input type="email" placeholder="jane@example.com" value={guestEmail} onChange={(e) => { setGuestEmail(e.target.value); setDetailsError(''); }}
                          className={`w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition ${guestEmail ? 'border-indigo-500 dark:border-indigo-600' : 'border-slate-300 dark:border-slate-700'}`} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Phone number <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setDetailsError('');
                          if (!e.target.value.trim()) {
                            setSmsOptIn(false);
                            setWhatsappOptIn(false);
                          }
                        }}
                        onBlur={(e) => { if (e.target.value.trim()) setPhone(blurFormatPhone(e.target.value)); }}
                        placeholder={PHONE_PLACEHOLDER}
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                      />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{PHONE_HINT}</p>
                    <SmsBookingConsentCheckbox
                      checked={smsOptIn}
                      onChange={setSmsOptIn}
                      className="mt-3"
                      showDetails={false}
                    />
                    <label className="flex items-start gap-2.5 cursor-pointer mt-3">
                      <input
                        type="checkbox"
                        checked={whatsappOptIn}
                        onChange={(e) => setWhatsappOptIn(e.target.checked)}
                        disabled={!phone.trim()}
                        className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 disabled:opacity-50"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        I agree to receive WhatsApp appointment reminders at the phone number I provided.
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Your timezone</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <select value={guestTimezone} onChange={(e) => setGuestTimezone(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition">
                        {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                  </div>
                  {questions.map((q) => (
                    <div key={q.id}>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        {q.label} {q.required && <span className="text-red-400">*</span>}
                        {!q.required && <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">(optional)</span>}
                      </label>
                      {q.field_type === 'textarea' ? (
                        <textarea value={answers[q.id] ?? ''} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} rows={3}
                          className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition resize-none" />
                      ) : q.field_type === 'select' ? (
                        <select value={answers[q.id] ?? ''} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition">
                          <option value="">Select...</option>
                          {(q.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : q.field_type === 'checkbox' ? (
                        <div className="flex items-center gap-6">
                          {['Yes', 'No'].map((opt) => (
                            <label key={opt} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`checkbox-${q.id}`}
                                checked={answers[q.id] === opt.toLowerCase()}
                                onChange={() => setAnswers((p) => ({ ...p, [q.id]: opt.toLowerCase() }))}
                                className="text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-600"
                              />
                              <span className="text-sm text-slate-700 dark:text-slate-300">{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <>
                          <input type={q.field_type === 'phone' ? 'tel' : q.field_type === 'url' ? 'url' : 'text'}
                            value={answers[q.id] ?? ''}
                            onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                            onBlur={(e) => {
                              if (q.field_type === 'phone' && e.target.value.trim()) {
                                setAnswers((p) => ({ ...p, [q.id]: blurFormatPhone(e.target.value) }));
                              }
                            }}
                            placeholder={q.field_type === 'phone' ? PHONE_PLACEHOLDER : undefined}
                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition" />
                          {q.field_type === 'phone' && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{PHONE_HINT}</p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Additional notes (optional)</label>
                    <textarea value={guestNotes} onChange={(e) => setGuestNotes(e.target.value)} rows={2}
                      placeholder="Anything else you'd like your host to know..."
                      className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition resize-none" />
                  </div>

                  {showPaidBookingPayment && selectedService && paymentOptions.length > 0 && (
                    <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900 dark:text-white">Payment</h3>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          ${(selectedService.price_cents / 100).toFixed(2)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Choose how you&apos;d like to pay</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {paymentOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(opt.id);
                              setPaymentConfirmed(opt.id === 'skip');
                              setPaymentError('');
                            }}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              paymentMethod === opt.id
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-gray-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {isHostViewer && paymentHandles && !showP2PHandles && (
                        <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 rounded-xl">
                          <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                            💡 Also accept Venmo, Cash App, Zelle & PayPal
                          </p>
                          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                            <a
                              href="/dashboard/services"
                              className="underline hover:text-indigo-700 dark:hover:text-indigo-300"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Add your payment handles in Services settings
                            </a>
                            {' '}— guests will see them as payment options.
                          </p>
                        </div>
                      )}

                      {paymentMethod === 'stripe' && (
                        <div className="mt-3">
                          {paymentConfirmed ? (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <Check className="h-4 w-4" />
                              Card payment complete
                            </div>
                          ) : !clientSecret ? (
                            <div className="flex items-center justify-center py-6 gap-2">
                              {fetchingSecret ? (
                                <>
                                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                                  <span className="text-sm text-gray-500 dark:text-slate-400">Loading payment form...</span>
                                </>
                              ) : (
                                <span className="text-sm text-amber-600 dark:text-amber-400">
                                  {paymentError || 'Unable to load payment form. Please try again.'}
                                </span>
                              )}
                            </div>
                          ) : !stripePromise ? (
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                              Card payments are not configured. Choose another payment method or Skip.
                            </p>
                          ) : (
                            <StripeBookingCheckout
                              key={clientSecret}
                              clientSecret={clientSecret}
                              amountLabel={`$${(selectedService.price_cents / 100).toFixed(2)}`}
                              accentColor={accentColor}
                              onSuccess={(paymentIntentId) => {
                                setStripePaymentId(paymentIntentId);
                                setPaymentConfirmed(true);
                                setPaymentError('');
                              }}
                              onError={(err) => setPaymentError(err)}
                            />
                          )}
                        </div>
                      )}

                      {showP2PHandles && paymentHandles && (
                        <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-4">
                          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 text-center">Or pay via</p>
                          <div className="flex flex-col gap-2">
                            {paymentHandles.paypal_handle && (
                              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                                <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">PayPal</span>
                                <span className="text-blue-600 dark:text-blue-400 text-sm">{paymentHandles.paypal_handle}</span>
                              </div>
                            )}
                            {paymentHandles.venmo_handle && (
                              <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                                <span className="text-indigo-700 dark:text-indigo-300 font-semibold text-sm">Venmo</span>
                                <span className="text-indigo-600 dark:text-indigo-400 text-sm">@{paymentHandles.venmo_handle}</span>
                              </div>
                            )}
                            {paymentHandles.cashapp_handle && (
                              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl">
                                <span className="text-green-700 dark:text-green-300 font-semibold text-sm">Cash App</span>
                                <span className="text-green-600 dark:text-green-400 text-sm">${paymentHandles.cashapp_handle}</span>
                              </div>
                            )}
                            {paymentHandles.zelle_handle && (
                              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
                                <span className="text-purple-700 dark:text-purple-300 font-semibold text-sm">Zelle</span>
                                <span className="text-purple-600 dark:text-purple-400 text-sm">{paymentHandles.zelle_handle}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-2">
                            Send payment note: your name + appointment date
                          </p>
                        </div>
                      )}

                      {paymentMethod !== 'stripe' && paymentMethod !== 'skip' && selectedPaymentOption && (
                        <div className={`p-3 rounded-lg ${selectedPaymentOption.panelBg}`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-sm font-semibold ${selectedPaymentOption.panelText}`}>
                              {selectedPaymentOption.label}
                            </span>
                            <span className={`text-sm ${selectedPaymentOption.panelText}`}>
                              {selectedPaymentOption.subtitle}
                            </span>
                          </div>
                          {selectedPaymentOption.url && (
                            <a
                              href={selectedPaymentOption.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline mb-3"
                            >
                              Open {selectedPaymentOption.label} to pay <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={paymentConfirmed}
                              onChange={(e) => setPaymentConfirmed(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 shrink-0"
                              style={{ accentColor }}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              I confirm I have sent ${(selectedService.price_cents / 100).toFixed(2)} via {selectedPaymentOption.label}{' '}
                              <span className="text-red-500">*</span>
                            </span>
                          </label>
                        </div>
                      )}

                      {paymentMethod === 'skip' && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          No payment required to book now. You can arrange payment with your host before the appointment.
                        </p>
                      )}
                    </div>
                  )}
                  {showTermsAgreement && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{termsBodyText}</p>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={termsAgreed} onChange={(e) => setTermsAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">I have read and agree to the terms above <span className="text-red-500">*</span></span>
                      </label>
                    </div>
                  )}
                  {(selectedService as any)?.require_nda && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">The parties agree to keep confidential all information shared during this session. Neither party shall disclose any proprietary, confidential, or sensitive information shared during or after this consultation to any third party without prior written consent.</p>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={ndaAgreed} onChange={(e) => setNdaAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">I agree to the Non-Disclosure Agreement above <span className="text-red-500">*</span></span>
                      </label>
                    </div>
                  )}

                  {(detailsError || !canSubmitDetails) && !submitting && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {detailsError
                        || (!guestName.trim() ? 'Full name is required.'
                          : !guestEmail.trim() ? 'Email address is required.'
                          : requiresTerms && !termsAgreed ? 'Please agree to the terms above.'
                          : hasRequiredQuestions ? 'Please answer all required questions.'
                          : requiresNda && !ndaAgreed ? 'Please agree to the NDA above.'
                          : requiresRecurringAck ? 'Please confirm you understand this is a recurring booking.'
                          : requiresPayment ? (paymentMethod === 'stripe' ? 'Please complete card payment above.' : 'Please confirm your payment above.')
                          : 'Please complete all required fields above.')}
                    </p>
                  )}


                  <button onClick={handleBook} disabled={submitting || !canSubmitDetails}
                    className="w-full py-3 text-white font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                    style={{ backgroundColor: !canSubmitDetails ? '#9ca3af' : accentColor }}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm meeting
                  </button>
                </div>
              </div>
            )}

            {step === 'confirmed' && confirmedBooking && selectedService && (
              <div className="py-8 max-w-md mx-auto">
                {/* Confirmation header */}
                <div className="text-center mb-8">
                  <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '22' }}>
                    <Check className="h-7 w-7" style={{ color: accentColor }} />
                  </div>
                  <h2 className="text-2xl font-bold mb-1">You're booked!</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Confirmation sent to{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {guestEmail.trim()}
                    </span>
                  </p>
                </div>

                {/* Booking detail card */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm space-y-3 mb-8 shadow-sm dark:shadow-none">
                  <div className="flex items-center gap-2 font-semibold text-base">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedService.color }} />
                    {selectedService.name}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Calendar className="h-4 w-4 shrink-0" />
                    {new Date(confirmedBooking.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Clock className="h-4 w-4 shrink-0" />
                    {new Date(confirmedBooking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span>{selectedService.duration_minutes} min</span>
                  </div>
                  {selectedService.location && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      {(() => { const Icon = getLocationIcon(selectedService.location_type); return <Icon className="h-4 w-4 shrink-0" />; })()}
                      <span>{selectedService.location}</span>
                    </div>
                  )}
                  {confirmedBooking.meet_link && (
                    <a
                      href={confirmedBooking.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <Video className="h-4 w-4 shrink-0" />
                      {confirmedBooking.meet_link.includes('teams.microsoft') ? 'Join Microsoft Teams' : confirmedBooking.meet_link.includes('zoom.us') ? 'Join Zoom Meeting' : 'Join Google Meet'}
                    </a>
                  )}
                </div>

                {/* Part 2 prompt */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Bell className="h-4 w-4" style={{ color: accentColor }} />
                    <span className="font-semibold text-sm">Reminder set</span>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    {reminderSummary.map(({ channel, time }) => {
                      const Icon = REMINDER_CHANNELS.find((c) => c.id === channel)?.icon ?? Mail;
                      return (
                        <div key={`${channel}-${time}`} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: accentColor + '22' }}>
                            <Icon className="h-4 w-4" style={{ color: accentColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{reminderChannelLabel(channel)} reminder</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{reminderTimeLabel(time)}</p>
                          </div>
                          <Check className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
                        </div>
                      );
                    })}
                    {!remindersDone && (
                      <>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Want to change your reminders — add SMS, WhatsApp, voice, or different times?</p>
                        <button
                          onClick={() => setStep('reminders')}
                          className="w-full py-2.5 text-sm font-semibold rounded-lg border-2 transition-all hover:opacity-90"
                          style={{ borderColor: accentColor, color: accentColor }}>
                          Customize reminders
                        </button>
                        <button
                          onClick={() => setRemindersDone(true)}
                          className="w-full py-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                          No thanks, I'm done
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {remindersDone && (
                  <div className="mt-6 text-center">
                    {(selectedService.allow_cancellation || selectedService.allow_reschedule) && (
                      <p className="text-xs text-slate-400 mb-4">
                        Need to cancel or reschedule? Check your confirmation email for links.
                      </p>
                    )}
                    {host?.plan === 'free' ? (
                      <div className="mt-2 pt-5 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Scheduling powered by</p>
                        <Link
                          to="/"
                          className="inline-flex flex-col items-center gap-2 group"
                        >
                          <img src="/Screenshot_2026-04-29_at_2.49.32_PM.png" alt="Pin on It" className="h-6 w-auto opacity-70 group-hover:opacity-100 transition-opacity" />
                          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-500 group-hover:underline transition-all">
                            Get your free scheduling page →
                          </span>
                        </Link>
                      </div>
                    ) : (
                      <Link to="/" className="inline-flex items-center gap-1.5 opacity-30 hover:opacity-60 transition-opacity">
                        <img src="/Screenshot_2026-04-29_at_2.49.32_PM.png" alt="Pin on It" className="h-5 w-auto" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 'reminders' && confirmedBooking && selectedService && (
              <ReminderWizard
                accentColor={accentColor}
                selectedChannels={selectedChannels}
                setSelectedChannels={setSelectedChannels}
                selectedTimes={selectedTimes}
                setSelectedTimes={setSelectedTimes}
                saving={savingReminders}
                onBack={() => setStep('confirmed')}
                onSave={handleSaveReminders}
                guestPhone={confirmedBooking.guest_phone ?? phone}
                smsOptIn={smsOptIn}
                setSmsOptIn={setSmsOptIn}
                whatsappOptIn={whatsappOptIn}
                setWhatsappOptIn={setWhatsappOptIn}
              />
            )}
          </div>
        </div>
        </div>
      </main>
      {calendlyStyle && host?.plan === 'free' && (
        <Link
          to="/"
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-slate-700 transition-colors text-xs font-medium"
        >
          <img src="/Screenshot_2026-04-29_at_2.49.32_PM.png" alt="PinOnIt" className="h-3.5 w-auto opacity-70" />
          Powered by PinOnIt
        </Link>
      )}
      <footer className={`py-4 px-6 ${calendlyStyle ? 'bg-white border-t border-slate-100' : 'border-t'}`} style={calendlyStyle ? undefined : { borderColor: pageBorderColor, backgroundColor: pageSurfaceColor }}>
        {host?.plan === 'free' && !calendlyStyle && (
          <div className="flex items-center justify-center gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors group"
            >
              <img src="/Screenshot_2026-04-29_at_2.49.32_PM.png" alt="Pin on It" className="h-4 w-auto opacity-70 group-hover:opacity-100 transition-opacity" />
              <span className="text-xs font-semibold text-slate-600">
                Powered by PinOnIt — free scheduling for anyone
              </span>
              <ArrowRight className="h-3 w-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-slate-400">
          <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
          <span className="hidden sm:inline">·</span>
          <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
          <span className="hidden sm:inline">·</span>
          <Link to="/sms-consent" className="hover:text-slate-600 transition-colors">SMS Consent</Link>
          {!calendlyStyle && (
            <>
              <span className="hidden sm:inline">|</span>
              <span>&copy; 2026 PinOnIt. All rights reserved.</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
