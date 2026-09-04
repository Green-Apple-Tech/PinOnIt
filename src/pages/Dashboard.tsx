import { useState, useEffect, useRef, Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ExpiredBanner } from '../components/ExpiredBanner';
import { useAuth } from '../hooks/useAuth';
import { OnboardingWizard, wizardIsActive, wizardSavedStep, onboardingIsCompleted } from '../components/OnboardingWizard';
import { wizardStartIndex } from '../lib/wizardSteps';
import { clearStaleOnboardingLocalState, markOnboardingCompletedLocal } from '../lib/onboardingState';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import { syncStripeSubscription } from '../lib/stripe';
import { effectivePlan, isActivePlan } from '../lib/plan';
import { SMS_OPT_OUT_FOOTER } from '../lib/smsOptOut';
import type { Service } from '../lib/types';
import { LogOut, X, Check, Sun, Moon, Link2, Video, Phone, MapPin, ChevronRight, Loader2, Plus, ChevronLeft, LayoutGrid, Menu, Sparkles, Wrench as Tool, ChevronDown } from 'lucide-react';
import {
  MORE_TOOLS_HUB_PATH,
  buildSidebarNav,
  isDashboardNavActive,
  isMoreToolsSectionActive,
} from '../lib/dashboardNav';
import { DashboardHome, type DashboardBookingGlance } from '../components/DashboardHome';
import { parseRevealedTools, revealTool } from '../lib/progressiveDisclosure';
import { defaultAvailabilityRows } from '../lib/availabilityGrid';
import { PageHelpButton } from '../components/PageHelp';
import { AddToHomeScreenPrompt } from '../components/AddToHomeScreenPrompt';
import { EsignPromoBar } from '../components/EsignPromoBar';
import {
  EXAMPLE_PAID_CONSULTATION_NAME,
  isExamplePaidConsultation,
} from '../lib/eventTypes';
type NavItem = {
  to: string;
  icon: typeof LayoutGrid;
  label: string;
  badge?: string;
  children?: NavItem[];
  docsCombined?: boolean;
};

// ── Quick-create booking link modal ──────────────────────────────────────────

type LocationType = 'zoom' | 'phone' | 'in_person' | 'link';

interface CreateLinkModalProps {
  profile: ReturnType<typeof useAuth>['profile'];
  onClose: () => void;
  onCreated: (service: Service, bookingUrl: string) => void;
}

function CreateLinkModal({ profile, onClose, onCreated }: CreateLinkModalProps) {
  const [locationType, setLocationType] = useState<LocationType>('zoom');
  const [locationDetail, setLocationDetail] = useState('');
  const [locationError, setLocationError] = useState('');
  const [duration, setDuration] = useState(60);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [reminderEmail, setReminderEmail] = useState(true);
  const [reminderSms, setReminderSms] = useState(false);
  const [reminderWhatsapp, setReminderWhatsapp] = useState(false);

  const locationOptions: { key: LocationType; icon: typeof Video; label: string; placeholder: string }[] = [
    { key: 'zoom', icon: Video, label: 'Zoom / Video', placeholder: 'https://zoom.us/j/...' },
    { key: 'phone', icon: Phone, label: 'Phone call', placeholder: '+1 (555) 000-0000' },
    { key: 'in_person', icon: MapPin, label: 'In person', placeholder: '123 Main St, City, State' },
    { key: 'link', icon: Link2, label: 'Other link', placeholder: 'https://meet.google.com/...' },
  ];

  const selected = locationOptions.find((o) => o.key === locationType)!;
  const defaultName = `${duration} Min Meeting`;

  const handleCreate = async () => {
    if (!profile) { setCreateError('Not logged in. Please refresh and try again.'); return; }
    if ((locationType === 'zoom' || locationType === 'link') && !locationDetail.trim()) {
      setLocationError('Please enter a meeting URL.');
      return;
    }
    setCreating(true);
    setCreateError('');

    const serviceName = name.trim() || defaultName;
    const dbLocationType =
      locationType === 'zoom' || locationType === 'link' ? 'video' : locationType === 'phone' ? 'phone' : 'in_person';

    let slug = profile.slug;
    if (!slug) {
      const base = (profile.full_name || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      slug = base || profile.id.slice(0, 8);
      await supabase.from('profiles').update({ slug }).eq('id', profile.id);
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        host_id: profile.id,
        name: serviceName,
        duration_minutes: duration,
        price_cents: 0,
        is_active: true,
        location_type: dbLocationType,
        location: locationDetail.trim() || '',
        description: '',
        color: '#1a56db',
      })
      .select()
      .maybeSingle();

    if (error) {
      setCreateError(error.message || 'Failed to create meeting link. Please try again.');
      setCreating(false);
      return;
    }
    if (!error && data) {
      const reminderChannels: Array<{ channel: 'email' | 'sms' | 'whatsapp'; subject: string | null; body: string }> = [];
      if (reminderEmail) {
        reminderChannels.push({
          channel: 'email',
          subject: 'Reminder: {{service_name}} in 1 hour',
          body: 'Hi {{guest_name}},\n\nJust a reminder that your {{service_name}} with {{host_name}} starts in 1 hour at {{time}} ({{timezone}}).\n\n{{location}}\n\nSee you soon!\n— {{host_name}}',
        });
      }
      if (reminderSms) {
        reminderChannels.push({
          channel: 'sms',
          subject: null,
          body: `Reminder: your {{service_name}} with {{host_name}} starts in 1 hour at {{time}}. {{location}} ${SMS_OPT_OUT_FOOTER}`,
        });
      }
      if (reminderWhatsapp) {
        reminderChannels.push({
          channel: 'whatsapp',
          subject: null,
          body: `Hi {{guest_name}}! Just a reminder that your *{{service_name}}* with {{host_name}} starts in 1 hour at {{time}}.\n\n{{location}}\n\n${SMS_OPT_OUT_FOOTER}`,
        });
      }
      for (const ch of reminderChannels) {
        const { data: tpl } = await supabase
          .from('message_templates')
          .insert({
            host_id: profile.id,
            name: `1 hour reminder (${ch.channel.toUpperCase()})`,
            type: 'reminder',
            channel: ch.channel,
            subject: ch.subject,
            body: ch.body,
            timing_offset_minutes: -60,
            is_active: true,
            language: 'en',
            auto_translate: false,
          })
          .select()
          .maybeSingle();
        if (tpl) {
          await supabase.from('reminder_rules').insert({
            host_id: profile.id,
            template_id: tpl.id,
            service_id: (data as Service).id,
            timing_offset_minutes: -60,
            is_active: true,
          });
        }
      }
      const bookingUrl = `${window.location.origin}/${slug}`;
      onCreated(data as Service, bookingUrl);
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Create a meeting link</h2>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">Guests schedule directly — no back-and-forth.</p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Duration</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    duration === d
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Meeting type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {locationOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setLocationType(opt.key)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                    locationType === opt.key
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.icon ? <opt.icon className="h-4 w-4 shrink-0" /> : null}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {locationType === 'zoom' || locationType === 'link' ? 'Meeting link' : locationType === 'phone' ? 'Your phone number' : 'Address'}
              {locationType === 'phone' || locationType === 'in_person'
                ? <span className="normal-case font-normal text-gray-400 ml-1">(optional)</span>
                : !locationDetail.trim()
                ? <span className="normal-case font-normal text-amber-500 ml-1">— add your link</span>
                : null
              }
            </label>
            <input
              type="text"
              value={locationDetail}
              onChange={(e) => {
                const val = e.target.value;
                setLocationDetail(val);
                setLocationError('');
                // Auto-detect meeting type from URL
                if (val.includes('meet.google.com')) setLocationType('link');
                else if (val.includes('zoom.us') || val.includes('zoom.com')) setLocationType('zoom');
                else if (val.includes('teams.microsoft.com') || val.includes('whereby.com') || val.includes('webex.com') || val.startsWith('https://')) setLocationType('link');
              }}
              placeholder={selected.placeholder}
              className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition text-sm ${
                locationError ? 'border-red-400' :
                (locationType === 'zoom' || locationType === 'link') && !locationDetail.trim()
                  ? 'border-amber-400 animate-border-pulse'
                  : 'border-gray-200'
              }`}
            />
            {locationError && <p className="text-xs text-red-500 mt-1">{locationError}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reminders — 1 hour before</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setReminderEmail((v) => !v)}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium border transition-all ${
                  reminderEmail ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  reminderEmail ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
                }`}>
                  {reminderEmail && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                Email
              </button>
              <button
                onClick={() => setReminderSms((v) => !v)}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium border transition-all ${
                  reminderSms ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  reminderSms ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
                }`}>
                  {reminderSms && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                SMS
              </button>
              <button
                onClick={() => setReminderWhatsapp((v) => !v)}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium border transition-all ${
                  reminderWhatsapp ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  reminderWhatsapp ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
                }`}>
                  {reminderWhatsapp && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                WhatsApp
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Name <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition text-sm"
            />
          </div>

          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{createError}</div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? 'Creating...' : `Create ${duration}-min meeting link`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user, profile, subscription, subscriptionLoaded, signOut, refreshProfile } = useAuth();
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const displayEmail = profile?.email || user?.email || '';
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<DashboardBookingGlance[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [calendarCount, setCalendarCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(() =>
    isMoreToolsSectionActive(location.pathname, location.search, location.hash),
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const planName = effectivePlan(subscription, profile);
  const [checklistDismissed, setChecklistDismissed] = useState(() => localStorage.getItem('onboarding_checklist_dismissed') === '1');
  const [liveSlug, setLiveSlug] = useState<string | null>(null);

  // Expand while inside More Tools; collapse automatically when you leave that section.
  useEffect(() => {
    setMoreToolsOpen(isMoreToolsSectionActive(location.pathname, location.search, location.hash));
  }, [location.pathname, location.search, location.hash]);

  const isCalendlyOAuthSuccessReturn = () => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('calendly_connected') === '1' ||
      params.get('calendly_success') === '1' ||
      params.get('calendly_success') === 'true'
    );
  };

  /** Re-open wizard after Calendly OAuth — not for completed hosts who connect outside the wizard. */
  const shouldReopenWizardForCalendly = () => {
    const params = new URLSearchParams(window.location.search);
    const hasSuccess = isCalendlyOAuthSuccessReturn();
    const hasError = !!params.get('calendly_error');
    if (!hasSuccess && !hasError) return false;
    if (hasError) return wizardIsActive();
    if (wizardIsActive()) return true;
    return !onboardingIsCompleted();
  };

  // Don't open from ?onboarding=1 until we know this isn't a returning host (avoids a first-time flash).
  const [showWizard, setShowWizard] = useState(() => shouldReopenWizardForCalendly());
  const [wizardUserRequested, setWizardUserRequested] = useState(false);
  const [wizardOpenCalendlyImport, setWizardOpenCalendlyImport] = useState(false);
  const [wizardChecked, setWizardChecked] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<number | undefined>(() => {
    if (shouldReopenWizardForCalendly()) return 0;
    if (!onboardingIsCompleted() && wizardIsActive()) return wizardSavedStep();
    return undefined;
  });
  const [wizardSession, setWizardSession] = useState(0);
  const [trialToast, setTrialToast] = useState<{ message: string } | null>(null);
  const examplePaidNormalized = useRef(false);

  // Re-fetch profile on mount and when returning to dashboard (e.g. after saving slug in Settings)
  useEffect(() => {
    if (!user) return;
    void refreshProfile();
  }, [user?.id, refreshProfile]);

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      void refreshProfile();
    }
  }, [location.pathname, refreshProfile]);

  useEffect(() => {
    if (profile?.slug) setLiveSlug(profile.slug);
  }, [profile?.slug]);

  // Handle ?checkout=success return from Stripe — sync plan, show toast, resume wizard
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') return;

    const stepParam = params.get('wizard_step');
    const trialDays = params.get('trial_days');

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await syncStripeSubscription(session.access_token);
      }
      await refreshProfile();
    })();

    if (trialDays) {
      const firstChargeDate = (() => {
        const days = Number(trialDays);
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      })();
      const message = trialDays === '60'
        ? `🎉 60-day Pro trial active — no charge until ${firstChargeDate}. Running it alongside Calendly? Take your time.`
        : `🎉 Pro trial active — ${trialDays} days free, no charge until ${firstChargeDate}.`;
      setTrialToast({ message });
    } else {
      setTrialToast({ message: 'You\'re on Pro — $8.99/mo, cancel anytime in Billing.' });
    }
    setTimeout(() => setTrialToast(null), 8000);

    if (stepParam !== null) {
      const stepIndex = Number(stepParam);
      setWizardInitialStep(stepIndex);
      setShowWizard(true);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('wizard_step');
    url.searchParams.delete('trial_days');
    window.history.replaceState({}, '', url.toString());
  }, [refreshProfile]);

  // Calendly OAuth return: reopen wizard when appropriate, always strip URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasSuccess = isCalendlyOAuthSuccessReturn();
    const err = params.get('calendly_error');
    if (!hasSuccess && !err) return;

    const reopen = shouldReopenWizardForCalendly();
    if (reopen) {
      setShowWizard(true);
      setWizardInitialStep(0);
      // Keep URL params — OnboardingWizard import/error effects read and clean them
      return;
    }

    if (hasSuccess) {
      setTrialToast({ message: 'Calendly connected successfully.' });
      setTimeout(() => setTrialToast(null), 5000);
    } else if (err) {
      setTrialToast({ message: `Calendly connection failed: ${err}` });
      setTimeout(() => setTrialToast(null), 8000);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('calendly_connected');
    url.searchParams.delete('calendly_success');
    url.searchParams.delete('calendly_error');
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Clean the ?onboarding=1 param from URL without navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendly_import') === '1') {
      setWizardOpenCalendlyImport(true);
      setWizardUserRequested(true);
      setShowWizard(true);
    }
    if (params.get('onboarding') === '1' || params.get('calendly_import') === '1') {
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding');
      url.searchParams.delete('calendly_import');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Reopen wizard after Calendly OAuth redirect that originated from the wizard
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('wizard') === 'true') {
      setShowWizard(true);
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // Auto-show wizard only for genuinely new users — runs once after ALL data has loaded
  useEffect(() => {
    if (wizardChecked || !profile || loading || !subscriptionLoaded) return;
    setWizardChecked(true);

    const isActivePro = isActivePlan(effectivePlan(subscription, profile));
    const established =
      profile.onboarding_completed === true
      || isActivePro
      || (calendarCount > 0 && services.length > 0)
      || (services.length > 0 && !!profile.slug);

            if (established) {
      markOnboardingCompletedLocal();
      if (!profile.onboarding_completed) {
        void supabase.from('profiles').update({ onboarding_completed: true, wizard_active: false }).eq('id', profile.id);
      }
      if (showWizard && !wizardUserRequested && !profile.wizard_active) {
        setShowWizard(false);
      } else if (profile.wizard_active && !wizardUserRequested) {
        setShowWizard(true);
        if (typeof profile.onboarding_step === 'number') setWizardInitialStep(profile.onboarding_step);
      }
      return;
    }

    if (!profile.wizard_active && onboardingIsCompleted()) {
      clearStaleOnboardingLocalState();
    }

    if (showWizard || profile.wizard_active) {
      setShowWizard(true);
      return;
    }

    setShowWizard(true);
  }, [profile, subscription, subscriptionLoaded, loading, wizardChecked, showWizard, wizardUserRequested, calendarCount, services]);

  // Hide setup checklist and mark onboarding complete when all steps are done
  useEffect(() => {
    if (!profile || loading) return;
    const allDone = calendarCount > 0 && services.length > 0 && !!profile.slug;
    if (!allDone) return;
    setChecklistDismissed(true);
    localStorage.setItem('onboarding_checklist_dismissed', '1');
    if (!profile.onboarding_completed) {
      void supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id);
    }
  }, [profile, loading, calendarCount, services.length]);

  // Seed default event types for brand-new users (once, when they have no services)
  useEffect(() => {
    if (!profile || loading) return;
    if (profile.onboarding_completed || services.length > 0) return;
    const defaults = [
      { name: '15 Minute Meeting', duration_minutes: 15, color: '#5864C6', price_cents: 0, is_active: true },
      { name: '30 Minute Meeting', duration_minutes: 30, color: '#3b82f6', price_cents: 0, is_active: true },
      { name: EXAMPLE_PAID_CONSULTATION_NAME, duration_minutes: 60, color: '#f59e0b', price_cents: 5000, is_active: false },
    ];
    (async () => {
      const { count } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', profile.id);
      if ((count ?? 0) > 0) return; // already have services
      const rows = defaults.map((d) => ({
        host_id: profile.id,
        name: d.name,
        duration_minutes: d.duration_minutes,
        color: d.color,
        description: '',
        price_cents: d.price_cents,
        is_active: d.is_active,
        meeting_type: 'one_on_one',
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 1,
        booking_window_days: 60,
        slot_increment_minutes: 15,
        allow_cancellation: true,
        allow_reschedule: true,
        cancellation_policy: '',
        location: '',
        location_type: 'video',
        payment_provider: 'none',
        paypal_currency: 'USD',
        booking_calendar_ids: [],
      }));
      const { data: inserted } = await supabase.from('services').insert(rows).select('*');
      if (inserted) setServices((prev) => [...prev, ...(inserted as Service[])]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, loading]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [bookRes, svcRes, calRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, status, start_time, guest_name, guest_email, services(name)')
          .eq('host_id', profile.id)
          .eq('status', 'confirmed')
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(8),
        supabase.from('services').select('*').eq('host_id', profile.id),
        supabase.from('connected_calendars').select('id', { count: 'exact', head: true }).eq('host_id', profile.id),
      ]);
      setBookings((bookRes.data as DashboardBookingGlance[]) ?? []);
      setServices(svcRes.data ?? []);
      setCalendarCount(calRes.count ?? 0);
      setLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (!profile || loading || examplePaidNormalized.current) return;
    const toFix = services.filter(
      (s) => isExamplePaidConsultation(s) && (s.is_active || s.name !== EXAMPLE_PAID_CONSULTATION_NAME),
    );
    if (toFix.length === 0) {
      if (services.length > 0) examplePaidNormalized.current = true;
      return;
    }
    examplePaidNormalized.current = true;
    void (async () => {
      const next = [...services];
      for (const svc of toFix) {
        const { data } = await supabase
          .from('services')
          .update({ name: EXAMPLE_PAID_CONSULTATION_NAME, is_active: false })
          .eq('id', svc.id)
          .eq('host_id', profile.id)
          .select()
          .maybeSingle();
        if (data) {
          const idx = next.findIndex((s) => s.id === svc.id);
          if (idx >= 0) next[idx] = data as Service;
        }
      }
      setServices(next);
    })();
  }, [profile, loading, services]);

  useEffect(() => {
    if (!profile?.id || loading) return;
    const have = parseRevealedTools(profile.revealed_tools);
    const run = async () => {
      let changed = false;
      let current = profile.revealed_tools;
      const bump = async (tool: 'paid-booking' | 'quotes' | 'group-scheduling' | 'analytics') => {
        const before = parseRevealedTools(current);
        if (before.includes(tool)) return;
        current = await revealTool(profile.id, tool, current);
        changed = true;
      };
      if (services.some((s) => (s.price_cents ?? 0) > 0 && !isExamplePaidConsultation(s))) await bump('paid-booking');
      if (services.some((s) => s.meeting_type === 'group')) await bump('group-scheduling');
      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', profile.id)
        .in('status', ['confirmed', 'completed']);
      if ((bookingCount ?? 0) >= 10) await bump('analytics');
      const needQuotes = !have.includes('quotes');
      const needPolls = !have.includes('group-scheduling');
      if (needQuotes || needPolls) {
        const [{ count: quoteCount }, { count: pollCount }] = await Promise.all([
          needQuotes
            ? Promise.all([
                supabase.from('host_quotes').select('id', { count: 'exact', head: true }).eq('host_id', profile.id),
                supabase.from('documents').select('id', { count: 'exact', head: true }).eq('sender_id', profile.id).in('document_type', ['quote', 'invoice', 'receipt']),
              ]).then(([a, b]) => ({ count: (a.count ?? 0) + (b.count ?? 0) }))
            : Promise.resolve({ count: 0 }),
          needPolls
            ? supabase.from('meeting_polls').select('id', { count: 'exact', head: true }).eq('host_id', profile.id)
            : Promise.resolve({ count: 0 }),
        ]);
        if ((quoteCount ?? 0) > 0) await bump('quotes');
        if ((pollCount ?? 0) > 0) await bump('group-scheduling');
      }
      if (changed) await refreshProfile();
    };
    void run();
  }, [
    profile?.id,
    loading,
    services,
    refreshProfile,
  ]);

  // Seed default availability (Mon-Fri 9–12 + 1–5, lunch off) for users with none
  useEffect(() => {
    if (!profile || loading) return;
    (async () => {
      const { count } = await supabase
        .from('availability')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', profile.id);
      if ((count ?? 0) > 0) return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) await supabase.from('profiles').update({ timezone: tz }).eq('id', profile.id);
      await supabase.from('availability').insert(defaultAvailabilityRows(profile.id));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, loading]);

  const handleCreated = (service: Service, _bookingUrl: string) => {
    setServices((prev) => [...prev, service]);
    setShowCreateModal(false);
  };

  const uiMode = profile?.ui_mode === 'advanced' ? 'advanced' : 'simple';
  const { primary: primaryNav, moreTools: moreToolsNav, settings: settingsNav } = buildSidebarNav(uiMode);
  const mainNavItems: NavItem[] = [
    ...primaryNav.map((item) => ({
      to: item.to,
      icon: item.icon,
      label: item.label,
      badge: item.badge,
      docsCombined: item.docsCombined,
    })),
    ...(moreToolsNav.length
      ? [{
          to: MORE_TOOLS_HUB_PATH,
          icon: Tool,
          label: 'More Tools',
          children: moreToolsNav.map((item) => ({
            to: item.path,
            icon: item.icon,
            label: item.label,
            badge: item.badge,
            docsCombined: item.docsCombined,
          })),
        } satisfies NavItem]
      : []),
    {
      to: settingsNav.to,
      icon: settingsNav.icon,
      label: settingsNav.label,
      badge: settingsNav.badge,
    },
  ];

  const isDashboardHome = location.pathname === '/dashboard';
  const isActive = (item: NavItem | string) => {
    if (typeof item === 'string') {
      if (item === MORE_TOOLS_HUB_PATH) {
        return location.pathname === MORE_TOOLS_HUB_PATH;
      }
      return isDashboardNavActive({ to: item, label: '' }, location.pathname, location.search, location.hash);
    }
    if (item.to === MORE_TOOLS_HUB_PATH) {
      return location.pathname === MORE_TOOLS_HUB_PATH;
    }
    return isDashboardNavActive(item, location.pathname, location.search, location.hash);
  };
  const initials = (displayName?.[0] ?? displayEmail?.[0] ?? '?').toUpperCase();

  const navLinkClass = (item: NavItem) => {
    const active = isActive(item);
    const padding = active ? 'pl-[calc(0.75rem-3px)] pr-3' : 'px-3';
    const highlight = item.docsCombined
      ? active
        ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 font-semibold border-l-[3px] border-violet-500 rounded-l-none'
        : 'text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10'
      : active
        ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-semibold border-l-[3px] border-brand-600 dark:border-brand-500 rounded-l-none'
        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-900';
    return `flex items-center gap-3 py-2.5 rounded-lg text-sm transition-colors ${padding} ${highlight}`;
  };

  const renderNavLabel = (item: NavItem, nested?: boolean) => {
    if (item.docsCombined) {
      return (
        <span className={`${nested ? 'truncate' : ''} leading-tight`}>
          Send Docs +{' '}
          <span className="font-sign-by-text text-[1.15rem] leading-none">Sign-by-Text</span>
        </span>
      );
    }
    return <span className={nested ? 'truncate' : ''}>{item.label}</span>;
  };

  const renderNavLink = (
    item: NavItem,
    opts?: { collapsed?: boolean; onNavigate?: () => void; nested?: boolean },
  ) => (
    <Link
      key={item.to + item.label}
      to={item.to}
      title={opts?.collapsed ? item.label : undefined}
      onClick={opts?.onNavigate}
      className={`${navLinkClass(item)} ${opts?.collapsed ? 'justify-center px-3' : ''} ${
        opts?.nested ? 'text-[13px] py-2' : ''
      }`}
    >
      {item.icon ? <item.icon className="h-[18px] w-[18px] shrink-0" /> : null}
      {!opts?.collapsed && (
        <>
          {renderNavLabel(item, opts?.nested)}
          {item.badge ? (
            <span className="ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );

  const renderMoreToolsGroup = (
    item: NavItem,
    opts?: { onNavigate?: () => void },
  ) => {
    const parentActive = isActive(item);
    const parentPadding = parentActive ? 'pl-[calc(0.75rem-3px)] pr-1' : 'pl-3 pr-1';
    return (
      <div key={item.to} className="space-y-0.5">
        <div
          className={`flex items-center rounded-lg text-sm transition-colors ${parentPadding} ${
            parentActive
              ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-semibold border-l-[3px] border-brand-600 dark:border-brand-500 rounded-l-none'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-900'
          }`}
        >
          <Link
            to={item.to}
            onClick={() => {
              setMoreToolsOpen(true);
              opts?.onNavigate?.();
            }}
            className="flex flex-1 items-center gap-3 py-2.5 min-w-0"
          >
            {item.icon ? <item.icon className="h-[18px] w-[18px] shrink-0" /> : null}
            <span className="truncate">{item.label}</span>
          </Link>
          <button
            type="button"
            aria-expanded={moreToolsOpen}
            aria-label={moreToolsOpen ? 'Collapse More Tools' : 'Expand More Tools'}
            onClick={() => setMoreToolsOpen((open) => !open)}
            className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${moreToolsOpen ? '' : '-rotate-90'}`} />
          </button>
        </div>
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            moreToolsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className="ml-3 pl-2 border-l border-gray-200 dark:border-slate-800 space-y-0.5">
              {item.children?.map((child) => renderNavLink(child, { ...opts, nested: true }))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNavItem = (item: NavItem, opts?: { collapsed?: boolean; onNavigate?: () => void }) => {
    if (item.children?.length && !opts?.collapsed) {
      return renderMoreToolsGroup(item, opts);
    }
    return renderNavLink(item, opts);
  };

  const renderAccountBar = (opts?: { compact?: boolean }) => (
    <div className={`flex items-center gap-2 ${opts?.compact ? '' : 'gap-2.5'}`}>
      <div className="h-8 w-8 bg-gray-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-700 dark:text-white shrink-0">
        {initials}
      </div>
      {!opts?.compact && (
        <>
          <div className="hidden sm:block min-w-0 max-w-[140px] lg:max-w-[180px]">
            <p className="text-sm font-medium truncate leading-tight">{displayName || 'User'}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{displayEmail}</p>
          </div>
          <span className="hidden sm:inline shrink-0 text-xs px-2 py-0.5 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 rounded-full font-medium border border-brand-100 dark:border-brand-500/20">
            {planName.charAt(0).toUpperCase() + planName.slice(1)}
          </span>
        </>
      )}
      <div className="flex items-center gap-0.5">
        <PageHelpButton compact={opts?.compact} />
        <button onClick={toggleTheme} className="min-h-11 min-w-11 inline-flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors rounded-lg" title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button onClick={() => setShowLogoutConfirm(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors rounded-lg" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white flex flex-col transition-colors">
      <div className="sticky top-0 z-50 shrink-0">
        <EsignPromoBar to="/dashboard/documents" />
      </div>
      <div className="flex flex-1">

      {/* ── Trial success toast ── */}
      {trialToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3.5 text-white text-sm font-semibold rounded-2xl shadow-xl animate-fade-in max-w-sm w-full mx-4" style={{ backgroundColor: '#5864C6' }}>
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="flex-1">{trialToast.message}</span>
          <button onClick={() => setTrialToast(null)} className="p-0.5 text-white/70 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <ExpiredBanner profile={profile} subscription={subscription} />

      {/* ── Desktop Sidebar ── */}
      <aside className={`hidden md:flex flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-60'}`}>

        {/* Logo */}
        <div className={`flex items-center justify-between px-4 py-5 ${sidebarCollapsed ? 'px-3' : ''}`}>
          {!sidebarCollapsed && (
            <a href="https://pinonit.com" target="_blank" rel="noopener noreferrer">
              <img src="/pinonit_logo.png" alt="Pin on It" className="h-8 w-auto" />
            </a>
          )}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition-colors ml-auto"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 pb-4 space-y-0.5 overflow-y-auto">
          {mainNavItems.map((item) => renderNavItem(item, { collapsed: sidebarCollapsed }))}
        </nav>
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 flex flex-col z-10">
            <div className="flex items-center justify-between px-4 py-5">
              <a href="https://pinonit.com" target="_blank" rel="noopener noreferrer">
                <img src="/pinonit_logo.png" alt="Pin on It" className="h-8 w-auto" />
              </a>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-3 mb-4">
              <button
                onClick={() => { setShowCreateModal(true); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-2 border-2 border-brand-600 text-gray-900 dark:text-white font-semibold rounded-full px-4 py-2.5 text-sm transition-all hover:bg-brand-50 dark:hover:bg-brand-950/30"
              >
                <Plus className="h-4 w-4 text-brand-600" />
                Create
              </button>
            </div>
            <nav className="flex-1 px-2 pb-4 space-y-0.5 overflow-y-auto">
              {mainNavItems.map((item) => renderNavItem(item, { onNavigate: () => setMobileMenuOpen(false) }))}
              <Link
                to="/why-pinonit"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg text-sm font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10"
              >
                Why we beat Calendly
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Link>
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Desktop account bar — upper right */}
        <header className="hidden md:flex sticky top-10 z-40 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-2.5 items-center justify-between gap-3 shrink-0">
          <Link
            to="/why-pinonit"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
          >
            Why we beat Calendly <ChevronRight className="h-4 w-4" />
          </Link>
          {renderAccountBar()}
        </header>

        {/* Mobile top bar */}
        <header className="md:hidden border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-10 z-40 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileMenuOpen(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          <a href="https://pinonit.com" target="_blank" rel="noopener noreferrer">
            <img src="/pinonit_logo.png" alt="Pin on It" className="h-8 w-auto" />
          </a>
          {renderAccountBar({ compact: true })}
        </header>

        {/* Dashboard home */}
        {isDashboardHome && (
          <>
            {/* Onboarding checklist — kept above the new ops dashboard */}
            <div className="px-4 md:px-8 pt-4 md:pt-6 max-w-5xl w-full">
            {!loading && !checklistDismissed && (() => {
              const hasCalendar = calendarCount > 0;
              const hasService = services.length > 0;
              const hasSlug = !!(profile?.slug || liveSlug);
              const slugDisplay = profile?.slug || liveSlug || '';
              const steps = [
                { label: 'Connect your calendar', sub: 'Sync Google or Outlook to prevent double-bookings', done: hasCalendar, to: '/dashboard/settings?tab=availability' },
                { label: 'Create your first event type', sub: 'Define a meeting type guests can book', done: hasService, to: '/dashboard/settings?tab=event-types' },
                { label: 'Share your booking link', sub: hasSlug ? `pinonit.com/${slugDisplay}` : 'Set a custom username in Settings', done: hasSlug, to: hasSlug ? undefined : '/dashboard/settings?tab=booking_page' },
              ];
              const completedCount = steps.filter((s) => s.done).length;
              const allDone = completedCount === steps.length;
              if (allDone) return null;
              return (
                <div className="mb-4 md:mb-2 bg-white dark:bg-slate-900/50 rounded-2xl overflow-hidden shadow-sm" style={{ border: '1.5px solid #f97316', animation: 'onboarding-pulse 2s ease-in-out infinite' }}>
                  <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex gap-1 shrink-0">
                        {steps.map((s, i) => (
                          <div key={i} className={`h-2 w-6 md:w-8 rounded-full transition-colors ${s.done ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {`Get started — ${completedCount} of ${steps.length} done`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setChecklistDismissed(true);
                        localStorage.setItem('onboarding_checklist_dismissed', '1');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                      title="Don't show this again"
                      aria-label="Dismiss checklist"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {steps.map((step, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 ${step.to ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors' : ''}`}
                        onClick={() => step.to && navigate(step.to)}
                      >
                        <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${step.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                          {step.done && <Check className="h-4 w-4 text-white" />}
                          {!step.done && <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${step.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>{step.label}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{step.sub}</p>
                        </div>
                        {!step.done && step.to && <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />}
                        {step.done && <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">Done</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            </div>

            {profile?.id && (
              <DashboardHome
                hostId={profile.id}
                bookings={bookings}
                showWizardButton={profile?.show_wizard_button !== false}
                onOpenWizard={() => {
                  setWizardUserRequested(true);
                  setWizardInitialStep(wizardStartIndex({
                    onboardingCompleted: profile?.onboarding_completed,
                    hasServices: services.length > 0,
                    hasSlug: !!(profile?.slug || liveSlug),
                  }));
                  setWizardSession((n) => n + 1);
                  setShowWizard(true);
                }}
              />
            )}
          </>
        )}

        {!isDashboardHome && (
          <div className="flex-1 min-w-0 w-full pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        )}

        <footer className={`mt-auto border-t border-gray-200 dark:border-slate-800 py-4 px-6 bg-white dark:bg-slate-950 ${isDashboardHome ? 'hidden md:block' : ''}`}>
          <div className="flex flex-col items-center justify-center gap-2 text-center text-xs text-gray-400 dark:text-slate-500">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
              <Link to="/terms" className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors">Terms of Service</Link>
              <span className="hidden sm:inline">·</span>
              <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors">Privacy Policy</Link>
            </div>
            <p>PinOnIt is a DBA of Miami Expeditions LLC.</p>
            <p>&copy; 2026 Miami Expeditions LLC. All Rights Reserved.</p>
          </div>
        </footer>
      </div>

      {showCreateModal && (
        <CreateLinkModal
          profile={profile}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {showWizard && (
        <OnboardingWizard
          key={`${wizardSession}-${wizardInitialStep ?? 'start'}-${wizardOpenCalendlyImport ? 'cal' : 'std'}`}
          isModal
          openCalendlyImport={wizardOpenCalendlyImport}
          onClose={() => {
            setShowWizard(false);
            setWizardOpenCalendlyImport(false);
            setWizardInitialStep(undefined);
            // Belt-and-suspenders: ensure completed is persisted even if wizard's own handler failed
            markOnboardingCompletedLocal();
            if (profile) {
              supabase.from('profiles').update({ onboarding_completed: true, wizard_active: false }).eq('id', profile.id);
            }
          }}
          initialStep={wizardInitialStep}
        />
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-slate-700 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Sign out?</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">You'll need to sign in again to access your dashboard.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={() => { setShowLogoutConfirm(false); signOut(); }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-colors">Sign out</button>
            </div>
          </div>
        </div>
      )}

      {isDashboardHome && <AddToHomeScreenPrompt />}
    </div>
    </div>
  );
}
