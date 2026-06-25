import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TIMEZONES } from '../lib/types';
import { PHONE_PLACEHOLDER, PHONE_HINT, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { SmsBookingConsent } from './SmsConsentText';
import {
  ArrowRight, ArrowLeft, Check, X, Loader2, Copy, ExternalLink, Pencil,
  Calendar, Mail, Video, Globe, Zap, Sparkles,
  Users, Gift, AlertCircle, MapPin, Clock,
} from 'lucide-react';
import { ColorSwatchRow, BRAND_SWATCHES } from './ColorSwatchRow';
import {
  markOnboardingCompletedLocal,
  setWizardActiveLocal,
  clearWizardLocal,
  onboardingIsCompletedLocal,
  wizardIsActiveLocal,
  wizardSavedStepLocal,
} from '../lib/onboardingState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectedCalendar {
  id: string;
  provider: string;
  provider_account_email: string;
  calendar_name: string;
  sync_enabled: boolean;
}

interface CalendlyImportedEvent {
  name: string;
  duration_minutes: number;
  description: string;
  color: string;
  selected: boolean;
  location_type?: 'video' | 'in_person' | 'phone' | 'custom';
  location?: string;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  is_active?: boolean;
  calendly_slug?: string | null;
  calendly_event_type_uri?: string | null;
}

interface CalendlyImportedProfile {
  full_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  email: string | null;
  slug: string | null;
}

interface CalendlyImportedAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface CalendlyImportResponse {
  source?: 'oauth' | 'scrape';
  oauth_recommended?: boolean;
  oauth_banner?: string;
  error?: string;
  username?: string | null;
  profile?: CalendlyImportedProfile | null;
  availability?: CalendlyImportedAvailability[];
  events?: CalendlyImportedEvent[];
}

const AVAIL_DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatAvailTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

function calendlyLocationLabel(type?: string, location?: string): string {
  if (location?.trim()) return location.trim();
  switch (type) {
    case 'video': return 'Video call';
    case 'in_person': return 'In person';
    case 'phone': return 'Phone call';
    case 'custom': return 'Custom location';
    default: return '—';
  }
}

interface WizardProps {
  onClose?: () => void;
  isModal?: boolean;
  initialStep?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  'welcome',
  'username',
  'phone',
  'timezone',
  'calendar',
  'calendar_purpose',
  'contacts',
  'profile',
  'booking_link',
  'video',
  'done',
] as const;
type Step = (typeof STEPS)[number];

export const onboardingIsCompleted = onboardingIsCompletedLocal;
export const wizardIsActive = wizardIsActiveLocal;
export const wizardSavedStep = wizardSavedStepLocal;


function sanitizeSlug(val: string) {
  return val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ stepIndex, total }: { stepIndex: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex gap-1 flex-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i < stepIndex ? 'bg-indigo-600' : i === stepIndex ? 'bg-indigo-300' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 font-medium">
        {stepIndex + 1} / {total}
      </span>
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  onSkip,
  nextLabel = 'Continue',
  nextDisabled = false,
  loading = false,
  showBack = true,
}: {
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  showBack?: boolean;
}) {
  const isBlocked = (nextDisabled || loading) && !loading;
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled || loading}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 font-semibold rounded-xl transition-all text-sm ${
            nextDisabled && !loading
              ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
              : 'text-white hover:opacity-90 cursor-pointer'
          }`}
          style={nextDisabled && !loading ? {} : { backgroundColor: '#5864C6' }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {nextLabel}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="px-4 py-2.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Skip
          </button>
        )}
      </div>
      {isBlocked && (
        <p className="text-xs text-red-400 text-center mt-2">
          Please complete this step{onSkip ? ' or click Skip' : ''} to continue.
        </p>
      )}
    </div>
  );
}

function ProviderIcon({ provider, size = 20 }: { provider: string; size?: number }) {
  const s = size;
  if (provider === 'google')
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    );
  if (provider === 'outlook')
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill="#0078D4"/>
        <path d="M7 7h5.5A2.5 2.5 0 0 1 15 9.5v5a2.5 2.5 0 0 1-2.5 2.5H7V7z" fill="white" opacity=".8"/>
        <path d="M15 9l5 2v2l-5 2V9z" fill="white"/>
      </svg>
    );
  if (provider === 'zoom')
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="12" fill="#2D8CFF"/>
        <path d="M5 9.5h8.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1zM14.5 11.5l4-2v5l-4-2z" fill="white"/>
      </svg>
    );
  if (provider === 'apple')
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className="text-slate-700 dark:text-slate-200">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.18 1.27-2.15 3.8.03 3.02 2.65 4.03 2.68 4.04l-.08.28zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    );
  return <Globe width={s} height={s} className="text-slate-500" />;
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

export function OnboardingWizard({ onClose, isModal = false, initialStep }: WizardProps) {
  const { user, profile, subscription, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(() => {
    if (initialStep !== undefined && initialStep >= 0) {
      // Clamp legacy saved indices (e.g. old qr_code / done steps after step removal)
      const idx = Math.min(initialStep, STEPS.length - 1);
      return STEPS[idx];
    }
    return 'welcome';
  });
  const [saving, setSaving] = useState(false);

  // Welcome step
  const [fromCalendly, setFromCalendly] = useState<boolean | null>(null);
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [scrapedEvents, setScrapedEvents] = useState<CalendlyImportedEvent[]>([]);
  const [importedProfile, setImportedProfile] = useState<CalendlyImportedProfile | null>(null);
  const [importedAvailability, setImportedAvailability] = useState<CalendlyImportedAvailability[]>([]);
  const [importSource, setImportSource] = useState<'oauth' | 'scrape' | null>(null);
  const [oauthBanner, setOauthBanner] = useState('');
  const [calendlyConnected, setCalendlyConnected] = useState(false);
  const [calendlyConnecting, setCalendlyConnecting] = useState(false);
  const calendlyImportRan = useRef(false);
  const [trialActivated, setTrialActivated] = useState(false);
  const [showTrialOffer, setShowTrialOffer] = useState(false);
  const [trialAgreed, setTrialAgreed] = useState(false);
  const [trialCheckoutLoading, setTrialCheckoutLoading] = useState(false);
  const [trialCheckoutError, setTrialCheckoutError] = useState('');

  // Calendar step
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  const [calConnecting, setCalConnecting] = useState<string | null>(null);
  const [calError, setCalError] = useState('');

  // Calendar purpose step
  const [calPurposes, setCalPurposes] = useState<Record<string, { scheduling: boolean; reminders: boolean }>>({});

  // Existing services (loaded on mount to skip booking_link form if already set up)
  const [existingServices, setExistingServices] = useState<{ id: string; name: string; duration_minutes: number; color: string }[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('services').select('id, name, duration_minutes, color').eq('host_id', user.id).eq('is_active', true).then(({ data }) => {
      setExistingServices(data ?? []);
    });
  }, [user]);

  // Booking link step
  const [eventName, setEventName] = useState('30-Minute Meeting');
  const [eventDuration, setEventDuration] = useState(30);
  const [eventColor, setEventColor] = useState(BRAND_SWATCHES[8].hex);
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [hostPhone, setHostPhone] = useState('');
  const [hostNotifyVia, setHostNotifyVia] = useState<string[]>([]);
  const [hostSmsOptIn, setHostSmsOptIn] = useState(false);
  const [hostWhatsappOptIn, setHostWhatsappOptIn] = useState(false);
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'America/New_York');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileWhatsapp, setProfileWhatsapp] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);
  const [bookingUrl, setBookingUrl] = useState('');
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [preferredCalendar, setPreferredCalendar] = useState<'google' | 'outlook' | null>(null);
  const [showCalendlySwitcherBanner, setShowCalendlySwitcherBanner] = useState(false);

  // Contacts import step
  const [contactsGoogleConnecting, setContactsGoogleConnecting] = useState(false);
  const [contactsOutlookConnecting, setContactsOutlookConnecting] = useState(false);
  const [contactsImportError, setContactsImportError] = useState('');

  const handleContactsGoogleImport = async () => {
    setContactsGoogleConnecting(true);
    setContactsImportError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?source=contacts`,
        { headers: { Authorization: `Bearer ${token}`, Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
      );
      const json = await res.json();
      if (json.error) { setContactsImportError(json.error); setContactsGoogleConnecting(false); return; }
      window.location.href = json.url;
    } catch (e) {
      setContactsImportError(String(e));
      setContactsGoogleConnecting(false);
    }
  };

  const handleContactsOutlookImport = async () => {
    setContactsOutlookConnecting(true);
    setContactsImportError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-calendar-auth?source=contacts`,
        { headers: { Authorization: `Bearer ${token}`, Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
      );
      const json = await res.json();
      if (json.error) { setContactsImportError(json.error); setContactsOutlookConnecting(false); return; }
      window.location.href = json.url;
    } catch (e) {
      setContactsImportError(String(e));
      setContactsOutlookConnecting(false);
    }
  };

  // Video step
  const [videoCalendars, setVideoCalendars] = useState<ConnectedCalendar[]>([]);

  // Done step
  const [copied, setCopied] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  const stepIndex = STEPS.indexOf(step);

  // True if user already has an active Pro/trial subscription
  const isAlreadyPro = (
    (subscription?.plan === 'pro' && subscription?.status !== 'canceled')
    || profile?.plan === 'pro'
  );

  // ── Persist completed state to both DB and localStorage ──────────────────────
  const persistCompleted = useCallback(async () => {
    markOnboardingCompletedLocal();
    if (!user) return;
    const phoneE164 = normalizePhoneE164(hostPhone) || normalizePhoneE164(profilePhone) || null;
    let defaultChannel: 'email' | 'sms' | 'whatsapp' | 'voice' | null = null;
    if (hostNotifyVia.includes('whatsapp')) defaultChannel = 'whatsapp';
    else if (hostNotifyVia.includes('sms')) defaultChannel = 'sms';

    const payload: Record<string, unknown> = {
      onboarding_completed: true,
      slug: (username || slug).trim() || null,
      timezone,
      phone: phoneE164,
    };
    if (defaultChannel) payload.default_reminder_channel = defaultChannel;
    if (hostNotifyVia.includes('whatsapp') && phoneE164) {
      payload.whatsapp_number = normalizePhoneE164(profileWhatsapp) || phoneE164;
    }

    await supabase.from('profiles').update(payload).eq('id', user.id);
  }, [user, username, slug, timezone, hostPhone, profilePhone, profileWhatsapp, hostNotifyVia]);

  // ── Save wizard position to localStorage + DB before any redirect ────────────
  const persistWizardPosition = useCallback(async (stepIdx: number) => {
    setWizardActiveLocal(stepIdx);
    if (!user) return;
    await supabase.from('profiles').update({
      onboarding_step: stepIdx,
      wizard_active: true,
    }).eq('id', user.id);
  }, [user]);

  // ── Clear wizard_active after it has been resumed ─────────────────────────────
  const clearWizardActive = useCallback(async () => {
    clearWizardLocal();
    if (!user) return;
    await supabase.from('profiles').update({ wizard_active: false }).eq('id', user.id);
  }, [user]);

  const handleDismiss = async () => {
    await persistCompleted();
    await clearWizardActive();
    await refreshProfile();
    if (onClose) onClose();
  };

  // ── Load connected calendars ─────────────────────────────────────────────────
  const loadCalendars = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('connected_calendars')
      .select('id, provider, provider_account_email, calendar_name, sync_enabled, use_for_scheduling, use_for_reminders')
      .eq('host_id', user.id);
    const list = (error ? [] : (data ?? [])) as ConnectedCalendar[];
    setCalendars(list);
    setVideoCalendars(list.filter(c => ['google', 'outlook', 'zoom'].includes(c.provider)));
    setCalPurposes(prev => {
      const next = { ...prev };
      for (const c of list) {
        if (!next[c.id]) {
          next[c.id] = { scheduling: true, reminders: true };
        }
      }
      return next;
    });
  }, [user]);

  useEffect(() => { loadCalendars(); }, [loadCalendars]);

  const applyCalendlyImportResponse = useCallback((data: CalendlyImportResponse) => {
    if (data.error) {
      setScrapeError(data.error);
      return;
    }
    setImportSource(data.source ?? 'scrape');
    setOauthBanner(data.oauth_banner ?? (data.oauth_recommended
      ? 'Connect your Calendly account to import your full schedule, availability, and meeting links.'
      : ''));
    setImportedProfile(data.profile ?? null);
    setImportedAvailability(data.availability ?? []);
    if (data.profile?.timezone) setTimezone(data.profile.timezone);
    if (data.profile?.slug && !username) setUsername(data.profile.slug);
    if (data.username && !calendlyUrl) setCalendlyUrl(`https://calendly.com/${data.username}`);
    setScrapedEvents((data.events ?? []).map(e => ({ ...e, selected: e.is_active !== false })));
  }, [calendlyUrl, username]);

  const activateCalendlyTrial = useCallback(async () => {
    if (trialActivated || !user) return;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await supabase.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: `trial_${user.id}`,
      plan: 'pro', status: 'trialing',
      trial_ends_at: trialEnd.toISOString(),
      trial_source: 'calendly_migration',
    }, { onConflict: 'user_id' });
    await supabase.from('profiles').update({ plan: 'pro' }).eq('id', user.id);
    setTrialActivated(true);
  }, [trialActivated, user]);

  const saveCalendlyImport = useCallback(async (selected: CalendlyImportedEvent[]) => {
    if (!user) return;

    if (importedProfile) {
      const profileUpdate: Record<string, string | null> = {};
      if (importedProfile.full_name) profileUpdate.full_name = importedProfile.full_name;
      if (importedProfile.avatar_url) profileUpdate.avatar_url = importedProfile.avatar_url;
      if (importedProfile.timezone) profileUpdate.timezone = importedProfile.timezone;
      if (Object.keys(profileUpdate).length) {
        await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
        if (profileUpdate.timezone) setTimezone(profileUpdate.timezone);
      }
    }

    if (importedAvailability.length > 0) {
      await supabase.from('availability').delete().eq('host_id', user.id);
      for (const slot of importedAvailability) {
        await supabase.from('availability').insert({
          host_id: user.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_active: true,
        });
      }
    }

    if (selected.length > 0) {
      await supabase.from('services').delete().eq('host_id', user.id);
      for (const svc of selected) {
        await supabase.from('services').insert({
          host_id: user.id,
          name: svc.name,
          duration_minutes: svc.duration_minutes,
          description: svc.description || '',
          price_cents: 0,
          location_type: svc.location_type ?? 'video',
          location: svc.location ?? '',
          buffer_before_minutes: svc.buffer_before_minutes ?? 0,
          buffer_after_minutes: svc.buffer_after_minutes ?? 0,
          is_active: svc.is_active !== false,
          color: svc.color,
          calendly_slug: svc.calendly_slug ?? null,
          calendly_event_type_uri: svc.calendly_event_type_uri ?? null,
        });
      }
    }
  }, [user, importedProfile, importedAvailability]);

  const runCalendlyImport = useCallback(async (opts?: { url?: string; oauthOnly?: boolean }) => {
    setScraping(true);
    setScrapeError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const body: Record<string, string> = {};
      if (opts?.oauthOnly) {
        // OAuth path — token lookup on server; url optional
      } else if (opts?.url?.trim()) {
        body.url = opts.url.trim();
      } else if (calendlyUrl.trim()) {
        body.url = calendlyUrl.trim();
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-calendly`,
        { method: 'POST', headers, body: JSON.stringify(body) }
      );
      const data = await resp.json() as CalendlyImportResponse;
      if (data.source === 'oauth') {
        setCalendlyConnected(true);
        setOauthBanner('');
      }
      applyCalendlyImportResponse(data);
      await activateCalendlyTrial();
    } catch (e) {
      setScrapeError((e as Error).message ?? 'Failed to reach Calendly.');
    }
    setScraping(false);
  }, [activateCalendlyTrial, applyCalendlyImportResponse, calendlyUrl]);

  const checkCalendlyConnection = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-calendly`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'status' }),
        }
      );
      const data = await resp.json() as { connected?: boolean; username?: string | null };
      setCalendlyConnected(!!data.connected);
      if (data.username && !calendlyUrl) setCalendlyUrl(`https://calendly.com/${data.username}`);
    } catch {
      // ignore
    }
  }, [user, calendlyUrl]);

  useEffect(() => {
    if (fromCalendly) void checkCalendlyConnection();
  }, [fromCalendly, checkCalendlyConnection]);

  useEffect(() => {
    if (!user || calendlyImportRan.current) return;
    const params = new URLSearchParams(window.location.search);
    const calendlyOk =
      params.get('calendly_connected') === '1' ||
      params.get('calendly_success') === '1' ||
      params.get('calendly_success') === 'true';
    if (!calendlyOk) return;
    calendlyImportRan.current = true;
    setFromCalendly(true);
    setCalendlyConnected(true);
    void runCalendlyImport({ oauthOnly: true });
    const url = new URL(window.location.href);
    url.searchParams.delete('calendly_connected');
    url.searchParams.delete('calendly_success');
    url.searchParams.delete('calendly_error');
    window.history.replaceState({}, '', url.toString());
  }, [user, runCalendlyImport]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('calendly_error');
    if (!err) return;
    // URLSearchParams.get() already decodes; avoid decodeURIComponent (throws on bare %)
    setScrapeError(`Calendly connection failed: ${err}`);
    const url = new URL(window.location.href);
    url.searchParams.delete('calendly_error');
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Pre-fill from onboarding bot URL params or saved answers
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarParam = params.get('calendar');
    const appointmentsParam = params.get('appointments');
    const payingParam = params.get('paying');

    let botAnswers: Record<string, string> = {};
    try {
      const stored = localStorage.getItem('pinonit_bot_answers');
      if (stored) botAnswers = JSON.parse(stored);
    } catch { /* ignore */ }

    const calendar = calendarParam ?? botAnswers.calendar ?? '';
    const appointments = appointmentsParam ?? botAnswers.appointments ?? '';
    const paying = payingParam ?? botAnswers.paying ?? '';

    if (calendar.toLowerCase().includes('google')) {
      setPreferredCalendar('google');
    } else if (calendar.toLowerCase().includes('outlook') || calendar.toLowerCase().includes('microsoft')) {
      setPreferredCalendar('outlook');
    }

    if (appointments) {
      const lower = appointments.toLowerCase();
      if (lower.includes('consultation')) setEventName('Consultation');
      else if (lower.includes('client')) setEventName('Client Call');
      else if (lower.includes('class') || lower.includes('coach')) setEventName('Coaching Session');
      else if (lower.includes('team')) setEventName('Team Meeting');
    }

    if (paying.toLowerCase().includes('calendly')) {
      setShowCalendlySwitcherBanner(true);
      setFromCalendly(true);
    }
  }, []);

  // ── Slug from name ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    const storedPhone = profile.phone ?? '';
    const formatted = storedPhone ? blurFormatPhone(storedPhone) : '';
    setHostPhone(formatted);
    setProfilePhone(formatted);
    const storedWhatsapp = profile.whatsapp_number ?? '';
    setProfileWhatsapp(storedWhatsapp ? blurFormatPhone(storedWhatsapp) : '');
    if (profile.default_reminder_channel === 'sms') {
      setHostSmsOptIn(true);
      setHostNotifyVia((prev) => (prev.includes('sms') ? prev : [...prev, 'sms']));
    } else if (profile.default_reminder_channel === 'whatsapp') {
      setHostWhatsappOptIn(true);
      setHostNotifyVia((prev) => (prev.includes('whatsapp') ? prev : [...prev, 'whatsapp']));
    }
  }, [profile?.phone, profile?.whatsapp_number, profile?.default_reminder_channel]);

  useEffect(() => {
    if (profile?.slug) {
      setSlug(profile.slug);
      setUsername(profile.slug);
      return;
    }
    if (profile?.full_name) {
      const generated = sanitizeSlug(profile.full_name.trim().replace(/\s+/g, '-').slice(0, 30));
      setSlug(generated);
      setUsername(generated);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.timezone) {
      setTimezone(profile.timezone);
      return;
    }
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setTimezone(detected);
    } catch {
      // keep default
    }
  }, [profile?.timezone]);

  useEffect(() => {
    setSlug(username);
  }, [username]);

  // ── Slug checking ────────────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) { setSlugStatus('idle'); setUsernameAvailable(null); return; }
    if (trimmed === profile?.slug) { setSlugStatus('available'); setUsernameAvailable(true); return; }
    if (trimmed.length < 3) { setSlugStatus('invalid'); setUsernameAvailable(null); return; }
    setSlugStatus('checking');
    setUsernameAvailable(null);
    const t = setTimeout(async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('slug', trimmed)
        .neq('id', user?.id ?? '');
      const available = count === 0;
      setSlugStatus(available ? 'available' : 'taken');
      setUsernameAvailable(available);
    }, 500);
    return () => clearTimeout(t);
  }, [username, profile?.slug, user?.id]);

  // ── Save onboarding step ──────────────────────────────────────────────────────
  const saveStep = useCallback(async (s: number) => {
    if (!user) return;
    await supabase.from('profiles').update({ onboarding_step: s }).eq('id', user.id);
  }, [user]);

  const saveCalendarPurposes = useCallback(async () => {
    if (!user) return;
    await Promise.all(
      Object.entries(calPurposes).map(([id, p]) =>
        supabase
          .from('connected_calendars')
          .update({ use_for_scheduling: p.scheduling, use_for_reminders: p.reminders })
          .eq('id', id)
          .eq('host_id', user.id)
      )
    );
  }, [user, calPurposes]);

  // ── Confetti ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!confettiActive || !confettiRef.current) return;
    const canvas = confettiRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const pieces: { x: number; y: number; r: number; dx: number; dy: number; color: string; rot: number; drot: number }[] = [];
    const colors = ['#5864C6', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 200,
        r: 4 + Math.random() * 6,
        dx: (Math.random() - 0.5) * 3,
        dy: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360,
        drot: (Math.random() - 0.5) * 8,
      });
    }
    let frame: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        ctx.restore();
        p.x += p.dx;
        p.y += p.dy;
        p.rot += p.drot;
      }
      if (pieces.some(p => p.y < canvas.height + 20)) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [confettiActive]);

  // ── 14-day trial activation (no CC required) ────────────────────────────────
  const handleActivateFreeTrialdirect = async () => {
    if (!user) return;
    setTrialCheckoutError('');
    setTrialCheckoutLoading(true);
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      const isoEnd = trialEnd.toISOString();
      await supabase.from('profiles').update({ plan: 'pro', trial_ends_at: isoEnd }).eq('id', user.id);
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        plan: 'pro',
        status: 'trialing',
        trial_ends_at: isoEnd,
        trial_source: 'free_trial',
      }, { onConflict: 'user_id' });
      await refreshProfile();
      await saveStep(STEPS.indexOf('welcome') + 1);
      goNext();
    } catch (e) {
      setTrialCheckoutError((e as Error).message ?? 'Could not activate trial. Try again.');
    }
    setTrialCheckoutLoading(false);
  };

  // ── Stripe checkout (Calendly 60-day trial only) ─────────────────────────────
  const handleTrialCheckout = async (trialDays: number, resumeStep = 1) => {
    setTrialCheckoutError('');
    setTrialCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setTrialCheckoutError('Please sign in first.'); setTrialCheckoutLoading(false); return; }

      if (user) {
        await supabase.from('profiles').update({ onboarding_step: resumeStep }).eq('id', user.id);
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            price_id: 'price_1TZHhhIVv38UYFOXMXT2EV8v',
            app_url: window.location.origin,
            trial_period_days: trialDays,
            wizard_step: resumeStep,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.url) { setTrialCheckoutError(json.error ?? 'Could not start checkout. Try again.'); setTrialCheckoutLoading(false); return; }
      window.location.href = json.url;
    } catch (e) {
      setTrialCheckoutError((e as Error).message ?? 'Connection error.');
      setTrialCheckoutLoading(false);
    }
  };

  // ── Calendly OAuth + scrape import ───────────────────────────────────────────
  const handleConnectCalendly = async () => {
    setScrapeError('');
    setCalendlyConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setScrapeError('Please sign in again to connect Calendly.');
        setCalendlyConnecting(false);
        return;
      }
      await persistWizardPosition(STEPS.indexOf('welcome'));
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('calendly-auth', {
        body: { source: 'wizard' },
      });
      if (error || data?.error || !data?.url) {
        setScrapeError(data?.error ?? error?.message ?? 'Could not start Calendly connection.');
        setCalendlyConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setScrapeError(String(e));
      setCalendlyConnecting(false);
    }
  };

  const handleScrape = async () => {
    if (!calendlyConnected && !calendlyUrl.trim()) return;
    await runCalendlyImport({
      oauthOnly: calendlyConnected,
      url: calendlyUrl.trim() || undefined,
    });
  };

  const handleCalendlyImportContinue = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const selected = scrapedEvents.filter(e => e.selected);
      if (selected.length || importedProfile || importedAvailability.length) {
        await saveCalendlyImport(selected.length ? selected : scrapedEvents);
      }
      if (!isAlreadyPro) setShowTrialOffer(true);
      else {
        await saveStep(STEPS.indexOf('welcome') + 1);
        goNext();
      }
    } finally {
      setSaving(false);
    }
  };

  // ── OAuth calendar connect — saves wizard position before redirect ────────────
  const handleConnectCalendar = async (provider: 'google' | 'outlook' | 'zoom') => {
    setCalConnecting(provider);
    setCalError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      // Save wizard state so we can resume after OAuth redirect
      await persistWizardPosition(STEPS.indexOf('calendar'));

      if (provider === 'zoom') {
        window.location.href = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoom-auth?token=${encodeURIComponent(token)}`;
        return;
      }
      const fnMap: Record<string, string> = {
        google: 'google-calendar-auth',
        outlook: 'outlook-calendar-auth',
      };
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnMap[provider]}`,
        { headers: { Authorization: `Bearer ${token}`, Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
      );
      const json = await res.json();
      if (json.error) { setCalError(json.error); setCalConnecting(null); return; }
      window.location.href = json.url;
    } catch (e) {
      setCalError(String(e));
      setCalConnecting(null);
    }
  };

  // ── Save profile contact info (profile step) ───────────────────────────────
  const handleSaveProfileStep = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({
      phone: normalizePhoneE164(hostPhone) || normalizePhoneE164(profilePhone) || null,
      whatsapp_number: normalizePhoneE164(profileWhatsapp) || null,
    }).eq('id', user.id);
    await refreshProfile();
    await saveStep(STEPS.indexOf('profile') + 1);
    setSaving(false);
    goNext();
  };

  const handleSaveUsernameStep = async () => {
    if (!user) return;
    setSaving(true);
    const trimmed = username.trim();
    if (trimmed && (usernameAvailable === true || trimmed === profile?.slug)) {
      await supabase.from('profiles').update({ slug: trimmed }).eq('id', user.id);
      setSlug(trimmed);
      await refreshProfile();
    }
    await saveStep(STEPS.indexOf('username') + 1);
    setSaving(false);
    goNext();
  };

  const handleSavePhoneStep = async () => {
    if (!user) return;
    setSaving(true);
    const phoneE164 = normalizePhoneE164(hostPhone) || null;
    const payload: Record<string, string | null> = { phone: phoneE164 };
    if (phoneE164 && hostWhatsappOptIn) {
      payload.whatsapp_number = phoneE164;
    }
    if (phoneE164 && hostSmsOptIn) {
      payload.default_reminder_channel = 'sms';
    } else if (phoneE164 && hostWhatsappOptIn) {
      payload.default_reminder_channel = 'whatsapp';
    }
    await supabase.from('profiles').update(payload).eq('id', user.id);
    setProfilePhone(hostPhone);
    await refreshProfile();
    await saveStep(STEPS.indexOf('phone') + 1);
    setSaving(false);
    goNext();
  };

  const handleSaveTimezoneStep = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ timezone }).eq('id', user.id);
    await refreshProfile();
    await saveStep(STEPS.indexOf('timezone') + 1);
    setSaving(false);
    goNext();
  };

  // ── Create booking link (Step 5) ─────────────────────────────────────────────
  const handleCreateBookingLink = async () => {
    if (!user || !eventName.trim()) return;
    setSaving(true);
    await supabase.from('profiles').update({
      slug: (username || slug).trim() || null,
      timezone,
    }).eq('id', user.id);

    const calIds = selectedCalendarIds.length > 0
      ? selectedCalendarIds
      : calendars.filter(c => c.provider !== 'zoom').map(c => c.id);

    // If user imported from Calendly, those services are already saved.
    // Delete any pre-existing default services and replace with the scraped ones.
    if (fromCalendly && scrapedEvents.length > 0) {
      const selected = scrapedEvents.filter(e => e.selected);
      if (selected.length > 0) {
        // Delete existing placeholder/default services for this host
        await supabase.from('services').delete().eq('host_id', user.id);
        // Re-insert selected scraped services with calendar IDs applied
        for (const svc of selected) {
          await supabase.from('services').insert({
            host_id: user.id,
            name: svc.name,
            duration_minutes: svc.duration_minutes,
            description: svc.description || '',
            price_cents: 0,
            location_type: svc.location_type ?? 'video',
            location: svc.location ?? '',
            buffer_before_minutes: svc.buffer_before_minutes ?? 0,
            buffer_after_minutes: svc.buffer_after_minutes ?? 0,
            is_active: svc.is_active !== false,
            color: svc.color,
            calendly_slug: svc.calendly_slug ?? null,
            calendly_event_type_uri: svc.calendly_event_type_uri ?? null,
            booking_calendar_ids: calIds,
          });
        }
        const { data: firstSvc } = await supabase
          .from('services')
          .select('id')
          .eq('host_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstSvc) {
          setCreatedServiceId(firstSvc.id);
          const url = slug.trim()
            ? `${window.location.origin}/${slug.trim()}`
            : `${window.location.origin}/book/${user.id}`;
          setBookingUrl(url);
        }
      }
    } else {
      const { data: svc } = await supabase.from('services').insert({
        host_id: user.id,
        name: eventName.trim(),
        duration_minutes: eventDuration,
        color: eventColor,
        description: '',
        price_cents: 0,
        location_type: 'video',
        location: '',
        is_active: true,
        booking_calendar_ids: calIds,
      }).select().maybeSingle();

      if (svc) {
        setCreatedServiceId(svc.id);
        const url = slug.trim()
          ? `${window.location.origin}/${slug.trim()}`
          : `${window.location.origin}/book/${user.id}`;
        setBookingUrl(url);
      }
    }

    const { data: existing } = await supabase.from('availability').select('id').eq('host_id', user.id).limit(1);
    if (!existing?.length) {
      for (const day of [1, 2, 3, 4, 5]) {
        await supabase.from('availability').insert({ host_id: user.id, day_of_week: day, start_time: '09:00', end_time: '17:00' });
      }
    }

    await saveStep(stepIndex + 1);
    setSaving(false);
    goNext();
  };

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      const next = STEPS[idx + 1];
      setStep(next);
      if (next === 'done') {
        setConfettiActive(true);
        await persistCompleted();
        await clearWizardActive();
        await refreshProfile();
      }
    }
  }, [step, persistCompleted, clearWizardActive, refreshProfile]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const handleFinish = async () => {
    await persistCompleted();
    await clearWizardActive();
    if (onClose) onClose();
    else navigate('/dashboard');
  };

  // ── Render steps ─────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Welcome ──────────────────────────────────────────────────────
      case 'welcome': {
        const firstChargeDate60 = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); })();

        // Already Pro — skip any trial offer screens entirely and go straight to setup
        if (showTrialOffer && isAlreadyPro) {
          setShowTrialOffer(false);
          saveStep(STEPS.indexOf('welcome') + 1).then(() => goNext());
          return null;
        }

        // Calendly switcher — show special 60-day trial offer screen
        if (fromCalendly === true && showTrialOffer) {
          return (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
                  <Gift className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Start your free 60-day trial</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-sm mx-auto">
                  Your card will not be charged until <strong className="text-slate-700 dark:text-slate-200">{firstChargeDate60}</strong>. Cancel any time before then and you will never be billed.
                </p>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-5">
                <div className="space-y-2">
                  {[
                    'Unlimited event types',
                    'SMS + WhatsApp + Email reminders',
                    'Calendar sync (Google, Outlook, Apple)',
                    'Email signature creator & QR booking',
                    'PayPal payments at booking',
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Running it alongside Calendly? Take your time — no charge until <strong>{firstChargeDate60}</strong>.
              </div>

              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input
                  type="checkbox"
                  checked={trialAgreed}
                  onChange={e => setTrialAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  I agree to be charged $6/mo after my 60-day trial ends on {firstChargeDate60}, unless I cancel before then.
                </span>
              </label>

              {trialCheckoutError && (
                <p className="text-xs text-red-500 mb-3">{trialCheckoutError}</p>
              )}

              <button
                onClick={() => handleTrialCheckout(60)}
                disabled={!trialAgreed || trialCheckoutLoading}
                className="w-full py-3 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm mb-2 hover:opacity-90"
                style={{ backgroundColor: '#5864C6' }}
              >
                {trialCheckoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                Start Free Trial — No Charge Today
              </button>
            </div>
          );
        }

        // Fresh start — activate 14-day trial (no CC)
        if (fromCalendly === false && showTrialOffer) {
          return (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-brand-100 dark:bg-brand-900/30 mb-4">
                  <Zap className="h-8 w-8 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Start your free trial</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-sm mx-auto">
                  Full Pro access for 14 days — <strong className="text-slate-700 dark:text-slate-200">no credit card required</strong>. $6/mo after trial, cancel anytime.
                </p>
              </div>

              <div className="bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/40 rounded-xl p-4 mb-5">
                <div className="space-y-2">
                  {[
                    'Unlimited event types',
                    'SMS + WhatsApp + Email reminders',
                    'Calendar sync (Google, Outlook, Apple)',
                    'Email signature creator & QR booking',
                    'PayPal payments at booking',
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-brand-800 dark:text-brand-300">
                      <Check className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {trialCheckoutError && (
                <p className="text-xs text-red-500 mb-3">{trialCheckoutError}</p>
              )}

              <button
                onClick={handleActivateFreeTrialdirect}
                disabled={trialCheckoutLoading}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                {trialCheckoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Start Free Trial — No Charge Today
              </button>
            </div>
          );
        }

        return (
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
                <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome to PinOnIt!</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-sm mx-auto">
                Let's get your scheduling page set up in just a few minutes.
              </p>
            </div>

            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 text-center">
              Are you switching from Calendly?
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { val: true, label: 'Switching from Calendly?', icon: '📅', desc: 'Import your events and run both side by side. 60 days Pro free — no charge until day 61.' },
                { val: false, label: 'Starting fresh', icon: '🚀', desc: 'Full Pro access for 14 days free. $6/mo after trial, cancel anytime.' },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  onClick={() => setFromCalendly(opt.val)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    fromCalendly === opt.val
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-2">{opt.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>

            {fromCalendly === true && (() => {
              const hasImportPreview =
                !scraping &&
                !scrapeError &&
                (scrapedEvents.length > 0 || !!importedProfile || importedAvailability.length > 0);
              const eventCount = scrapedEvents.length;
              const hasAvailability = importedAvailability.length > 0;
              const hasProfile = !!importedProfile;

              if (hasImportPreview) {
                return (
                  <div className="mb-4 space-y-5">
                    <div className="text-center mb-2">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">Here&apos;s what we found</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Does this look right?</p>
                    </div>
                    {importedProfile && (
                      <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                        {importedProfile.avatar_url ? (
                          <img
                            src={importedProfile.avatar_url}
                            alt=""
                            className="h-16 w-16 rounded-full object-cover border-2 border-indigo-100 dark:border-indigo-900"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl font-bold">
                            {(importedProfile.full_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {importedProfile.full_name ?? 'Your profile'}
                          </p>
                          {importedProfile.timezone && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">{importedProfile.timezone}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {eventCount > 0 && (
                      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Event types</p>
                        </div>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                          {scrapedEvents.map((e, i) => (
                            <li key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{e.name}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {e.duration_minutes} min
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {calendlyLocationLabel(e.location_type, e.location)}
                                  </span>
                                </div>
                              </div>
                              <span
                                className="h-3 w-3 rounded-full shrink-0 mt-1"
                                style={{ backgroundColor: e.color || '#5864C6' }}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {hasAvailability && (
                      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Weekly availability</p>
                        </div>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                          {[...importedAvailability]
                            .sort((a, b) => a.day_of_week - b.day_of_week)
                            .map((slot, i) => (
                              <li key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {AVAIL_DAY_SHORT[slot.day_of_week]}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {formatAvailTime(slot.start_time)} – {formatAvailTime(slot.end_time)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 space-y-1.5">
                      {eventCount > 0 && (
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          ✓ {eventCount} event type{eventCount === 1 ? '' : 's'} imported
                        </p>
                      )}
                      {hasAvailability && (
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          ✓ Availability imported
                        </p>
                      )}
                      {hasProfile && (
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          ✓ Profile synced
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCalendlyImportContinue()}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-base font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-colors"
                    >
                      {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                      Looks good, continue
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                );
              }

              return (
                <div className="mb-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
                  {scraping ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                      <p className="text-base font-semibold text-blue-900 dark:text-blue-300">Importing from Calendly…</p>
                      <p className="text-sm text-blue-600/80 dark:text-blue-400/80">Pulling your profile, event types, and availability</p>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleConnectCalendly()}
                        disabled={calendlyConnecting}
                        className="w-full flex flex-col items-center gap-1 py-3 px-4 bg-white border-2 border-blue-600 text-blue-600 rounded-xl hover:bg-blue-50 disabled:opacity-50 transition-colors mb-4"
                      >
                        <span className="flex items-center justify-center gap-3 font-semibold">
                          {calendlyConnecting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <img src="https://calendly.com/favicon.ico" alt="" className="w-5 h-5" />
                          )}
                          Connect Calendly Account (Recommended)
                        </span>
                        <span className="text-xs font-normal text-blue-500 dark:text-blue-400">
                          Imports your full schedule, availability, meeting links & profile — 2 minutes
                        </span>
                      </button>

                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                        <span className="text-base font-semibold text-gray-500 dark:text-slate-400">or</span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                      </div>

                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">Paste your Calendly profile URL</p>
                      <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mb-1">Basic import — event names and durations only</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">e.g. https://calendly.com/yourname</p>
                      <div className="flex gap-2">
                        <input
                          value={calendlyUrl}
                          onChange={e => setCalendlyUrl(e.target.value)}
                          placeholder="https://calendly.com/yourname"
                          className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => void handleScrape()}
                          disabled={scraping || calendlyConnecting || (!calendlyConnected && !calendlyUrl.trim())}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          {scraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          Import
                        </button>
                      </div>
                      {oauthBanner && importSource === 'scrape' && (
                        <div className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{oauthBanner}</span>
                        </div>
                      )}
                    </>
                  )}
                  {scrapeError && <p className="text-xs text-red-500">{scrapeError}</p>}
                </div>
              );
            })()}

            {!(
              fromCalendly === true &&
              !scraping &&
              !scrapeError &&
              (scrapedEvents.length > 0 || !!importedProfile || importedAvailability.length > 0)
            ) && (
              <NavButtons
                onNext={async () => {
                  if (fromCalendly === false) {
                    if (!isAlreadyPro) { setShowTrialOffer(true); return; }
                  }
                  await saveStep(STEPS.indexOf('welcome') + 1);
                  goNext();
                }}
                nextLabel={
                  fromCalendly === null ? 'Get Started' : fromCalendly ? 'Skip import' : 'Continue'
                }
                nextDisabled={fromCalendly === null}
                showBack={false}
              />
            )}
          </div>
        );
      }

      // ── Step: Custom booking URL ─────────────────────────────────────────────
      case 'username':
        return (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Create your booking URL</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">This is the link you share with clients</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
              <span className="text-gray-400 dark:text-slate-500 text-sm shrink-0">pinonit.com/</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="yourname"
                className="flex-1 bg-transparent text-sm font-medium text-gray-900 dark:text-white outline-none"
              />
              {slugStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Lowercase letters, numbers, and hyphens only</p>
            {usernameAvailable === false && (
              <p className="text-xs text-red-500 mt-1">That URL is taken — try another</p>
            )}
            {usernameAvailable === true && (
              <p className="text-xs text-green-500 mt-1">✓ Available!</p>
            )}
            {slugStatus === 'invalid' && username.trim().length > 0 && (
              <p className="text-xs text-amber-500 mt-1">Must be at least 3 characters.</p>
            )}
            <NavButtons
              onBack={goBack}
              onNext={handleSaveUsernameStep}
              onSkip={async () => { setUsername(''); setSlug(''); await saveStep(STEPS.indexOf('username') + 1); goNext(); }}
              nextDisabled={!!username.trim() && usernameAvailable === false}
              nextLabel="Continue"
              loading={saving}
            />
          </div>
        );

      // ── Step: Phone for host reminders ───────────────────────────────────────
      case 'phone': {
        const canContinuePhone =
          !hostPhone.trim() ||
          (hostPhone.trim().length > 0 && (hostSmsOptIn || hostWhatsappOptIn));
        return (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Your phone number</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Optional — receive your own PinOnIt booking notifications by SMS or WhatsApp.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <input
                type="tel"
                value={hostPhone}
                onChange={(e) => setHostPhone(e.target.value)}
                onBlur={(e) => { if (e.target.value.trim()) setHostPhone(blurFormatPhone(e.target.value)); }}
                placeholder={PHONE_PLACEHOLDER}
                className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <p className="text-xs text-slate-400">{PHONE_HINT}</p>
              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hostSmsOptIn}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHostSmsOptIn(checked);
                      setHostNotifyVia((prev) =>
                        checked ? (prev.includes('sms') ? prev : [...prev, 'sms']) : prev.filter((v) => v !== 'sms')
                      );
                    }}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    I agree to receive SMS notifications for my PinOnIt account at this number.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hostWhatsappOptIn}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHostWhatsappOptIn(checked);
                      setHostNotifyVia((prev) =>
                        checked ? (prev.includes('whatsapp') ? prev : [...prev, 'whatsapp']) : prev.filter((v) => v !== 'whatsapp')
                      );
                    }}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    I agree to receive WhatsApp notifications for my PinOnIt account at this number.
                  </span>
                </label>
              </div>
              <SmsBookingConsent />
              {hostPhone.trim() && !hostSmsOptIn && !hostWhatsappOptIn && (
                <p className="text-red-500 text-xs">
                  Please check at least one opt-in option above, or click Skip.
                </p>
              )}
            </div>
            <NavButtons
              onBack={goBack}
              onNext={handleSavePhoneStep}
              onSkip={async () => {
                setHostPhone('');
                setHostNotifyVia([]);
                setHostSmsOptIn(false);
                setHostWhatsappOptIn(false);
                await saveStep(STEPS.indexOf('phone') + 1);
                goNext();
              }}
              nextLabel="Continue"
              nextDisabled={!canContinuePhone}
              loading={saving}
            />
          </div>
        );
      }

      // ── Step: Timezone ───────────────────────────────────────────────────────
      case 'timezone': {
        const timezoneOptions = typeof Intl.supportedValuesOf === 'function'
          ? Intl.supportedValuesOf('timeZone')
          : [...TIMEZONES];
        return (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Your timezone</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">So bookings show the right time for you and your clients</p>
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <NavButtons
              onBack={goBack}
              onNext={handleSaveTimezoneStep}
              nextLabel="Continue"
              loading={saving}
            />
          </div>
        );
      }

      // ── Step 1: Connect calendar ──────────────────────────────────────────────
      case 'calendar':
        if (calendars.length > 0) {
          return (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                  <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Calendar already connected!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Your calendar is set up and preventing double-bookings automatically.
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {calendars.map(cal => (
                  <div key={cal.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900/50 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/10">
                    <ProviderIcon provider={cal.provider} size={18} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {cal.calendar_name || cal.provider_account_email || cal.provider}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">{cal.provider}</p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold connected">
                      <Check className="h-3.5 w-3.5" /> Connected
                    </span>
                  </div>
                ))}
              </div>

              <NavButtons
                onBack={goBack}
                onNext={async () => { await saveStep(STEPS.indexOf('calendar') + 1); await clearWizardActive(); goNext(); }}
                nextLabel="Continue"
              />
            </div>
          );
        }

        return (
          <div>
            {showCalendlySwitcherBanner && (
              <div className="mb-4 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-800 dark:text-indigo-300">
                Welcome from our setup assistant! We noticed you use Calendly — import your events below.
              </div>
            )}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Connect your first calendar</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                This prevents double-bookings by checking your real availability before confirming any meeting.
              </p>
              {preferredCalendar && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
                  Recommended for you: {preferredCalendar === 'google' ? 'Google Calendar' : 'Outlook / Office 365'}
                </p>
              )}
            </div>

            {calError && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {calError}
              </div>
            )}

            <div className="space-y-2 mb-4">
              {[
                { provider: 'google' as const, label: 'Google Calendar', desc: 'Gmail or Google Workspace' },
                { provider: 'outlook' as const, label: 'Outlook / Office 365', desc: 'Microsoft accounts' },
              ].map(({ provider, label, desc }) => {
                const connected = calendars.find(c => c.provider === provider);
                const recommended = preferredCalendar === provider;
                return (
                  <button
                    key={provider}
                    onClick={() => !connected && handleConnectCalendar(provider)}
                    disabled={!!connected || calConnecting === provider}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                      connected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                        : recommended
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-300 dark:ring-indigo-700'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <ProviderIcon provider={provider} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{connected ? connected.provider_account_email || 'Connected' : desc}</p>
                    </div>
                    {connected ? (
                      <span className="shrink-0 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold connected">
                        <Check className="h-4 w-4" /> Connected
                      </span>
                    ) : calConnecting === provider ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                    ) : (
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">Connect →</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              You can also connect Apple iCloud or an iCal URL from the <strong>Availability</strong> page later.
            </div>

            <NavButtons
              onBack={goBack}
              onNext={async () => { await saveStep(STEPS.indexOf('calendar') + 1); await clearWizardActive(); goNext(); }}
              onSkip={async () => { await saveStep(STEPS.indexOf('calendar') + 1); await clearWizardActive(); goNext(); }}
              nextLabel={calendars.length > 0 ? 'Continue' : 'Continue without calendar'}
            />
          </div>
        );

      // ── Step 2: Calendar purpose ──────────────────────────────────────────────
      case 'calendar_purpose':
        if (calendars.length === 0) {
          goNext();
          return null;
        }
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">How would you like to use each calendar?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You can use different calendars for scheduling vs. reminders.
              </p>
            </div>

            <div className="space-y-3">
              {calendars.map(cal => {
                const purpose = calPurposes[cal.id] ?? { scheduling: true, reminders: true };
                return (
                  <div key={cal.id} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ProviderIcon provider={cal.provider} size={16} />
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {cal.calendar_name || cal.provider_account_email || cal.provider}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: 'scheduling' as const, label: 'Use for scheduling', desc: "Block this calendar's busy times to prevent double-bookings" },
                        { key: 'reminders' as const, label: 'Use for all other reminders', desc: 'Check this calendar for all automated reminder notifications' },
                      ].map(opt => (
                        <label key={opt.key} className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={purpose[opt.key]}
                            onChange={() => setCalPurposes(prev => {
                              const current = prev[cal.id] ?? { scheduling: true, reminders: true };
                              return { ...prev, [cal.id]: { ...current, [opt.key]: !current[opt.key] } };
                            })}
                            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-slate-900 flex flex-wrap items-center gap-1.5">
                              {opt.label}
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                                Recommended
                              </span>
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <NavButtons
              onBack={goBack}
              onNext={async () => { await saveCalendarPurposes(); await saveStep(STEPS.indexOf('calendar_purpose') + 1); goNext(); }}
              onSkip={async () => { await saveCalendarPurposes(); await saveStep(STEPS.indexOf('calendar_purpose') + 1); goNext(); }}
            />
          </div>
        );

      // ── Step 3: Contacts ──────────────────────────────────────────────────────
      case 'contacts':
        return (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-4">
                <Users className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Your contacts</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Your contacts are <strong>automatically added</strong> whenever someone books a meeting with you — no manual work needed.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { icon: Calendar, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20', title: 'Auto-populated from bookings', desc: 'Every person who books with you is saved as a contact automatically.' },
                { icon: Mail, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', title: 'Email contacts directly', desc: 'Send your booking link to any contact from the Contacts page.' },
                { icon: Users, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', title: 'Manual import', desc: 'You can also add contacts manually or in bulk from the Contacts page.' },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Import contacts now */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Import existing contacts now</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Google */}
                <button
                  type="button"
                  onClick={handleContactsGoogleImport}
                  disabled={contactsGoogleConnecting || contactsOutlookConnecting}
                  className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl transition-all disabled:opacity-60 group"
                >
                  {contactsGoogleConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                  ) : (
                    <ProviderIcon provider="google" size={18} />
                  )}
                  <div className="text-left">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">Google</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Import contacts</p>
                  </div>
                </button>

                {/* Outlook */}
                <button
                  type="button"
                  onClick={handleContactsOutlookImport}
                  disabled={contactsGoogleConnecting || contactsOutlookConnecting}
                  className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl transition-all disabled:opacity-60 group"
                >
                  {contactsOutlookConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                  ) : (
                    <ProviderIcon provider="outlook" size={18} />
                  )}
                  <div className="text-left">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">Outlook</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Import contacts</p>
                  </div>
                </button>
              </div>
              {contactsImportError && (
                <p className="text-xs text-red-500 mt-2">{contactsImportError}</p>
              )}
            </div>

            <NavButtons
              onBack={goBack}
              onNext={async () => { await saveStep(STEPS.indexOf('contacts') + 1); goNext(); }}
              onSkip={async () => { await saveStep(STEPS.indexOf('contacts') + 1); goNext(); }}
              nextLabel="Continue"
            />
          </div>
        );

      // ── Step: Profile / notifications ───────────────────────────────────────
      case 'profile':
        return (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">How should we reach you?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add your phone numbers for SMS, voice, and WhatsApp reminders. You can change these anytime in Settings.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Phone number</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value)}
                  onBlur={e => { if (e.target.value.trim()) setProfilePhone(blurFormatPhone(e.target.value)); }}
                  placeholder={PHONE_PLACEHOLDER}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{PHONE_HINT}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Used for SMS reminders and voice call alerts.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">WhatsApp number</label>
                <input
                  type="tel"
                  value={profileWhatsapp}
                  onChange={e => setProfileWhatsapp(e.target.value)}
                  onBlur={e => { if (e.target.value.trim()) setProfileWhatsapp(blurFormatPhone(e.target.value)); }}
                  placeholder={PHONE_PLACEHOLDER}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                  Leave blank to use your phone number above for WhatsApp. Enter a different number if your WhatsApp is on a separate device.
                </p>
              </div>
              <SmsBookingConsent className="text-xs text-gray-500 dark:text-slate-400 mt-1" />
            </div>

            <NavButtons
              onBack={goBack}
              onNext={handleSaveProfileStep}
              onSkip={async () => { await saveStep(STEPS.indexOf('profile') + 1); goNext(); }}
              nextLabel="Continue"
              loading={saving}
            />
          </div>
        );

      // ── Step: Booking link ──────────────────────────────────────────────────
      case 'booking_link': {
        if (existingServices === null) {
          return (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          );
        }

        if (existingServices.length > 0) {
          return (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                  <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Your booking links are all set!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  You already have event types created. Guests can book with you right now.
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {existingServices.map(svc => (
                  <div key={svc.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: svc.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{svc.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{svc.duration_minutes} min</p>
                    </div>
                    <button
                      onClick={async () => {
                        await persistCompleted();
                        await clearWizardActive();
                        if (onClose) onClose();
                        navigate(`/services?edit=${svc.id}`);
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all"
                    >
                      <Pencil className="h-3.5 w-3.5" /> View &amp; Edit
                    </button>
                  </div>
                ))}
              </div>

              <NavButtons
                onBack={goBack}
                onNext={async () => { await saveStep(STEPS.indexOf('booking_link') + 1); goNext(); }}
                nextLabel="Continue"
              />
            </div>
          );
        }

        return (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Create your first booking link</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Set up your event type and shareable URL. You can always change this later.
              </p>
            </div>

            <div className="space-y-4">
              {/* Event name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Event name</label>
                <input
                  value={eventName}
                  onChange={e => setEventName(e.target.value)}
                  placeholder="30-Minute Meeting"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map(d => (
                    <button
                      key={d}
                      onClick={() => setEventDuration(d)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-all border-2 ${
                        eventDuration === d
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Color</label>
                <ColorSwatchRow value={eventColor} onChange={setEventColor} size="sm" />
              </div>

              {/* Booking URL slug + timezone are collected earlier in the wizard */}

              {/* Calendar selection */}
              {calendars.filter(c => c.provider !== 'zoom').length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Write bookings to calendars</label>
                  <div className="space-y-2">
                    {calendars.filter(c => c.provider !== 'zoom').map(cal => (
                      <label key={cal.id} className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCalendarIds.length === 0 ? true : selectedCalendarIds.includes(cal.id)}
                          onChange={() => setSelectedCalendarIds(prev => {
                            const full = calendars.filter(c => c.provider !== 'zoom').map(c => c.id);
                            const base = prev.length === 0 ? full : prev;
                            return base.includes(cal.id) ? base.filter(id => id !== cal.id) : [...base, cal.id];
                          })}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        <ProviderIcon provider={cal.provider} size={16} />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {cal.calendar_name || cal.provider_account_email || cal.provider}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <NavButtons
              onBack={goBack}
              onNext={handleCreateBookingLink}
              loading={saving}
              nextDisabled={!eventName.trim() || slugStatus === 'taken' || slugStatus === 'invalid'}
              nextLabel="Create booking link"
            />
          </div>
        );
      }

      // ── Step 5: Video conferencing ────────────────────────────────────────────
      case 'video':
        return (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Add video conferencing</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Auto-generate meeting links when someone books with you. Already connected calendars are detected automatically.
              </p>
            </div>

            {calError && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {calError}
              </div>
            )}

            <div className="space-y-2 mb-5">
              {[
                { provider: 'google' as const, label: 'Google Meet', desc: 'Auto-generated via Google Calendar API', tag: 'via Google Calendar' },
                { provider: 'outlook' as const, label: 'Microsoft Teams', desc: 'Auto-generated via Microsoft Graph API', tag: 'via Outlook' },
                { provider: 'zoom' as const, label: 'Zoom', desc: 'Requires Zoom OAuth app connection', tag: 'OAuth required' },
              ].map(({ provider, label, desc, tag }) => {
                const connected = videoCalendars.find(c => c.provider === provider)
                  || (provider !== 'zoom' && calendars.find(c => c.provider === provider));
                return (
                  <button
                    key={provider}
                    onClick={() => !connected && handleConnectCalendar(provider)}
                    disabled={!!connected || calConnecting === provider}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                      connected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <ProviderIcon provider={provider} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{connected ? (connected.provider_account_email || 'Connected') : desc}</p>
                    </div>
                    {connected ? (
                      <span className="shrink-0 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="h-4 w-4" /> Done
                      </span>
                    ) : calConnecting === provider ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                    ) : (
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5">{tag}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              Priority order when generating links: <strong>Google Meet → Teams → Zoom</strong>
            </div>

            <NavButtons
              onBack={goBack}
              onNext={async () => { await saveStep(STEPS.indexOf('video') + 1); goNext(); }}
              onSkip={async () => { await saveStep(STEPS.indexOf('video') + 1); goNext(); }}
              nextLabel="Finish setup"
            />
          </div>
        );

      // ── Done ──────────────────────────────────────────────────────────────────
      case 'done':
        return (
          <div className="relative overflow-hidden">
            <canvas
              ref={confettiRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 0 }}
            />
            <div className="relative" style={{ zIndex: 1 }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                  <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">You're all set!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  Your scheduling page is live and ready to share.
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {[
                  { icon: Calendar, label: 'Calendars connected', value: `${calendars.length} calendar${calendars.length !== 1 ? 's' : ''}`, done: calendars.length > 0 },
                  { icon: Zap, label: 'Event type created', value: eventName || 'Meeting', done: !!createdServiceId },
                  { icon: Globe, label: 'Booking URL', value: bookingUrl || `${window.location.origin}/book/${user?.id}`, done: true },
                  { icon: Video, label: 'Video conferencing', value: videoCalendars.length > 0 ? 'Auto-generate enabled' : 'Not connected', done: videoCalendars.length > 0 },
                ].map(({ icon: Icon, label, value, done }) => (
                  <div key={label} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${done ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <Icon className={`h-4 w-4 ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{value}</p>
                    </div>
                    {done && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </div>
                ))}
              </div>

              {bookingUrl && (
                <div className="mb-5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-500 uppercase tracking-wide mb-2">Your booking link</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-mono text-indigo-800 dark:text-indigo-400 truncate">{bookingUrl}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors hover:opacity-90"
                      style={{ backgroundColor: '#5864C6' }}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <a
                      href={bookingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 p-1.5 text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={handleFinish}
                className="w-full py-3 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2 hover:opacity-90"
                style={{ backgroundColor: '#5864C6' }}
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────────
  const content = (
    <div className="w-full max-w-lg">
      {step !== 'done' && (
        <ProgressBar stepIndex={stepIndex} total={STEPS.length} />
      )}
      {renderStep()}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) handleDismiss(); }}>
        <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 md:p-8 relative">
          {onClose && (
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 md:p-8">
        {content}
      </div>
    </div>
  );
}
