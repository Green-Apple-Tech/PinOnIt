import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Service, BookingQuestion, MeetingType, RecurrenceFrequency } from '../lib/types';
import { getRecurrenceEndType, type RecurrenceEndType } from '../lib/recurring';
import { resolveDefaultReminderChannel } from '../lib/reminderChannels';
import { computeSingleUseExpiresAtForProfile, formatLinkExpiryHint, formatSingleUseExpiryLabel, isSingleUseLinksEnabled } from '../lib/singleUseLinks';
import { LOCATION_TYPES, MEETING_TYPE_META } from '../lib/types';
import {
  Plus, Trash2, X, Check, Loader2, MapPin, Clock, Settings2, MessageSquare,
  DollarSign, Copy, Smartphone, Mail, Pencil, ExternalLink, Link2, AlertCircle,
  Search, CreditCard, QrCode, Zap, Bell, ChevronDown, Shield, HelpCircle, PhoneCall,
} from 'lucide-react';
import { QRModal } from '../components/QRModal';
import { ColorSwatchRow } from '../components/ColorSwatchRow';

interface SingleUseLink {
  id: string; host_id: string; service_id: string; token: string;
  label: string | null; used: boolean; used_at: string | null;
  booking_id: string | null; expires_at: string | null; created_at: string;
}

interface ServiceReminder {
  id: string; host_id: string; service_id: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'voice';
  timing_offset_minutes: number; label: string; is_active: boolean; created_at: string;
}


type ServiceTab = 'basic' | 'scheduling' | 'location' | 'reminders' | 'questions' | 'policy' | 'payment';

const DEFAULT_SERVICE = {
  name: '', description: '', duration_minutes: 30, price_cents: 0, color: '#5864C6',
  is_active: true, meeting_type: 'one_on_one' as MeetingType, max_invitees: null as number | null,
  buffer_before_minutes: 0, buffer_after_minutes: 0, min_notice_hours: 1,
  max_bookings_per_day: null as number | null, booking_window_days: 60,
  slot_increment_minutes: 30, allow_cancellation: true, allow_reschedule: true,
  cancellation_policy: '', confirmation_redirect_url: null as string | null,
  location: '', location_type: 'video' as Service['location_type'],
  payment_provider: 'none' as Service['payment_provider'],
  paypal_me_link: null as string | null, paypal_currency: 'USD',
  venmo_handle: null as string | null,
  cashapp_handle: null as string | null,
  zelle_handle: null as string | null,
  payment_methods: [] as string[],
  require_terms: false, require_nda: false,
  show_description_on_booking_page: true, show_description_on_paid_booking: true,
  is_recurring: false,
  recurrence_frequency: null as RecurrenceFrequency | null,
  recurrence_end_date: null as string | null,
  recurrence_end_occurrences: null as number | null,
  max_recurring_clients: 1,
};
type FormState = typeof DEFAULT_SERVICE;

// Preset reminder options
const REMINDER_PRESETS = [
  { label: '15 min before', offset: -15 },
  { label: '30 min before', offset: -30 },
  { label: '1 hour before', offset: -60 },
  { label: '2 hours before', offset: -120 },
  { label: '1 day before', offset: -1440 },
  { label: '2 days before', offset: -2880 },
  { label: '1 week before', offset: -10080 },
];
const CHANNELS = [
  { key: 'email' as const, label: 'Email', icon: Mail, color: 'text-blue-500' },
  { key: 'sms' as const, label: 'SMS', icon: Smartphone, color: 'text-indigo-600' },
  { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageSquare, color: 'text-indigo-600' },
  { key: 'voice' as const, label: 'Voice Call', icon: PhoneCall, color: 'text-violet-500' },
];

function formatPrice(cents: number) {
  if (!cents) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

function buildPaymentMethods(form: FormState): string[] {
  const methods: string[] = [];
  if (form.venmo_handle?.trim()) methods.push('venmo');
  if (form.cashapp_handle?.trim()) methods.push('cashapp');
  if (form.zelle_handle?.trim()) methods.push('zelle');
  return methods;
}

const inputCls = 'w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition text-base md:text-sm';

// ── How-to modal ─────────────────────────────────────────────────────────────

function HowToModal({ title, steps, onClose }: { title: string; steps: string[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
              <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">Got it</button>
        </div>
      </div>
    </div>
  );
}

// ── Payment tab component ─────────────────────────────────────────────────────

const PAYPAL_CURRENCIES = ['USD','EUR','GBP','CAD','AUD','JPY','CHF','MXN','BRL','INR','SGD','HKD','NZD','NOK','SEK','DKK'];

const PAYPAL_HOW_TO_STEPS = [
  'Go to paypal.com and log in to your account.',
  'Click your profile icon in the top-right corner, then select "PayPal.me".',
  'Copy your personal link — it looks like paypal.me/yourname.',
  'Paste it in the field above.',
];

const VENMO_HOW_TO_STEPS = [
  'Open the Venmo app on your phone and log in.',
  'Tap the profile icon in the bottom-right corner.',
  'Your @username is shown at the top of your profile page.',
  'Type it in the field above (including the @ symbol).',
];

const CASHAPP_HOW_TO_STEPS = [
  'Open the Cash App on your phone and log in.',
  'Tap the profile icon in the top-right corner.',
  'Your $Cashtag is shown at the top — it starts with a $.',
  'Type it in the field above (including the $ symbol).',
];

const ZELLE_HOW_TO_STEPS = [
  'Open your banking app or the Zelle app and log in.',
  'Navigate to the Zelle section — usually under "Send Money".',
  'Your Zelle contact is the phone number or email linked to your account.',
  'Enter it in the field above.',
];

type HowToKey = 'paypal' | 'venmo' | 'cashapp' | 'zelle' | null;

function PaymentTab({
  form,
  setField,
  priceStr,
}: {
  form: typeof DEFAULT_SERVICE;
  setField: (k: keyof typeof DEFAULT_SERVICE, v: unknown) => void;
  priceStr: string;
}) {
  const [howTo, setHowTo] = useState<HowToKey>(null);

  const noPaymentSelected = form.payment_provider === 'none';
  const paypalSelected = form.payment_provider === 'paypal';
  const p2pSelected = form.payment_provider === 'p2p';

  const hasAnyP2P = !!(form.venmo_handle || form.cashapp_handle || form.zelle_handle);

  return (
    <div className="space-y-5">
      {howTo === 'paypal' && (
        <HowToModal title="How to find your PayPal.me link" steps={PAYPAL_HOW_TO_STEPS} onClose={() => setHowTo(null)} />
      )}
      {howTo === 'venmo' && (
        <HowToModal title="How to find your Venmo @username" steps={VENMO_HOW_TO_STEPS} onClose={() => setHowTo(null)} />
      )}
      {howTo === 'cashapp' && (
        <HowToModal title="How to find your Cash App $Cashtag" steps={CASHAPP_HOW_TO_STEPS} onClose={() => setHowTo(null)} />
      )}
      {howTo === 'zelle' && (
        <HowToModal title="How to find your Zelle contact" steps={ZELLE_HOW_TO_STEPS} onClose={() => setHowTo(null)} />
      )}

      {/* 3 selection cards */}
      <div className="space-y-2.5">
        {/* Card: No Payment */}
        <button
          type="button"
          onClick={() => setField('payment_provider', 'none')}
          className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${noPaymentSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50'}`}
        >
          <div className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center ${noPaymentSelected ? 'border-brand-500' : 'border-gray-300 dark:border-slate-600'}`}>
            {noPaymentSelected && <div className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${noPaymentSelected ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>No Payment</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Free booking — no payment required</p>
          </div>
        </button>

        {/* Card: PayPal */}
        <button
          type="button"
          onClick={() => setField('payment_provider', 'paypal')}
          className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${paypalSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50'}`}
        >
          <div className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center ${paypalSelected ? 'border-brand-500' : 'border-gray-300 dark:border-slate-600'}`}>
            {paypalSelected && <div className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${paypalSelected ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>PayPal</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Guest sends payment via your PayPal.me link</p>
          </div>
        </button>

        {/* Card: Peer-to-Peer */}
        <button
          type="button"
          onClick={() => setField('payment_provider', 'p2p')}
          className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${p2pSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50'}`}
        >
          <div className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center ${p2pSelected ? 'border-brand-500' : 'border-gray-300 dark:border-slate-600'}`}>
            {p2pSelected && <div className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${p2pSelected ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>Peer-to-Peer</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Venmo, Cash App, or Zelle — guest sends directly to you</p>
          </div>
        </button>
      </div>

      {/* No-price warning (shown for any paid method) */}
      {(paypalSelected || p2pSelected) && !priceStr && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">Set a price in the Basic tab so guests know how much to send.</p>
        </div>
      )}

      {/* PayPal fields */}
      {paypalSelected && (
        <div className="space-y-4 pl-0 pt-1">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Your PayPal.me link</label>
              <button type="button" onClick={() => setHowTo('paypal')} className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                <HelpCircle className="h-3.5 w-3.5" /> How to find this
              </button>
            </div>
            <input
              type="url"
              value={form.paypal_me_link ?? ''}
              onChange={(e) => setField('paypal_me_link', e.target.value || null)}
              placeholder="paypal.me/yourname"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1.5">Currency</label>
            <select value={form.paypal_currency} onChange={(e) => setField('paypal_currency', e.target.value)} className={inputCls}>
              {PAYPAL_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* P2P handles — always available for guest payment options */}
      <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Peer-to-peer payment handles</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Optional. Shown to guests on the booking page as Venmo, Cash App, or Zelle options.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1.5">Venmo handle</label>
          <input
            type="text"
            value={form.venmo_handle ?? ''}
            onChange={(e) => setField('venmo_handle', e.target.value || null)}
            placeholder="@yourhandle"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1.5">Cash App handle</label>
          <input
            type="text"
            value={form.cashapp_handle ?? ''}
            onChange={(e) => setField('cashapp_handle', e.target.value || null)}
            placeholder="$yourhandle"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1.5">Zelle</label>
          <input
            type="text"
            value={form.zelle_handle ?? ''}
            onChange={(e) => setField('zelle_handle', e.target.value || null)}
            placeholder="email or phone number"
            className={inputCls}
          />
        </div>
        {p2pSelected && !hasAnyP2P && (
          <p className="text-xs text-gray-400 dark:text-slate-500">Enter at least one handle when using Peer-to-Peer as the primary payment method.</p>
        )}
      </div>
    </div>
  );
}

export function ServicesPage() {
  const { profile, subscription } = useAuth();
  const isPro = (subscription?.plan ?? profile?.plan ?? 'free') === 'pro';
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_SERVICE });
  const [priceStr, setPriceStr] = useState('');
  const [activeTab, setActiveTab] = useState<ServiceTab>('basic');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedShare, setExpandedShare] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [qrService, setQrService] = useState<Service | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [singleUsePanel, setSingleUsePanel] = useState<string | null>(null);
  const [singleUseLinks, setSingleUseLinks] = useState<Record<string, SingleUseLink[]>>({});
  const [generatingLink, setGeneratingLink] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const buildBookingUrl = (svc: Service) =>
    profile?.slug ? `${window.location.origin}/${profile.slug}/${svc.id}` : `${window.location.origin}/book/${svc.id}`;

  const buildShareMessages = (svc: Service) => {
    const bookingUrl = buildBookingUrl(svc);
    const hostName = profile?.full_name || 'me';
    return {
      bookingUrl,
      smsMsg: `Hi! Book a ${svc.name} (${svc.duration_minutes} min) with ${hostName} here: ${bookingUrl}`,
      waMsg: `Hi! You can book a *${svc.name}* (${svc.duration_minutes} min) with ${hostName} here:\n${bookingUrl}`,
      emailSubject: `Book a ${svc.name} with ${hostName}`,
      emailBody: `Hi,\n\nYou can schedule a ${svc.name} (${svc.duration_minutes} min) with ${hostName} using this link:\n\n${bookingUrl}\n\nLooking forward to connecting!`,
    };
  };

  const buildSingleUseUrl = (token: string) => `${window.location.origin}/s/${token}`;

  const loadSingleUseLinks = async (serviceId: string) => {
    if (!profile) return;
    const { data } = await supabase.from('single_use_links').select('*').eq('service_id', serviceId).eq('host_id', profile.id).order('created_at', { ascending: false });
    setSingleUseLinks((prev) => ({ ...prev, [serviceId]: (data as SingleUseLink[]) ?? [] }));
  };

  const openSingleUsePanel = async (serviceId: string) => {
    if (singleUsePanel === serviceId) {
      setSingleUsePanel(null);
      return;
    }
    setSingleUsePanel(serviceId);
    await loadSingleUseLinks(serviceId);
  };

  const generateSingleUseLink = async (serviceId: string) => {
    if (!profile) return;
    setGeneratingLink(true);
    const expiresAt = profile && isSingleUseLinksEnabled(profile)
      ? computeSingleUseExpiresAtForProfile(profile)
      : null;
    const { data } = await supabase.from('single_use_links').insert({
      host_id: profile.id,
      service_id: serviceId,
      label: newLinkLabel.trim() || null,
      expires_at: expiresAt,
    }).select().maybeSingle();
    if (data) {
      setSingleUseLinks((prev) => ({ ...prev, [serviceId]: [data as SingleUseLink, ...(prev[serviceId] ?? [])] }));
    }
    setNewLinkLabel('');
    setGeneratingLink(false);
  };

  // Calendar
  const [connectedCalendars, setConnectedCalendars] = useState<{ id: string; provider: string; calendar_name: string; provider_account_email: string }[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  // Questions
  const [questions, setQuestions] = useState<BookingQuestion[]>([]);
  const [newQLabel, setNewQLabel] = useState('');
  const [newQType, setNewQType] = useState<BookingQuestion['field_type']>('text');
  const [newQRequired, setNewQRequired] = useState(false);
  const [newQOptions, setNewQOptions] = useState('');
  const [addingQ, setAddingQ] = useState(false);
  const [savingQ, setSavingQ] = useState(false);

  // Reminders
  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [addingReminder, setAddingReminder] = useState(false);
  const [recurrenceEndType, setRecurrenceEndType] = useState<RecurrenceEndType>('never');
  const [newReminderOffsets, setNewReminderOffsets] = useState<Set<number>>(new Set([-1440]));
  const [newReminderChannels, setNewReminderChannels] = useState<Set<'email' | 'sms' | 'whatsapp' | 'voice'>>(() => new Set(['whatsapp']));
  const [savingReminder, setSavingReminder] = useState(false);
  const [customOffset, setCustomOffset] = useState(false);
  const [customOffsetVal, setCustomOffsetVal] = useState('');

  useEffect(() => {
    if (!profile) return;
    const ch = resolveDefaultReminderChannel(profile.default_reminder_channel);
    if (ch === 'voice') {
      setNewReminderChannels(new Set(['whatsapp']));
    } else {
      setNewReminderChannels(new Set([ch as 'email' | 'sms' | 'whatsapp']));
    }
  }, [profile?.default_reminder_channel]);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from('services').select('*').eq('host_id', profile.id).order('created_at', { ascending: true }),
      supabase.from('connected_calendars').select('id, provider, calendar_name, provider_account_email').eq('host_id', profile.id),
    ]).then(([svcRes, calRes]) => {
      setServices((svcRes.data as Service[]) ?? []);
      setConnectedCalendars((calRes.data as { id: string; provider: string; calendar_name: string; provider_account_email: string }[]) ?? []);
      setLoading(false);
    });
  }, [profile]);

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeForm(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const openNew = (meetingType?: MeetingType) => {
    setForm({ ...DEFAULT_SERVICE, ...(meetingType ? { meeting_type: meetingType } : {}) });
    setRecurrenceEndType('never');
    setPriceStr('');
    setEditingId('new');
    setActiveTab('basic');
    setQuestions([]);
    setReminders([]);
    setSelectedCalendarIds([]);
    setAddingQ(false);
    setAddingReminder(false);
  };

  useEffect(() => {
    const newType = searchParams.get('new') as MeetingType | null;
    const editId = searchParams.get('edit');
    if (!loading) {
      if (newType) {
        const valid: MeetingType[] = ['one_on_one', 'group', 'one_off'];
        if (valid.includes(newType)) { openNew(newType); setSearchParams({}, { replace: true }); }
      } else if (editId) {
        const svc = services.find((s) => s.id === editId);
        if (svc) { openEdit(svc); setSearchParams({}, { replace: true }); }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, services]);

  const openEdit = async (svc: Service) => {
    setForm({
      name: svc.name, description: svc.description ?? '',
      duration_minutes: svc.duration_minutes, price_cents: svc.price_cents,
      color: svc.color, is_active: svc.is_active,
      meeting_type: svc.meeting_type ?? 'one_on_one', max_invitees: svc.max_invitees ?? null,
      buffer_before_minutes: svc.buffer_before_minutes ?? 0,
      buffer_after_minutes: svc.buffer_after_minutes ?? 0,
      min_notice_hours: svc.min_notice_hours ?? 1,
      max_bookings_per_day: svc.max_bookings_per_day ?? null,
      booking_window_days: svc.booking_window_days ?? 60,
      slot_increment_minutes: svc.slot_increment_minutes ?? 30,
      allow_cancellation: svc.allow_cancellation ?? true,
      allow_reschedule: svc.allow_reschedule ?? true,
      cancellation_policy: svc.cancellation_policy ?? '',
      confirmation_redirect_url: svc.confirmation_redirect_url ?? null,
      location: svc.location ?? '', location_type: svc.location_type ?? 'video',
      payment_provider: ((svc.payment_provider as string) === 'stripe' ? 'none' : (svc.payment_provider ?? 'none')) as Service['payment_provider'],
      paypal_me_link: (svc as any).paypal_me_link ?? null,
      paypal_currency: svc.paypal_currency ?? 'USD',
      venmo_handle: (svc as Service).venmo_handle ?? null,
      cashapp_handle: (svc as Service).cashapp_handle ?? (svc as Service).cashapp_tag ?? null,
      zelle_handle: (svc as Service).zelle_handle ?? (svc as Service).zelle_contact ?? null,
      payment_methods: (svc as any).payment_methods ?? [],
      require_terms: (svc as any).require_terms ?? false,
      require_nda: (svc as any).require_nda ?? false,
      show_description_on_booking_page: (svc as any).show_description_on_booking_page ?? true,
      show_description_on_paid_booking: (svc as any).show_description_on_paid_booking ?? true,
      is_recurring: svc.is_recurring ?? false,
      recurrence_frequency: svc.recurrence_frequency ?? null,
      recurrence_end_date: svc.recurrence_end_date ?? null,
      recurrence_end_occurrences: svc.recurrence_end_occurrences ?? null,
      max_recurring_clients: svc.max_recurring_clients ?? 1,
    });
    setRecurrenceEndType(getRecurrenceEndType(svc.recurrence_end_date, svc.recurrence_end_occurrences));
    setPriceStr(svc.price_cents ? (svc.price_cents / 100).toFixed(2) : '');
    setEditingId(svc.id);
    setActiveTab('basic');
    setSelectedCalendarIds((svc as any).booking_calendar_ids ?? []);
    setAddingQ(false);
    setAddingReminder(false);
    const [questionsRes, remindersRes] = await Promise.all([
      supabase.from('booking_questions').select('*').eq('service_id', svc.id).order('sort_order'),
      supabase.from('service_reminders').select('*').eq('service_id', svc.id).order('timing_offset_minutes'),
    ]);
    setQuestions((questionsRes.data as BookingQuestion[]) ?? []);
    setReminders((remindersRes.data as ServiceReminder[]) ?? []);
  };

  const closeForm = () => {
    setEditingId(null);
    setAddingQ(false);
    setAddingReminder(false);
    setNewQLabel('');
    setNameError('');
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!form.name.trim()) { setNameError('Event name is required.'); return; }
    if (form.is_recurring && !form.recurrence_frequency) { setNameError('Select a recurrence frequency for recurring services.'); return; }
    setNameError('');
    setSaving(true);
    const priceCents = priceStr ? Math.round(parseFloat(priceStr) * 100) : 0;
    const payload = {
      ...form,
      price_cents: priceCents,
      payment_methods: buildPaymentMethods(form),
      booking_calendar_ids: selectedCalendarIds,
      is_recurring: form.is_recurring,
      recurrence_frequency: form.is_recurring ? form.recurrence_frequency : null,
      recurrence_end_date: form.is_recurring && recurrenceEndType === 'date' ? form.recurrence_end_date : null,
      recurrence_end_occurrences: form.is_recurring && recurrenceEndType === 'occurrences' ? form.recurrence_end_occurrences : null,
      max_recurring_clients: form.is_recurring ? (form.max_recurring_clients ?? 1) : null,
    };

    if (editingId === 'new') {
      const { data } = await supabase.from('services').insert({ ...payload, host_id: profile.id }).select().maybeSingle();
      if (data) setServices((prev) => [...prev, data as Service]);
    } else if (editingId) {
      const { data } = await supabase.from('services').update(payload).eq('id', editingId).select().maybeSingle();
      if (data) setServices((prev) => prev.map((s) => (s.id === editingId ? (data as Service) : s)));
    }
    closeForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) closeForm();
  };

  const handleToggleActive = async (svc: Service) => {
    const { data } = await supabase.from('services').update({ is_active: !svc.is_active }).eq('id', svc.id).select().maybeSingle();
    if (data) setServices((prev) => prev.map((s) => (s.id === svc.id ? (data as Service) : s)));
  };

  const handleAddQuestion = async () => {
    if (!profile || !newQLabel || !editingId || editingId === 'new') return;
    setSavingQ(true);
    const opts = newQType === 'select' && newQOptions ? newQOptions.split('\n').map((o) => o.trim()).filter(Boolean) : null;
    const { data } = await supabase.from('booking_questions').insert({
      service_id: editingId, host_id: profile.id, label: newQLabel, field_type: newQType,
      options: opts, required: newQRequired, sort_order: questions.length,
    }).select().maybeSingle();
    if (data) setQuestions((prev) => [...prev, data as BookingQuestion]);
    setNewQLabel(''); setNewQType('text'); setNewQRequired(false); setNewQOptions(''); setAddingQ(false);
    setSavingQ(false);
  };

  const handleDeleteQuestion = async (qId: string) => {
    await supabase.from('booking_questions').delete().eq('id', qId);
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const handleAddReminder = async () => {
    if (!profile || !editingId || editingId === 'new') return;
    setSavingReminder(true);
    const customOffsetNum = customOffset ? -(Math.abs(parseInt(customOffsetVal) || 60)) : null;
    const offsets = customOffsetNum !== null ? [customOffsetNum] : Array.from(newReminderOffsets);
    const rows = Array.from(newReminderChannels).flatMap((ch) =>
      offsets.map((offset) => {
        const preset = REMINDER_PRESETS.find((p) => p.offset === offset);
        const label = preset?.label ?? `${Math.abs(offset)} min before`;
        return { service_id: editingId, host_id: profile.id, channel: ch, timing_offset_minutes: offset, label };
      })
    );
    const { data } = await supabase.from('service_reminders').insert(rows).select();
    if (data) setReminders((prev) => [...prev, ...(data as ServiceReminder[])]);
    setAddingReminder(false);
    setCustomOffset(false); setCustomOffsetVal('');
    setSavingReminder(false);
  };

  const handleDeleteReminder = async (rId: string) => {
    await supabase.from('service_reminders').delete().eq('id', rId);
    setReminders((prev) => prev.filter((r) => r.id !== rId));
  };

  const handleToggleReminder = async (r: ServiceReminder) => {
    const { data } = await supabase.from('service_reminders').update({ is_active: !r.is_active }).eq('id', r.id).select().maybeSingle();
    if (data) setReminders((prev) => prev.map((x) => x.id === r.id ? data as ServiceReminder : x));
  };

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  const tabs: { key: ServiceTab; label: string; icon: typeof Clock | null }[] = [
    { key: 'basic', label: 'Basic', icon: Settings2 },
    { key: 'scheduling', label: 'Scheduling', icon: Clock },
    { key: 'location', label: 'Location', icon: MapPin },
    { key: 'reminders', label: 'Reminders', icon: Bell },
    { key: 'questions', label: 'Questions', icon: MessageSquare },
    { key: 'policy', label: 'Policy', icon: null },
    { key: 'payment', label: 'Payment', icon: CreditCard },
  ];

  const filteredServices = services.filter(
    (svc) => !search.trim() || svc.name.toLowerCase().includes(search.toLowerCase())
  );

  const drawerOpen = editingId !== null;
  const editingSvc = editingId && editingId !== 'new' ? services.find((s) => s.id === editingId) : null;

  return (
    <main className="p-6 md:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event types</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Manage your meeting types and scheduling links.</p>
        </div>
        <button
          onClick={() => openNew()}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-all shadow-sm"
        >
          <Plus className="h-4 w-4" /> New event type
        </button>
      </div>

      {/* Pro upgrade banner */}
      {!isPro && services.length >= 1 && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
          <Zap className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Unlimited event types is a Pro feature</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">You're on the Free plan (1 event type). Upgrade for $6/mo, cancel anytime.</p>
          </div>
          <a href="/dashboard/billing" className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors">
            <Zap className="h-3.5 w-3.5" /> Upgrade
          </a>
        </div>
      )}

      {/* Search bar */}
      {!loading && services.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search event types..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
        </div>
      )}

      {/* Event types list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((svc) => {
            const share = buildShareMessages(svc);
            const isShareExpanded = expandedShare === svc.id;
            const isEditing = editingId === svc.id;
            return (
              <div key={svc.id} className={`bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden transition-all ${
                isEditing ? 'border-brand-500 shadow-md' : 'border-gray-200 dark:border-slate-800 hover:shadow-sm hover:border-gray-300 dark:hover:border-slate-700'
              }`}>
                {/* Color bar */}
                <div className="h-1" style={{ backgroundColor: svc.color }} />

                <div className="px-4 py-4 flex items-center gap-3">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(svc)}
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${svc.is_active ? 'bg-brand-600 border-brand-600' : 'border-gray-300 dark:border-slate-600'}`}
                    title={svc.is_active ? 'Click to deactivate' : 'Click to activate'}
                  >
                    {svc.is_active && <Check className="h-3 w-3 text-white" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{svc.name}</p>
                      {svc.meeting_type && svc.meeting_type !== 'one_on_one' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${MEETING_TYPE_META[svc.meeting_type]?.badge ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {MEETING_TYPE_META[svc.meeting_type]?.label ?? svc.meeting_type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {svc.duration_minutes} min
                      {(svc.buffer_before_minutes || svc.buffer_after_minutes) ? ` + ${(svc.buffer_before_minutes ?? 0) + (svc.buffer_after_minutes ?? 0)}min buffer` : ''}
                      {' · '}{formatPrice(svc.price_cents)}
                      {' · '}{LOCATION_TYPES[svc.location_type] ?? svc.location_type}
                    </p>
                    {!svc.is_active && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-full">Inactive</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {/* Edit button — prominent inline */}
                    <button
                      onClick={() => openEdit(svc)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all border ${
                        isEditing
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30'
                      }`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => copyText(share.bookingUrl, `url-${svc.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-slate-700 rounded-full text-gray-700 dark:text-slate-300 hover:border-gray-400 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                    >
                      {copiedKey === `url-${svc.id}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
                      {copiedKey === `url-${svc.id}` ? 'Copied!' : 'Copy link'}
                    </button>
                    {profile && isSingleUseLinksEnabled(profile) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void openSingleUsePanel(svc.id); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-full transition-all ${
                          singleUsePanel === svc.id
                            ? 'border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20'
                            : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                        }`}
                      >
                        <Zap className="h-3.5 w-3.5" /> Single-use
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrService(svc); setQrUrl(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-slate-700 rounded-full text-gray-700 dark:text-slate-300 hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all"
                    >
                      <QrCode className="h-3.5 w-3.5" /> QR
                    </button>
                    <a
                      href={share.bookingUrl} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                      title="View booking page"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    {/* Share toggle */}
                    <button
                      onClick={() => setExpandedShare(isShareExpanded ? null : svc.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                      title="Share messages"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isShareExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Single-use links panel */}
                {singleUsePanel === svc.id && (
                  <div className="border-t border-gray-100 dark:border-slate-800 px-5 pb-5 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Single-use links</p>
                      </div>
                      <button onClick={() => setSingleUsePanel(null)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 -mt-2">
                      Each link works exactly once. After booking, the link is disabled automatically.
                      {formatLinkExpiryHint(profile ?? {}) && (
                        <> Links also expire {formatLinkExpiryHint(profile ?? {})}.</>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <input type="text" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Label (optional)" onKeyDown={(e) => e.key === 'Enter' && void generateSingleUseLink(svc.id)}
                        className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
                      <button onClick={() => void generateSingleUseLink(svc.id)} disabled={generatingLink} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0">
                        {generatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Generate
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(singleUseLinks[svc.id] ?? []).length === 0 && <p className="text-xs text-gray-400 text-center py-3">No links yet.</p>}
                      {(singleUseLinks[svc.id] ?? []).map((link) => {
                        const url = buildSingleUseUrl(link.token);
                        return (
                          <div key={link.id} className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs ${link.used ? 'opacity-60 bg-gray-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'} border-gray-200 dark:border-slate-700`}>
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${link.used ? 'bg-gray-200 dark:bg-slate-700' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                              {link.used ? <Check className="h-3 w-3 text-gray-500" /> : <Zap className="h-3 w-3 text-amber-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              {link.label && <p className="font-semibold text-gray-800 dark:text-slate-200 truncate">{link.label}</p>}
                              <p className="font-mono text-gray-400 dark:text-slate-500 truncate">{url}</p>
                              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{formatSingleUseExpiryLabel(link.expires_at, link.used)}</p>
                            </div>
                            {!link.used && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => copyText(url, `sul-${link.id}`)} className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-brand-600 transition-colors">
                                  {copiedKey === `sul-${link.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                </button>
                                <button onClick={() => { setQrService(svc); setQrUrl(url); }} className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-brand-600 transition-colors">
                                  <QrCode className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            <button onClick={() => { supabase.from('single_use_links').delete().eq('id', link.id); setSingleUseLinks((p) => ({ ...p, [svc.id]: (p[svc.id] ?? []).filter((l) => l.id !== link.id) })); }} className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors shrink-0">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Share messages panel */}
                {isShareExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-800 px-5 pb-5 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Share via</p>
                    {[
                      { key: `sms-${svc.id}`, label: 'SMS', icon: Smartphone, iconColor: 'text-indigo-600', text: share.smsMsg },
                      { key: `wa-${svc.id}`, label: 'WhatsApp', icon: MessageSquare, iconColor: 'text-indigo-600', text: share.waMsg },
                    ].map(({ key, label, icon: Icon, iconColor, text }) => (
                      <div key={key} className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5"><Icon className={`h-3.5 w-3.5 ${iconColor}`} /><span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{label}</span></div>
                          <button onClick={() => copyText(text, key)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-gray-300 transition-colors">
                            {copiedKey === key ? <><Check className="h-3 w-3 text-emerald-500" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{text}</p>
                      </div>
                    ))}
                    <div className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-brand-500" /><span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Email</span></div>
                        <div className="flex gap-1">
                          <button onClick={() => copyText(share.emailSubject, `subj-${svc.id}`)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-600 hover:border-gray-300 transition-colors">{copiedKey === `subj-${svc.id}` ? 'Copied!' : 'Subject'}</button>
                          <button onClick={() => copyText(share.emailBody, `body-${svc.id}`)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-600 hover:border-gray-300 transition-colors">{copiedKey === `body-${svc.id}` ? 'Copied!' : 'Body'}</button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-1 font-semibold">Subject: {share.emailSubject}</p>
                      <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{share.emailBody}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredServices.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
              <div className="h-12 w-12 bg-brand-50 dark:bg-brand-950/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              </div>
              {search.trim() ? (
                <><p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No results for "{search}"</p><p className="text-xs text-gray-400">Try a different search term.</p></>
              ) : (
                <><p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No event types yet</p><p className="text-xs text-gray-400 mb-4">Create your first meeting type to start taking meetings.</p><button onClick={() => openNew()} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-all"><Plus className="h-4 w-4" /> Create event type</button></>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Drawer / Full-screen modal ─────────────────────────────────────── */}

      {/* Desktop backdrop */}
      {drawerOpen && (
        <div
          className="hidden md:block fixed inset-0 bg-black/40 dark:bg-black/60 z-40 backdrop-blur-sm"
          onClick={closeForm}
        />
      )}

      {/* On mobile: fixed inset-0 full-screen modal (no animation).
          On md+: right-side slide-over drawer with translate animation. */}
      {drawerOpen && (
        <div
          ref={drawerRef}
          className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col
                     md:inset-auto md:top-0 md:right-0 md:h-full md:w-[75vw] md:max-w-[1100px]
                     md:shadow-2xl md:translate-x-0"
        >
          {/* ── Header — sticky on mobile ── */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {editingSvc && <div className="h-3 w-3 rounded-full shrink-0 bg-brand-500" />}
              <h2 className="font-bold text-gray-900 dark:text-white text-lg truncate">
                {editingId === 'new' ? 'New event type' : (editingSvc?.name ?? 'Edit event type')}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {editingId !== 'new' && editingSvc && (
                <button
                  onClick={() => handleDelete(editingSvc.id)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  title="Delete event type"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={closeForm}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Tab bar — horizontally scrollable ── */}
          <div className="flex border-b border-gray-100 dark:border-slate-800 overflow-x-auto shrink-0 scrollbar-hide bg-white dark:bg-slate-950">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors min-h-[48px] ${
                  activeTab === t.key
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t.icon && <t.icon className="h-4 w-4 shrink-0" />}{t.label}
              </button>
            ))}
          </div>

          {/* ── Scrollable content — pb-24 on mobile to clear sticky save button ── */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 pb-24 md:pb-6">

            {/* ── BASIC ── */}
            {activeTab === 'basic' && (
              <div className="space-y-5 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-5 md:space-y-0 items-start">
                {/* LEFT COLUMN — name, description, meeting type */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Event name *</label>
                    <input type="text" value={form.name} onChange={(e) => { setField('name', e.target.value); if (nameError) setNameError(''); }}
                      placeholder="e.g. 30 Minute Consultation"
                      className={`${inputCls} ${nameError ? 'border-red-400 focus:ring-red-400' : ''}`} />
                    {nameError && <p className="text-sm text-red-500 mt-1">{nameError}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                    <textarea value={form.description} onChange={(e) => setField('description', e.target.value)}
                      rows={4} placeholder="What guests can expect..." className={`${inputCls} resize-none`} />
                    <div className="mt-2 space-y-1.5">
                      {[
                        { key: 'show_description_on_booking_page' as const, label: 'Show description on public booking page' },
                        { key: 'show_description_on_paid_booking' as const, label: 'Show description on paid booking page' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={form[key]}
                            onChange={(e) => setField(key, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          />
                          <span className="text-sm text-gray-500 dark:text-slate-400">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Meeting type</label>
                    <div className="flex flex-col gap-2">
                      {(Object.entries(MEETING_TYPE_META) as [MeetingType, typeof MEETING_TYPE_META[MeetingType]][])
                        .filter(([key]) => key !== 'one_off')
                        .map(([key, meta]) => (
                          <button key={key} onClick={() => setField('meeting_type', key)}
                            className={`flex items-center gap-4 px-4 rounded-xl border text-left transition-all min-h-[60px] ${
                              form.meeting_type === key
                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                                : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 bg-white dark:bg-slate-800'
                            }`}>
                            <div className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${form.meeting_type === key ? 'border-brand-500' : 'border-gray-300 dark:border-slate-500'}`}>
                              {form.meeting_type === key && <div className="h-2 w-2 rounded-full bg-brand-500" />}
                            </div>
                            <div>
                              <span className={`block text-sm font-bold ${form.meeting_type === key ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-slate-300'}`}>{meta.label}</span>
                              <span className="block text-sm text-gray-400 dark:text-slate-500 leading-tight">{meta.desc}</span>
                            </div>
                          </button>
                        ))}
                    </div>
                    {form.meeting_type === 'group' && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Max invitees <span className="font-normal text-gray-400">(optional)</span></label>
                        <input type="number" min={2} value={form.max_invitees ?? ''} onChange={(e) => setField('max_invitees', e.target.value ? parseInt(e.target.value) : null)} placeholder="Unlimited" className={inputCls} />
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN — duration, price, color, active */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Duration</label>
                    <select value={form.duration_minutes} onChange={(e) => setField('duration_minutes', parseInt(e.target.value))} className={inputCls}>
                      {[15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((d) => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>

                  <div className="p-4 border border-gray-100 dark:border-slate-800 rounded-xl space-y-4 bg-gray-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Recurring service</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Let clients book a repeating time slot</p>
                      </div>
                      <button type="button" onClick={() => {
                        const next = !form.is_recurring;
                        setField('is_recurring', next);
                        if (next && !form.recurrence_frequency) setField('recurrence_frequency', 'weekly');
                      }}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${form.is_recurring ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.is_recurring ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    {form.is_recurring && (
                      <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-slate-800">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Frequency</label>
                          <div className="flex flex-wrap gap-2">
                            {([
                              ['weekly', 'Weekly'],
                              ['biweekly', 'Every 2 weeks'],
                              ['monthly', 'Monthly'],
                            ] as [RecurrenceFrequency, string][]).map(([key, label]) => (
                              <button key={key} type="button" onClick={() => setField('recurrence_frequency', key)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all min-h-[40px] ${
                                  form.recurrence_frequency === key
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                                }`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Ends</label>
                          <div className="space-y-2">
                            {([
                              ['never', 'Never'],
                              ['occurrences', 'After a number of occurrences'],
                              ['date', 'On a specific date'],
                            ] as [RecurrenceEndType, string][]).map(([key, label]) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                                <input type="radio" name="recurrence-end" checked={recurrenceEndType === key}
                                  onChange={() => {
                                    setRecurrenceEndType(key);
                                    if (key === 'never') {
                                      setField('recurrence_end_date', null);
                                      setField('recurrence_end_occurrences', null);
                                    }
                                  }}
                                  className="text-brand-600 focus:ring-brand-500" />
                                <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                              </label>
                            ))}
                            {recurrenceEndType === 'occurrences' && (
                              <input type="number" min={1} max={52} value={form.recurrence_end_occurrences ?? ''}
                                onChange={(e) => setField('recurrence_end_occurrences', e.target.value ? parseInt(e.target.value, 10) : null)}
                                placeholder="Number of occurrences"
                                className={inputCls + ' max-w-[200px]'} />
                            )}
                            {recurrenceEndType === 'date' && (
                              <input type="date" value={form.recurrence_end_date ?? ''}
                                onChange={(e) => setField('recurrence_end_date', e.target.value || null)}
                                className={inputCls + ' max-w-[220px]'} />
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Max clients per slot</label>
                          <input type="number" min={1} max={20} value={form.max_recurring_clients ?? 1}
                            onChange={(e) => setField('max_recurring_clients', Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className={inputCls + ' max-w-[120px]'} />
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                            Great for routes — e.g. 3 lawn clients on Tuesday morning
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/40 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                          💡 Recurring event types let clients book a repeating time slot — weekly lawn care, monthly telehealth visits, biweekly pool service, and more.
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Price <span className="font-normal text-gray-400">(empty = free)</span></label>
                    <input type="text" inputMode="decimal" placeholder="0.00" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} className={inputCls} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Accent color</label>
                    <ColorSwatchRow value={form.color} onChange={(c) => setField('color', c)} />
                  </div>

                  <div className="flex items-center justify-between py-4 border border-gray-100 dark:border-slate-800 rounded-xl px-4 bg-gray-50/50 dark:bg-slate-900/30 min-h-[64px]">
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">Active</p>
                      <p className="text-sm text-gray-400 dark:text-slate-500">Guests can schedule this event type</p>
                    </div>
                    <button onClick={() => setField('is_active', !form.is_active)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${form.is_active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className={`flex items-center justify-between py-4 border rounded-xl px-4 min-h-[64px] ${
                    profile && isSingleUseLinksEnabled(profile)
                      ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20'
                      : 'border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 opacity-80'
                  }`}>
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">Single use</p>
                      <p className="text-sm text-gray-400 dark:text-slate-500 leading-relaxed">
                        {profile && isSingleUseLinksEnabled(profile)
                          ? 'Hidden from your public booking page. Guests book only via a one-time link you generate.'
                          : 'Enable single-use links in Settings → General → Booking page first.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!(profile && isSingleUseLinksEnabled(profile))}
                      onClick={() => {
                        if (form.meeting_type === 'one_off') {
                          setField('meeting_type', 'one_on_one');
                        } else {
                          setField('meeting_type', 'one_off');
                        }
                      }}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 disabled:cursor-not-allowed ${
                        form.meeting_type === 'one_off' ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.meeting_type === 'one_off' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── SCHEDULING ── */}
            {activeTab === 'scheduling' && (
              <>
                {([
                  { field: 'buffer_before_minutes' as const, label: 'Buffer before meeting', desc: 'Add a gap before every meeting so you have time to prepare.' },
                  { field: 'buffer_after_minutes' as const, label: 'Buffer after meeting', desc: 'Add a gap after every meeting so you have time to take notes or take a breath.' },
                ] as const).map(({ field, label, desc }) => (
                  <div key={field}>
                    <p className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-0.5">{label}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">{desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {[0, 5, 10, 15, 20, 30, 45, 60].map((val) => {
                        const selected = form[field] === val;
                        return (
                          <button key={val} type="button" onClick={() => setField(field, val)}
                            className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all min-h-[44px] ${
                              selected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-indigo-500 dark:hover:border-indigo-600'
                            }`}
                          >
                            {val === 0 ? 'None' : `${val} min`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Post-booking redirect URL (optional)</label>
                  <input type="url" value={form.confirmation_redirect_url ?? ''} onChange={(e) => setField('confirmation_redirect_url', e.target.value || null)} placeholder="https://yourdomain.com/thank-you" className={inputCls} />
                  <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Redirect guests here after they complete booking.</p>
                </div>
              </>
            )}

            {/* ── LOCATION ── */}
            {activeTab === 'location' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Where does this meeting happen?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(LOCATION_TYPES).map(([k, label]) => (
                      <button key={k} onClick={() => setField('location_type', k as Service['location_type'])}
                        className={`px-4 py-3 rounded-xl border text-base text-left font-medium transition-colors min-h-[52px] ${form.location_type === k ? 'bg-brand-50 dark:bg-brand-950/30 border-brand-500 text-brand-700 dark:text-brand-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-300'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {form.location_type === 'video' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Video call link <span className="font-normal text-gray-400">(Zoom, Meet, Teams…)</span></label>
                    <input type="url" value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="https://zoom.us/j/123456789" className={inputCls} />
                    <p className="text-sm text-gray-400 dark:text-slate-500 mt-1.5">Sent to guests automatically in their confirmation email.</p>
                  </div>
                )}
                {form.location_type === 'phone' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Your phone number</label>
                    <input type="tel" value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="+1 (555) 000-0000" className={inputCls} />
                  </div>
                )}
                {form.location_type === 'in_person' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Address</label>
                    <input type="text" value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="123 Main St, City, State 00000" className={inputCls} />
                  </div>
                )}
                {form.location_type === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Location details</label>
                    <input type="text" value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="Details shown to guest after booking" className={inputCls} />
                  </div>
                )}
                {connectedCalendars.filter(c => c.provider !== 'zoom').length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Write bookings to calendar</label>
                    <div className="space-y-2">
                      {connectedCalendars.filter(c => c.provider !== 'zoom').map(cal => {
                        const isSelected = selectedCalendarIds.length === 0 ? true : selectedCalendarIds.includes(cal.id);
                        const providerLabel = cal.provider === 'google' ? 'Google Calendar' : cal.provider === 'outlook' ? 'Outlook' : cal.provider === 'apple' ? 'Apple Calendar' : 'Calendar';
                        return (
                          <label key={cal.id} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors min-h-[52px]">
                            <input type="checkbox" checked={isSelected} onChange={() => {
                              const full = connectedCalendars.filter(c => c.provider !== 'zoom').map(c => c.id);
                              const base = selectedCalendarIds.length === 0 ? full : [...selectedCalendarIds];
                              setSelectedCalendarIds(base.includes(cal.id) ? base.filter(id => id !== cal.id) : [...base, cal.id]);
                            }} className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-medium text-gray-800 dark:text-slate-200">{providerLabel}</p>
                              {(cal.calendar_name || cal.provider_account_email) && <p className="text-sm text-gray-400 truncate">{cal.calendar_name || cal.provider_account_email}</p>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── REMINDERS ── */}
            {activeTab === 'reminders' && (
              <div className="space-y-4">
                <p className="text-base text-gray-600 dark:text-slate-400 leading-relaxed">
                  Add automatic reminders sent to guests before their meeting. Each reminder is specific to this event type.
                </p>

                {editingId === 'new' ? (
                  <div className="flex items-start gap-2.5 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-base text-amber-700 dark:text-amber-400">Save the event type first, then reopen to add reminders.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {reminders.length === 0 && !addingReminder && (
                        <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                          <Bell className="h-7 w-7 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-base text-gray-400 dark:text-slate-500">No reminders yet</p>
                          <p className="text-sm text-gray-400 dark:text-slate-600 mt-0.5">Add reminders to automatically notify guests before their meeting.</p>
                        </div>
                      )}
                      {reminders.map((r) => {
                        const ch = CHANNELS.find(c => c.key === r.channel);
                        return (
                          <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors min-h-[60px] ${r.is_active ? 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700' : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 opacity-60'}`}>
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${r.is_active ? 'bg-brand-50 dark:bg-brand-950/30' : 'bg-gray-100 dark:bg-slate-800'}`}>
                              {ch && <ch.icon className={`h-5 w-5 ${r.is_active ? ch.color : 'text-gray-400'}`} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-semibold text-gray-900 dark:text-white">{r.label}</p>
                              <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">{r.channel}</p>
                            </div>
                            <button onClick={() => handleToggleReminder(r)}
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${r.is_active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${r.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <button onClick={() => handleDeleteReminder(r.id)} className="p-2 text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {addingReminder && (
                      <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl space-y-4">
                        <p className="text-sm font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">New reminder</p>

                        <div>
                          <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Channel</label>
                          <div className="flex gap-2">
                            {CHANNELS.map(({ key, label, icon: Icon, color }) => {
                              const isSelected = newReminderChannels.has(key);
                              return (
                                <button key={key} type="button" onClick={() => {
                                  setNewReminderChannels(prev => {
                                    const next = new Set(prev);
                                    if (next.has(key) && next.size === 1) return prev;
                                    next.has(key) ? next.delete(key) : next.add(key);
                                    return next;
                                  });
                                }}
                                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors flex-1 justify-center min-h-[44px] ${isSelected ? 'bg-brand-50 dark:bg-brand-950/30 border-brand-500 text-brand-700 dark:text-brand-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'}`}
                                >
                                  <Icon className={`h-4 w-4 ${isSelected ? 'text-brand-500' : color}`} />{label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">When to send <span className="font-normal text-gray-400 dark:text-slate-500">(select one or more)</span></label>
                          {!customOffset ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                {REMINDER_PRESETS.map((p) => {
                                  const checked = newReminderOffsets.has(p.offset);
                                  return (
                                    <button key={p.offset} type="button" onClick={() => {
                                      setNewReminderOffsets(prev => {
                                        const next = new Set(prev);
                                        if (next.has(p.offset) && next.size === 1) return prev;
                                        next.has(p.offset) ? next.delete(p.offset) : next.add(p.offset);
                                        return next;
                                      });
                                    }}
                                      className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border text-sm font-medium transition-colors text-left min-h-[48px] ${checked ? 'bg-brand-50 dark:bg-brand-950/30 border-brand-500 text-brand-700 dark:text-brand-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'}`}>
                                      <span className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'border-brand-500 bg-brand-500' : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                        {checked && <svg viewBox="0 0 10 10" className="h-3 w-3 text-white fill-none stroke-current" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>}
                                      </span>
                                      {p.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <button onClick={() => setCustomOffset(true)} className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors py-1">
                                + Custom timing
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input type="number" min={1} value={customOffsetVal} onChange={(e) => setCustomOffsetVal(e.target.value)} placeholder="e.g. 90" className={`${inputCls} w-28`} />
                              <span className="text-base text-gray-500 dark:text-slate-400 whitespace-nowrap">minutes before</span>
                              <button onClick={() => { setCustomOffset(false); setCustomOffsetVal(''); }} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors ml-auto">Cancel</button>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={handleAddReminder} disabled={savingReminder || (customOffset && !customOffsetVal)}
                            className="flex items-center gap-1.5 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 min-h-[48px]">
                            {savingReminder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Add reminder
                          </button>
                          <button onClick={() => { setAddingReminder(false); setCustomOffset(false); setCustomOffsetVal(''); }}
                            className="px-5 py-3 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors min-h-[48px]">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {!addingReminder && (
                      <button onClick={() => setAddingReminder(true)}
                        className="flex items-center gap-2 text-base text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium transition-colors min-h-[44px]">
                        <Plus className="h-5 w-5" /> Add reminder
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── QUESTIONS ── */}
            {activeTab === 'questions' && (
              <>
                <div className="space-y-2 mb-2">
                  <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Default Forms</p>
                  {([
                    { key: 'require_nda' as const, icon: Shield, label: 'Require NDA agreement', desc: 'Guests must agree to a non-disclosure agreement', accent: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/40' },
                  ] as const).map((item) => (
                    <div key={item.key} className={`flex items-center gap-3 px-4 py-3.5 ${item.bg} border border-gray-200 dark:border-slate-700 rounded-xl min-h-[60px]`}>
                      <item.icon className={`h-5 w-5 shrink-0 ${item.accent}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{item.label}</p>
                        <p className="text-sm text-gray-400 dark:text-slate-500">{item.desc}</p>
                      </div>
                      <button onClick={() => setField(item.key, !form[item.key])} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${form[item.key] ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form[item.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 dark:border-slate-800 pt-4 mb-2">
                  <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Custom Questions</p>
                </div>

                {editingId === 'new' ? (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-base text-amber-700 dark:text-amber-400">Save the event type first, then reopen to add intake questions.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Questions guests answer when scheduling. Responses appear in your meetings.</p>
                    <div className="space-y-2">
                      {questions.map((q) => (
                        <div key={q.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl min-h-[52px]">
                          <div>
                            <span className="text-base font-medium text-gray-900 dark:text-white">{q.label}</span>
                            {q.required && <span className="ml-1.5 text-sm text-red-500">*</span>}
                            <span className="ml-2 text-sm text-gray-400 dark:text-slate-500">{q.field_type}</span>
                          </div>
                          <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      {questions.length === 0 && !addingQ && <p className="text-base text-gray-400 dark:text-slate-500 py-2">No questions yet.</p>}
                    </div>
                    {addingQ && (
                      <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Question *</label>
                          <input type="text" value={newQLabel} onChange={(e) => setNewQLabel(e.target.value)} placeholder="e.g. What topic would you like to discuss?" className={inputCls} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Field type</label>
                            <select value={newQType} onChange={(e) => setNewQType(e.target.value as BookingQuestion['field_type'])} className={inputCls}>
                              <option value="text">Short text</option><option value="textarea">Long text</option>
                              <option value="select">Dropdown</option><option value="checkbox">Checkbox</option>
                              <option value="phone">Phone</option><option value="url">URL</option>
                            </select>
                          </div>
                          <div className="flex items-center min-h-[44px]">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={newQRequired} onChange={(e) => setNewQRequired(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                              <span className="text-base text-gray-700 dark:text-slate-300">Required</span>
                            </label>
                          </div>
                        </div>
                        {newQType === 'select' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Options (one per line)</label>
                            <textarea value={newQOptions} onChange={(e) => setNewQOptions(e.target.value)} rows={3} placeholder={"Option A\nOption B\nOption C"} className={`${inputCls} resize-none`} />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={handleAddQuestion} disabled={savingQ || !newQLabel}
                            className="px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2 min-h-[48px]">
                            {savingQ ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Add question
                          </button>
                          <button onClick={() => setAddingQ(false)} className="px-4 py-3 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors min-h-[48px]">Cancel</button>
                        </div>
                      </div>
                    )}
                    {!addingQ && (
                      <button onClick={() => setAddingQ(true)} className="flex items-center gap-2 text-base text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium transition-colors min-h-[44px]">
                        <Plus className="h-5 w-5" /> Add question
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── POLICY ── */}
            {activeTab === 'policy' && (
              <div className="space-y-4">
                {[
                  { field: 'allow_cancellation' as const, label: 'Allow guest cancellation', desc: 'Guests can cancel via one-tap link' },
                  { field: 'allow_reschedule' as const, label: 'Allow guest rescheduling', desc: 'Guests can request a new time' },
                ].map((item) => (
                  <div key={item.field} className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-slate-800 min-h-[64px]">
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{item.label}</p>
                      <p className="text-sm text-gray-400 dark:text-slate-500">{item.desc}</p>
                    </div>
                    <button onClick={() => setField(item.field, !form[item.field])}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${form[item.field] ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form[item.field] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-slate-800 min-h-[64px]">
                  <div>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">Override global T&amp;C setting for this event</p>
                    <p className="text-sm text-gray-400 dark:text-slate-500">Global T&amp;C setting is in Settings → Booking page</p>
                  </div>
                  <button onClick={() => setField('require_terms', !form.require_terms)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${form.require_terms ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.require_terms ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Cancellation policy (shown to guests)</label>
                  <textarea value={form.cancellation_policy} onChange={(e) => setField('cancellation_policy', e.target.value)} rows={3} placeholder="e.g. Cancellations must be made at least 24 hours in advance." className={`${inputCls} resize-none`} />
                </div>
              </div>
            )}

            {/* ── PAYMENT ── */}
            {activeTab === 'payment' && (
              <PaymentTab
                form={form}
                setField={(k, v) => setField(k, v as FormState[typeof k])}
                priceStr={priceStr}
              />
            )}

          </div>

          {/* ── Save button — sticky at bottom on mobile, inline footer on md+ ── */}
          {activeTab !== 'questions' && activeTab !== 'reminders' && (
            <>
              {/* Mobile: fixed full-width bar */}
              <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 px-4 py-3 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 safe-bottom">
                <button onClick={handleSave} disabled={saving || !form.name}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-base font-bold rounded-2xl transition-all disabled:opacity-50 shadow-md">
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  {editingId === 'new' ? 'Create event type' : 'Save changes'}
                </button>
              </div>
              {/* Desktop: inline footer */}
              <div className="hidden md:flex shrink-0 px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 items-center justify-between gap-3">
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {editingId === 'new' ? 'Changes are not saved yet.' : 'Unsaved changes will be lost if you close.'}
                </p>
                <button onClick={handleSave} disabled={saving || !form.name}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 shadow-sm shrink-0">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editingId === 'new' ? 'Create event type' : 'Save changes'}
                </button>
              </div>
            </>
          )}
        </div>
      )}


      {/* QR Modal */}
      {qrService && (
        <QRModal
          url={qrUrl ?? buildBookingUrl(qrService)}
          title={qrService.name}
          singleUse={qrUrl !== null}
          onClose={() => { setQrService(null); setQrUrl(null); }}
        />
      )}
    </main>
  );
}
