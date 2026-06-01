import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TIMEZONES } from '../lib/types';
import type { EmergencyContact } from '../lib/types';
import { PHONE_PLACEHOLDER, PHONE_HINT, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { resolveDefaultReminderChannel, type ReminderChannelPreference } from '../lib/reminderChannels';
import {
  Save, Loader2, Copy, Check, Code, Palette, ExternalLink, Upload, X,
  ImagePlus, CheckCircle2, AlertCircle, Link2, QrCode, Users, Gift,
  TrendingUp, DollarSign, Calendar, Video, Wifi, WifiOff, BellRing, Plus, Trash2, Phone, PhoneCall,
  Mail, Smartphone, MessageSquare,
} from 'lucide-react';
import { QRModal } from '../components/QRModal';
import { ColorSwatchRow } from '../components/ColorSwatchRow';
import { AnalyticsPage } from './Analytics';
import { BillingPage } from './Billing';
import { AvailabilityPage } from './Availability';
import { RemindersPage } from './Reminders';

type SettingsSection = 'general' | 'availability' | 'reminders' | 'analytics' | 'billing';
type SettingsTab = 'profile' | 'booking_page' | 'branding' | 'embed' | 'referrals' | 'integrations';

const SESSION_TIMEOUT_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: 'Never', minutes: null },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
  { label: '1 day', minutes: 1440 },
];

const REMINDER_CHANNEL_OPTIONS: { value: ReminderChannelPreference; label: string; icon: typeof Mail }[] = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: Smartphone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'voice', label: 'Voice Call', icon: PhoneCall },
];

const GENERAL_TABS: SettingsTab[] = ['profile', 'booking_page', 'branding', 'embed', 'referrals', 'integrations'];

// ── Color picker ──────────────────────────────────────────────────────────────

function isValidHex(v: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

function BrandColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => { setHexInput(value); }, [value]);

  const commit = useCallback((color: string) => {
    if (!isValidHex(color)) return;
    onChange(color);
    setHexInput(color);
  }, [onChange]);

  return (
    <div className="space-y-4">
      {/* Swatch row */}
      <ColorSwatchRow value={value} onChange={commit} />

      {/* Hex input + preview */}
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 transition-colors"
          style={{ backgroundColor: isValidHex(value) ? value : '#5864C6' }}
        />
        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex-1">
          <span className="px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">#</span>
          <input
            type="text"
            value={hexInput.replace('#', '')}
            onChange={(e) => {
              const raw = '#' + e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
              setHexInput(raw);
              if (isValidHex(raw)) commit(raw);
            }}
            onBlur={() => { if (isValidHex(hexInput)) commit(hexInput); else setHexInput(value); }}
            className="flex-1 px-3 py-2.5 bg-transparent text-slate-900 dark:text-white text-sm font-mono focus:outline-none"
            placeholder="5864C6"
            maxLength={6}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

// ── Integrations tab ──────────────────────────────────────────────────────────

interface ConnectedCalendar {
  id: string;
  provider: string;
  provider_account_email: string | null;
  calendar_name: string | null;
}

function ProviderLogo({ provider }: { provider: string }) {
  if (provider === 'google')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    );
  if (provider === 'outlook')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill="#0078D4"/>
        <path d="M7 7h5.5A2.5 2.5 0 0 1 15 9.5v5a2.5 2.5 0 0 1-2.5 2.5H7V7z" fill="white" opacity=".8"/>
        <path d="M15 9l5 2v2l-5 2V9z" fill="white"/>
      </svg>
    );
  if (provider === 'zoom')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="12" fill="#2D8CFF"/>
        <path d="M5 9.5h8.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1zM14.5 11.5l4-2v5l-4-2z" fill="white"/>
      </svg>
    );
  if (provider === 'apple')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-slate-700 dark:text-slate-200">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.18 1.27-2.15 3.8.03 3.02 2.65 4.03 2.68 4.04l-.08.28zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    );
  return <Wifi className="h-5 w-5 text-slate-400" />;
}

function IntegrationCard({
  provider,
  name,
  description,
  connected,
  connectedEmail,
  autoNote,
  onConnect,
  onDisconnect,
  connecting,
}: {
  provider: string;
  name: string;
  description: string;
  connected: boolean;
  connectedEmail?: string | null;
  autoNote?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  connecting?: boolean;
}) {
  return (
    <div className={`flex items-start gap-4 p-4 bg-white dark:bg-slate-900/60 border rounded-xl transition-colors ${connected ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="h-11 w-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0">
        <ProviderLogo provider={provider} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
          {connected ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
              <Check className="h-3 w-3" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium rounded-full">
              <WifiOff className="h-3 w-3" /> Not connected
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          {connectedEmail ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{connectedEmail}</span> : description}
        </p>
        {autoNote && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">{autoNote}</p>
        )}
      </div>
      <div className="shrink-0">
        {autoNote ? null : connected ? (
          <button
            onClick={onDisconnect}
            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
          >
            {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

function IntegrationsTab({ userId }: { userId: string | undefined }) {
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('connected_calendars')
      .select('id, provider, provider_account_email, calendar_name')
      .eq('host_id', userId)
      .then(({ data, error }) => {
        if (!error) setCalendars(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  const getConnected = (provider: string) => calendars.find((c) => c.provider === provider);

  const handleConnect = async (provider: 'google' | 'outlook' | 'zoom' | 'apple') => {
    setConnecting(provider);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (provider === 'apple') {
        window.location.href = '/dashboard/availability?tab=calendar';
        return;
      }
      // Zoom uses direct browser redirect with token as query param
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
      if (json.error) { setError(json.error); setConnecting(null); return; }
      window.location.href = json.url;
    } catch (e) {
      setError(String(e));
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    await supabase.from('connected_calendars').delete().eq('id', id);
    setCalendars((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" /></div>;
  }

  const googleCal = getConnected('google');
  const outlookCal = getConnected('outlook');
  const zoomCal = getConnected('zoom');
  const appleCal = getConnected('apple');

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Calendars */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Calendars</h3>
        </div>
        <div className="space-y-2">
          <IntegrationCard
            provider="google"
            name="Google Calendar"
            description="Sync your Google Calendar to prevent double-bookings and create events automatically."
            connected={!!googleCal}
            connectedEmail={googleCal?.provider_account_email}
            onConnect={() => handleConnect('google')}
            onDisconnect={() => googleCal && handleDisconnect(googleCal.id)}
            connecting={connecting === 'google'}
          />
          <IntegrationCard
            provider="outlook"
            name="Outlook / Office 365"
            description="Connect Microsoft Outlook or Office 365 to sync meetings and availability."
            connected={!!outlookCal}
            connectedEmail={outlookCal?.provider_account_email}
            onConnect={() => handleConnect('outlook')}
            onDisconnect={() => outlookCal && handleDisconnect(outlookCal.id)}
            connecting={connecting === 'outlook'}
          />
          <IntegrationCard
            provider="apple"
            name="Apple iCloud / CalDAV"
            description="Connect an Apple iCloud calendar or any CalDAV-compatible calendar via URL."
            connected={!!appleCal}
            connectedEmail={appleCal?.provider_account_email ?? appleCal?.calendar_name}
            onConnect={() => handleConnect('apple')}
            onDisconnect={() => appleCal && handleDisconnect(appleCal.id)}
            connecting={connecting === 'apple'}
          />
        </div>
      </div>

      {/* Video conferencing */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Video className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Video conferencing</h3>
        </div>
        <div className="space-y-2">
          <IntegrationCard
            provider="zoom"
            name="Zoom"
            description="Automatically generate unique Zoom meeting links for every booking."
            connected={!!zoomCal}
            connectedEmail={zoomCal?.provider_account_email}
            onConnect={() => handleConnect('zoom')}
            onDisconnect={() => zoomCal && handleDisconnect(zoomCal.id)}
            connecting={connecting === 'zoom'}
          />
          <IntegrationCard
            provider="google"
            name="Google Meet"
            description="Auto-generate Google Meet links when Google Calendar is connected."
            connected={!!googleCal}
            connectedEmail={googleCal ? 'Enabled via Google Calendar' : null}
            autoNote={googleCal ? undefined : 'Connect Google Calendar above to enable Google Meet.'}
          />
          <IntegrationCard
            provider="outlook"
            name="Microsoft Teams"
            description="Auto-generate Microsoft Teams meeting links when Outlook is connected."
            connected={!!outlookCal}
            connectedEmail={outlookCal ? 'Enabled via Outlook Calendar' : null}
            autoNote={outlookCal ? undefined : 'Connect Outlook above to enable Microsoft Teams.'}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const location = useLocation();

  // Read ?tab= query param to allow deep-linking from redirects
  const initialSection = (): SettingsSection => {
    const p = new URLSearchParams(location.search).get('tab');
    if (p && GENERAL_TABS.includes(p as SettingsTab)) return 'general';
    if (p === 'analytics' || p === 'billing' || p === 'availability' || p === 'reminders') return p;
    return 'general';
  };

  const initialTab = (): SettingsTab => {
    const p = new URLSearchParams(location.search).get('tab');
    if (p && GENERAL_TABS.includes(p as SettingsTab)) return p as SettingsTab;
    return 'profile';
  };

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  const [fullName, setFullName] = useState(
    profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  );
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'America/New_York');

  const [slug, setSlug] = useState(profile?.slug ?? '');
  const [bookingHeader, setBookingHeader] = useState(profile?.booking_page_header ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');

  const [brandColor, setBrandColor] = useState(profile?.brand_color ?? '#5864C6');
  const [logoUrl, setLogoUrl] = useState(profile?.avatar_url ?? '');

  const [showWizardButton, setShowWizardButton] = useState(profile?.show_wizard_button !== false);
  const [defaultLinkExpiryDays, setDefaultLinkExpiryDays] = useState<number | null>(profile?.default_link_expiry_days ?? 7);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number | null>(profile?.session_timeout_minutes ?? null);

  // Notifications (profile phone + default reminder channel)
  const [notificationPhone, setNotificationPhone] = useState('');
  const [defaultReminderChannel, setDefaultReminderChannel] = useState<ReminderChannelPreference>('whatsapp');

  // Voice reminders
  const [voiceReminderEnabled, setVoiceReminderEnabled] = useState(profile?.voice_reminder_enabled ?? false);
  const defaultVoiceScript = 'Hi, this is a reminder from {{host_name}} that you have a {{service_name}} scheduled for {{date}} at {{time}}. We look forward to speaking with you.';
  const [voiceMessageTemplate, setVoiceMessageTemplate] = useState(profile?.voice_message_template ?? '');
  const [savingVoice, setSavingVoice] = useState(false);
  const [savedVoice, setSavedVoice] = useState(false);

  // Emergency alert contacts
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [newContactLabel, setNewContactLabel] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);


  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const bookingUrl = slug ? `${window.location.origin}/${slug}` : '';

  useEffect(() => {
    const trimmed = slug.trim();
    if (!trimmed) { setSlugStatus('idle'); return; }
    if (trimmed === profile?.slug) { setSlugStatus('available'); return; }
    if (trimmed.length < 3) { setSlugStatus('invalid'); return; }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('slug', trimmed).maybeSingle();
      if (data && data.id !== profile?.id) {
        setSlugStatus('taken');
      } else {
        setSlugStatus('available');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [slug, profile?.slug, profile?.id]);

  useEffect(() => {
    if (!user) return;
    supabase.from('emergency_contacts').select('*').eq('host_id', user.id).order('sort_order').then(({ data }) => {
      setEmergencyContacts((data ?? []) as EmergencyContact[]);
    });
  }, [user]);

  useEffect(() => {
    const p = new URLSearchParams(location.search).get('tab');
    if (p && GENERAL_TABS.includes(p as SettingsTab)) {
      setSection('general');
      setTab(p as SettingsTab);
    } else if (p === 'analytics' || p === 'billing' || p === 'availability' || p === 'reminders') {
      setSection(p);
    }
  }, [location.search]);

  useEffect(() => {
    if (profile) {
      setSessionTimeoutMinutes(profile.session_timeout_minutes ?? null);
      const storedPhone = profile.phone ?? '';
      setNotificationPhone(storedPhone ? blurFormatPhone(storedPhone) : '');
      setDefaultReminderChannel(resolveDefaultReminderChannel(profile.default_reminder_channel));
    }
  }, [profile?.session_timeout_minutes, profile?.phone, profile?.default_reminder_channel]);

  const handleAddEmergencyContact = async () => {
    if (!user || !newContactLabel.trim() || !newContactPhone.trim()) return;
    if (emergencyContacts.length >= 3) return;
    setSavingContact(true);
    const { data } = await supabase.from('emergency_contacts').insert({
      host_id: user.id,
      label: newContactLabel.trim(),
      phone: normalizePhoneE164(newContactPhone),
      sort_order: emergencyContacts.length,
    }).select().maybeSingle();
    if (data) {
      setEmergencyContacts(prev => [...prev, data as EmergencyContact]);
      setNewContactLabel('');
      setNewContactPhone('');
    }
    setSavingContact(false);
  };

  const handleDeleteEmergencyContact = async (id: string) => {
    setDeletingContactId(id);
    await supabase.from('emergency_contacts').delete().eq('id', id);
    setEmergencyContacts(prev => prev.filter(c => c.id !== id));
    setDeletingContactId(null);
  };


  const handleSaveVoiceReminders = async () => {
    if (!user) return;
    setSavingVoice(true);
    await supabase.from('profiles').update({
      voice_reminder_enabled: voiceReminderEnabled,
      voice_message_template: voiceMessageTemplate.trim() || null,
    }).eq('id', user.id);
    setSavingVoice(false);
    setSavedVoice(true);
    setTimeout(() => setSavedVoice(false), 2000);
  };

  const handleLogoFile = useCallback(async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) return;
    setLogoUploading(true);
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `logos/${user.id}/logo.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!upErr) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      setAvatarUrl(data.publicUrl);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLogoUrl(dataUrl);
        setAvatarUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    setLogoUploading(false);
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (slugStatus === 'taken' || slugStatus === 'invalid') return;
    setSaving(true);
    setSaved(false);
    await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        bio,
        slug: slug || null,
        timezone,
        brand_color: brandColor,
        booking_page_header: bookingHeader,
        avatar_url: avatarUrl || null,
        show_wizard_button: showWizardButton,
        default_link_expiry_days: defaultLinkExpiryDays,
        session_timeout_minutes: sessionTimeoutMinutes,
        phone: normalizePhoneE164(notificationPhone) || null,
        default_reminder_channel: defaultReminderChannel,
      })
      .eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const iframeCode = slug
    ? `<iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" style="border-radius:12px;"></iframe>`
    : '';

  const popupCode = slug
    ? `<!-- Add to your <head> -->\n<script src="https://pinonit.app/embed.js" data-slug="${slug}" defer></script>\n<!-- Add anywhere in your page -->\n<button data-pinonit="${slug}">Book a meeting</button>`
    : '';

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'booking_page', label: 'Booking page' },
    { key: 'branding', label: 'Branding' },
    { key: 'integrations', label: 'Integrations' },
    { key: 'embed', label: 'Embed' },
    { key: 'referrals', label: 'Referrals' },
  ];

  return (
    <main className="p-6 md:p-8 max-w-3xl">

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage your profile, booking page, branding, analytics, and billing.</p>
      </div>

      {/* Top-level section tabs */}
      <div className="flex gap-0.5 mb-6 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {([
          { key: 'general', label: 'General' },
          { key: 'availability', label: 'Availability' },
          { key: 'reminders', label: 'Reminders & Messages' },
          { key: 'analytics', label: 'Analytics' },
          { key: 'billing', label: 'Billing' },
        ] as { key: SettingsSection; label: string }[]).map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              section === s.key
                ? 'border-[#5864C6] text-[#5864C6]'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Availability section */}
      {section === 'availability' && <AvailabilityPage embedded />}

      {/* Reminders & Messages section */}
      {section === 'reminders' && <RemindersPage embedded />}

      {/* Analytics section */}
      {section === 'analytics' && <AnalyticsPage embedded />}

      {/* Billing section */}
      {section === 'billing' && <BillingPage embedded />}

      {/* General section */}
      {section === 'general' && (
        <>

      {/* Sub-tabs for general settings */}
      <div className="flex gap-0.5 mb-6 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* PROFILE */}
      {tab === 'profile' && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
            <input type="email" value={profile?.email || user?.email || ''} disabled placeholder="No email on file"
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder="Tell guests about yourself..."
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">SMS, voice, and default reminder preferences for your account.</p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Phone number</label>
              <input
                type="tel"
                value={notificationPhone}
                onChange={e => setNotificationPhone(e.target.value)}
                onBlur={e => { if (e.target.value.trim()) setNotificationPhone(blurFormatPhone(e.target.value)); }}
                placeholder={PHONE_PLACEHOLDER}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{PHONE_HINT}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Used for SMS and voice call reminders sent to you.</p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">Default reminder channel</label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_CHANNEL_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const active = defaultReminderChannel === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDefaultReminderChannel(value)}
                      className={[
                        'inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-full text-sm font-semibold border transition-all',
                        active
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
                This is the channel used by default when you create new reminders. You can always change it per reminder.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Show Wizard Setup button</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Displays the Wizard Setup shortcut on the To Book a Time page header.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowWizardButton(v => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${showWizardButton ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showWizardButton ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-0.5">Default link expiration</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">When sharing your booking link, optionally expire it after this many days. Select "Never" to disable expiry by default.</p>
              <select
                value={defaultLinkExpiryDays ?? ''}
                onChange={(e) => setDefaultLinkExpiryDays(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                className="w-full sm:w-48 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition"
              >
                <option value="">Never</option>
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div>
              <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Session Security</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-3">
                Auto sign-out after inactivity
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                For shared or clinic computers, set a shorter timeout. For personal devices, keep it long.
              </p>
              <div className="flex flex-wrap gap-2">
                {SESSION_TIMEOUT_OPTIONS.map(opt => {
                  const active = sessionTimeoutMinutes === opt.minutes;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setSessionTimeoutMinutes(opt.minutes)}
                      className={[
                        'min-h-[40px] px-4 py-2 rounded-full text-sm font-semibold border transition-all',
                        active
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
                💡 HIPAA guidelines recommend 15 minutes for shared clinical workstations.
              </p>
            </div>
          </div>
          <SaveBtn saving={saving} saved={saved} onClick={handleSave} />
        </div>
      )}

      {/* EMERGENCY ALERT CONTACTS */}
      {tab === 'profile' && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <BellRing className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Emergency Alert Contacts</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Up to 3 contacts who receive SMS when you have a critical meeting.</p>
            </div>
          </div>

          {emergencyContacts.length > 0 && (
            <div className="space-y-2">
              {emergencyContacts.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{c.phone}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteEmergencyContact(c.id)}
                    disabled={deletingContactId === c.id}
                    className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors rounded shrink-0 disabled:opacity-50"
                    title="Remove contact"
                  >
                    {deletingContactId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {emergencyContacts.length < 3 && (
            <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Add a contact ({emergencyContacts.length}/3)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Label</label>
                  <input
                    type="text"
                    value={newContactLabel}
                    onChange={e => setNewContactLabel(e.target.value)}
                    placeholder="e.g. My wife"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Phone number</label>
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={e => setNewContactPhone(e.target.value)}
                    onBlur={e => { if (e.target.value.trim()) setNewContactPhone(blurFormatPhone(e.target.value)); }}
                    placeholder={PHONE_PLACEHOLDER}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                  />
                  <p className="text-xs text-slate-400 mt-1">{PHONE_HINT}</p>
                </div>
              </div>
              <button
                onClick={handleAddEmergencyContact}
                disabled={savingContact || !newContactLabel.trim() || !newContactPhone.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all"
              >
                {savingContact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Contact
              </button>
            </div>
          )}

          {emergencyContacts.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
              No emergency contacts yet. Add up to 3 people who will be notified when you have a critical meeting.
            </p>
          )}
        </div>
      )}

      {/* VOICE REMINDERS */}
      {tab === 'profile' && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
              <PhoneCall className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Voice Reminders</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Automated phone call reminders to guests before their meetings.</p>
            </div>
          </div>

          {/* Enable toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Enable voice call reminders</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">When enabled, guests will receive an automated voice call reminder before their meeting.</p>
            </div>
            <button
              onClick={() => setVoiceReminderEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ml-4 ${voiceReminderEnabled ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${voiceReminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>

          {/* Voice message preview/customization */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Voice message script</label>
            <p className="text-xs text-slate-400 dark:text-slate-500">Leave blank to use the default script. Supports <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">{'{{host_name}}'}</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">{'{{service_name}}'}</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">{'{{date}}'}</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">{'{{time}}'}</code>.</p>
            <textarea
              value={voiceMessageTemplate}
              onChange={(e) => setVoiceMessageTemplate(e.target.value)}
              rows={3}
              placeholder={defaultVoiceScript}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition resize-none"
            />
          </div>

          {/* Preview box */}
          <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-2">Preview (example)</p>
            <p className="text-sm text-violet-800 dark:text-violet-300 leading-relaxed italic">
              "{(voiceMessageTemplate.trim() || defaultVoiceScript)
                .replace('{{host_name}}', 'Jane Smith')
                .replace('{{service_name}}', '60 Minute Consultation')
                .replace('{{date}}', 'Monday, June 2')
                .replace('{{time}}', '2:00 PM')}"
            </p>
          </div>

          <button
            onClick={handleSaveVoiceReminders}
            disabled={savingVoice}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
          >
            {savingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : savedVoice ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {savedVoice ? 'Saved!' : 'Save'}
          </button>
        </div>
      )}


      {/* BOOKING PAGE */}
      {tab === 'booking_page' && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Booking page</h2>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Custom URL / username</label>
            <div className={`flex items-center bg-white dark:bg-slate-900 border rounded-lg overflow-hidden focus-within:ring-2 transition ${
              slugStatus === 'taken' ? 'border-red-400 focus-within:ring-red-400' :
              slugStatus === 'available' && slug !== profile?.slug ? 'border-emerald-400 focus-within:ring-emerald-400' :
              'border-slate-200 dark:border-slate-800 focus-within:ring-emerald-500'
            }`}>
              <span className="px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">pinonit.com/</span>
              <input type="text" value={slug}
                onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugStatus('checking'); }}
                placeholder="your-username"
                className="flex-1 px-3 py-2.5 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none" />
              <div className="px-3 shrink-0">
                {slugStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                {slugStatus === 'available' && slug && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {slugStatus === 'taken' && <AlertCircle className="h-4 w-4 text-red-400" />}
                {slugStatus === 'invalid' && <AlertCircle className="h-4 w-4 text-amber-400" />}
              </div>
            </div>
            <div className="mt-1.5 min-h-[16px]">
              {slugStatus === 'available' && slug && slug !== profile?.slug && <p className="text-xs text-emerald-600 dark:text-emerald-400">That username is available!</p>}
              {slugStatus === 'taken' && <p className="text-xs text-red-500">That username is already taken. Try another.</p>}
              {slugStatus === 'invalid' && <p className="text-xs text-amber-500">Must be at least 3 characters (letters, numbers, hyphens).</p>}
              {slugStatus === 'available' && slug && slug === profile?.slug && (
                <p className="text-xs text-slate-400 flex items-center gap-1"><Link2 className="h-3 w-3" /> Your current URL: <span className="font-mono text-emerald-600 dark:text-emerald-400">pinonit.com/{slug}</span></p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Page header tagline</label>
            <input type="text" value={bookingHeader} onChange={(e) => setBookingHeader(e.target.value)}
              placeholder="e.g. Licensed therapist · 5 years experience"
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Shown below your name on the booking page.</p>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Profile photo URL</label>
            <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
          </div>
          {bookingUrl && (
            <div className="flex items-center gap-2 pt-2">
              <button onClick={() => copyText(bookingUrl, 'link')}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-sm rounded-lg transition-colors inline-flex items-center gap-1.5">
                {copied === 'link' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'link' ? 'Copied!' : 'Copy booking link'}
              </button>
              {profile?.slug && (
                <a href={`/${profile.slug}`} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-sm rounded-lg transition-colors inline-flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Preview
                </a>
              )}
              {!profile?.slug && slug && (
                <span className="text-xs text-slate-400 dark:text-slate-500 italic">Save changes first to preview</span>
              )}
            </div>
          )}
          <SaveBtn saving={saving} saved={saved} onClick={handleSave} />
        </div>
      )}

      {/* BRANDING */}
      {tab === 'branding' && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Branding</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your logo, colors, and domain. Guests never see Pin on It branding.</p>
          </div>

          {/* Company Logo */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
              <Upload className="h-3.5 w-3.5" /> Company logo
            </label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }}
            />
            {logoUrl ? (
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden shrink-0">
                  <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain p-1" />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> Replace image
                  </button>
                  <button
                    onClick={() => { setLogoUrl(''); setAvatarUrl(''); }}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setLogoDragOver(true); }}
                onDragLeave={() => setLogoDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setLogoDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleLogoFile(f);
                }}
                onClick={() => logoInputRef.current?.click()}
                className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all p-8 flex flex-col items-center gap-3 ${
                  logoDragOver
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              >
                {logoUploading ? (
                  <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                ) : (
                  <ImagePlus className={`h-8 w-8 ${logoDragOver ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {logoUploading ? 'Uploading...' : 'Drop your logo here'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    or <span className="text-emerald-600 dark:text-emerald-400 font-medium">click to browse</span> — PNG, SVG, JPG
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Square logos work best. Shown on your booking page.</p>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Brand color */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
              <Palette className="h-3.5 w-3.5" /> Brand color
            </label>
            <BrandColorPicker value={brandColor} onChange={setBrandColor} />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">Preview</label>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="h-1.5" style={{ backgroundColor: brandColor }} />
              <div className="p-4 bg-slate-50 dark:bg-slate-900 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                    style={{ backgroundColor: brandColor + '33', border: `2px solid ${brandColor}` }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <span className="text-white text-sm font-bold">{(fullName || 'H').charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{fullName || 'Your Name'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{bookingHeader || 'Your tagline'}</p>
                  </div>
                </div>
                <button className="w-full py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: brandColor }}>
                  Confirm booking
                </button>
              </div>
            </div>
          </div>

          <SaveBtn saving={saving} saved={saved} onClick={handleSave} />
        </div>
      )}

      {/* INTEGRATIONS */}
      {tab === 'integrations' && (
        <IntegrationsTab userId={user?.id} />
      )}

      {/* EMBED */}
      {tab === 'embed' && (
        <div className="space-y-6">
          {!slug && (
            <div className="p-5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Set up your booking page first</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Go to the <strong className="text-slate-700 dark:text-slate-300">Booking page</strong> tab and choose a name for your link. Then come back here to get your embed code.
              </p>
              <button
                onClick={() => setTab('booking_page')}
                className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors hover:opacity-90"
                style={{ backgroundColor: '#5864C6' }}
              >
                Set up booking page
              </button>
            </div>
          )}
          {slug && (
            <>
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-semibold">Inline embed</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Embed your booking page directly in your website with an iframe.</p>
                <pre className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono border border-slate-200 dark:border-slate-800">{iframeCode}</pre>
                <button onClick={() => copyText(iframeCode, 'iframe')}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-sm rounded-lg transition-colors inline-flex items-center gap-1.5">
                  {copied === 'iframe' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'iframe' ? 'Copied!' : 'Copy iframe'}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-semibold">Popup button</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Add a "Book a meeting" button that opens your booking page in a popup overlay.</p>
                <pre className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono border border-slate-200 dark:border-slate-800">{popupCode}</pre>
                <button onClick={() => copyText(popupCode, 'popup')}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-sm rounded-lg transition-colors inline-flex items-center gap-1.5">
                  {copied === 'popup' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'popup' ? 'Copied!' : 'Copy popup code'}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <h3 className="font-semibold">Direct booking link</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Share this link in emails, social media, or anywhere you want guests to book.</p>
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-sm text-emerald-400 font-mono flex-1 truncate">{bookingUrl}</span>
                </div>
                <button onClick={() => copyText(bookingUrl, 'direct')}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-sm rounded-lg transition-colors inline-flex items-center gap-1.5">
                  {copied === 'direct' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'direct' ? 'Copied!' : 'Copy link'}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-semibold">Booking page QR code</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Generate a scannable QR code for your booking page. Print it, put it in your email signature, slide deck, or business card.
                </p>
                <button
                  onClick={() => setShowQR(true)}
                  className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm hover:opacity-90"
                  style={{ backgroundColor: '#5864C6' }}
                >
                  <QrCode className="h-4 w-4" />
                  Generate QR code
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* REFERRALS */}
      {tab === 'referrals' && (
        <ReferralsTab userId={user?.id ?? null} profile={profile} />
      )}

      {showQR && slug && (
        <QRModal
          url={bookingUrl}
          title={`${slug}'s booking page`}
          onClose={() => setShowQR(false)}
        />
      )}
        </>
      )}
    </main>
  );
}

// ── Referrals tab ─────────────────────────────────────────────────────────────

interface ReferralRow {
  id: string;
  referred_email: string | null;
  status: string;
  converted_at: string | null;
  created_at: string;
}

interface ReferralCredit {
  amount_cents: number;
  stripe_credit_applied: boolean;
}

function ReferralsTab({ userId, profile }: { userId: string | null; profile: import('../lib/types').Profile | null }) {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [credits, setCredits] = useState<ReferralCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCode = profile?.referral_code ?? '';
  const referralLink = referralCode ? `${window.location.origin}/signup?ref=${referralCode}` : '';

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }),
      supabase.from('referral_credits').select('amount_cents, stripe_credit_applied').eq('user_id', userId),
    ]).then(([{ data: refs }, { data: creds }]) => {
      setReferrals(refs ?? []);
      setCredits(creds ?? []);
      setLoading(false);
    });
  }, [userId]);

  const totalConverted = referrals.filter((r) => r.status === 'converted').length;
  const totalSignups = referrals.filter((r) => r.status !== 'pending').length;
  const appliedCreditsCents = credits.filter((c) => c.stripe_credit_applied).reduce((s, c) => s + c.amount_cents, 0);
  const pendingCreditsCents = credits.filter((c) => !c.stripe_credit_applied).reduce((s, c) => s + c.amount_cents, 0);
  const monthlyDiscount = Math.min(totalConverted, 6);
  const monthlyEarning = totalConverted > 6 ? (totalConverted - 6) : 0;

  const copy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-400 text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-px rounded-2xl shadow-lg shadow-emerald-500/10">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Your referral program</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Share your link. Earn $1 off for each person who upgrades to Pro.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1"><Gift className="h-4 w-4 text-emerald-500" /></div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{totalConverted}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Converted</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1"><Users className="h-4 w-4 text-emerald-500" /></div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{totalSignups}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Signed up</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1"><DollarSign className="h-4 w-4 text-emerald-500" /></div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {monthlyEarning > 0 ? `+$${monthlyEarning}` : `-$${monthlyDiscount}`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {monthlyEarning > 0 ? 'Monthly payout' : 'Monthly credit'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {totalConverted >= 7 && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">You're earning monthly payments!</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              With {totalConverted} active referrals, you earn ${monthlyEarning}/month above your free plan.
            </p>
          </div>
        </div>
      )}
      {totalConverted >= 6 && totalConverted < 7 && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Your plan is free!</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">6 active referrals fully covers your $6/month.</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Your referral link</h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Share this link. When someone signs up and upgrades to Pro, you automatically earn $1 off your monthly bill.</p>
        {referralLink ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-mono truncate">{referralLink}</span>
            </div>
            <button
              onClick={copy}
              className="shrink-0 px-3 py-2.5 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 hover:opacity-90"
            style={{ backgroundColor: '#5864C6' }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Loading your referral code...</p>
        )}
        {referralCode && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Your code: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{referralCode}</span></p>
        )}
      </div>

      {credits.length > 0 && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">Credit summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400">Applied to date</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">${(appliedCreditsCents / 100).toFixed(2)}</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pending next cycle</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${(pendingCreditsCents / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white">Referral history</h3>
        </div>
        {referrals.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-8 w-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No referrals yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Share your link to start earning credits.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">{r.referred_email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'converted'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : r.status === 'signed_up'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      {r.status === 'converted' && <Check className="h-3 w-3" />}
                      {r.status === 'converted' ? 'Pro' : r.status === 'signed_up' ? 'Signed up' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-xs text-slate-400 dark:text-slate-500 hidden sm:table-cell">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SaveBtn({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2 hover:opacity-90"
      style={{ backgroundColor: '#5864C6' }}>
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {saved ? 'Saved!' : 'Save changes'}
    </button>
  );
}

