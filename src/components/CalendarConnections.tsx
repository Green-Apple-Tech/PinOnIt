import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChevronRight,
  Calendar,
  Wifi,
  WifiOff,
  Link2,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectedCalendar {
  id: string;
  host_id: string;
  provider: 'google' | 'outlook' | 'apple' | 'caldav' | 'ical' | 'zoom';
  provider_account_email: string;
  calendar_name: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  token_expires_at: string | null;
  calendar_id?: string | null;
}

interface OAuthProviderDef {
  key: 'google' | 'outlook' | 'zoom';
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const OAUTH_PROVIDERS: OAuthProviderDef[] = [
  {
    key: 'google',
    name: 'Google Calendar',
    description: 'Gmail, Google Workspace',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800/50',
  },
  {
    key: 'outlook',
    name: 'Outlook / Office 365',
    description: 'Microsoft personal & work accounts',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
  },
  {
    key: 'zoom',
    name: 'Zoom',
    description: 'Auto-create Zoom meetings on bookings',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    borderColor: 'border-sky-200 dark:border-sky-800/50',
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <rect x="1" y="4" width="14" height="16" rx="1.5" fill="#0078D4"/>
      <path d="M1 8l7 5 7-5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
      <rect x="13" y="12" width="10" height="8" rx="1" fill="#50B0F0"/>
      <path d="M13 14l5 3 5-3" stroke="white" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function AppleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function ZoomIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#2D8CFF"/>
      <path d="M4 8.5C4 7.67 4.67 7 5.5 7h8C14.33 7 15 7.67 15 8.5v7c0 .83-.67 1.5-1.5 1.5h-8C4.67 17 4 16.33 4 15.5v-7z" fill="white"/>
      <path d="M15 10.5l4-2.5v8l-4-2.5v-3z" fill="white"/>
    </svg>
  );
}

function ICalIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeLinecap="round" strokeWidth="2.5"/>
    </svg>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'google') return <GoogleIcon />;
  if (provider === 'outlook') return <OutlookIcon />;
  if (provider === 'zoom') return <ZoomIcon />;
  if (provider === 'apple') return <span className="text-slate-700 dark:text-slate-200"><AppleIcon /></span>;
  if (provider === 'ical') return <span className="text-indigo-600 dark:text-indigo-500"><ICalIcon /></span>;
  return <Calendar className="h-5 w-5 text-slate-400" />;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Apple CalDAV Form ─────────────────────────────────────────────────────────

function AppleCalDAVForm({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!email.trim() || !password.trim()) { setError('Email and app-specific password are required.'); return; }
    setConnecting(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-caldav`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: email.trim(), password: password.trim() }),
        }
      );
      const json = await res.json();
      if (json.error) { setError(json.error); setConnecting(false); return; }
      onConnected();
    } catch (e) {
      setError(String(e));
      setConnecting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition';

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2.5">
        <span className="text-slate-700 dark:text-slate-300"><AppleIcon /></span>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Apple iCloud Calendar</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Connects via CalDAV — no OAuth needed</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">iCloud email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@icloud.com"
          className={inputCls}
          autoFocus
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">App-specific password</label>
          <a
            href="https://appleid.apple.com/account/manage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 dark:text-indigo-500 hover:underline flex items-center gap-1"
          >
            Generate at Apple ID <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx"
            className={`${inputCls} pr-10`}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
          <p className="font-semibold">How to generate an app-specific password:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-amber-700 dark:text-amber-400">
            <li>Go to <strong>appleid.apple.com</strong> and sign in</li>
            <li>Under <strong>Sign-In and Security</strong>, tap <strong>App-Specific Passwords</strong></li>
            <li>Click <strong>+ Generate an app-specific password</strong></li>
            <li>Name it "PinOnIt" and copy the password</li>
          </ol>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleConnect}
          disabled={connecting || !email.trim() || !password.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon className="h-4 w-4" />}
          {connecting ? 'Connecting…' : 'Connect iCloud Calendar'}
        </button>
        <button onClick={onClose} className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── iCal URL Form ─────────────────────────────────────────────────────────────

function ICalUrlForm({ hostId, onClose, onConnected }: { hostId: string; onClose: () => void; onConnected: () => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError('Please enter a URL.'); return; }
    const normalised = trimmed.replace(/^webcal:\/\//i, 'https://');
    if (!normalised.startsWith('http')) { setError('Please enter a valid http or webcal URL.'); return; }
    setSaving(true);
    setError('');
    const { error: insertErr } = await supabase.from('connected_calendars').insert({
      host_id: hostId,
      provider: 'ical',
      provider_account_email: '',
      calendar_name: name.trim() || 'iCal subscription',
      sync_enabled: true,
      use_for_scheduling: true,
      use_for_reminders: true,
      calendar_id: normalised,
    });
    if (insertErr) { setError(insertErr.message); setSaving(false); return; }
    onConnected();
  };

  const inputCls = 'w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition';

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2.5">
        <span className="text-indigo-600 dark:text-indigo-500"><ICalIcon /></span>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">iCal / webcal URL subscription</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Paste any .ics or webcal:// link for conflict checking</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Calendar URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.google.com/…/basic.ics  or  webcal://…"
          className={inputCls}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <p className="text-xs text-slate-400 mt-1">Works with Google Calendar, Outlook, Apple Calendar, Airbnb, sports calendars, and any .ics feed.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nickname (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Work calendar"
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleAdd}
          disabled={saving || !url.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {saving ? 'Adding…' : 'Add calendar'}
        </button>
        <button onClick={onClose} className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Connect Wizard Modal ───────────────────────────────────────────────────────

type WizardStep = 'pick' | 'apple' | 'ical';

function ConnectWizard({ hostId, onClose, onConnected }: { hostId: string; onClose: () => void; onConnected: () => void }) {
  const [step, setStep] = useState<WizardStep>('pick');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleOAuth = async (provider: 'google' | 'outlook' | 'zoom') => {
    setConnecting(provider);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      // Zoom uses direct browser redirect with token as query param
      if (provider === 'zoom') {
        window.location.href = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoom-auth?token=${encodeURIComponent(token)}`;
        return;
      }
      const fnName = provider === 'google' ? 'google-calendar-auth' : 'outlook-calendar-auth';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`,
        { headers: { Authorization: `Bearer ${token}`, Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
      );
      const json = await res.json();
      if (json.error) {
        const providerName = provider === 'google' ? 'Google' : 'Microsoft';
        setError(json.error.includes('not configured')
          ? `${providerName} OAuth credentials have not been configured yet.`
          : json.error);
        setConnecting(null);
        return;
      }
      window.location.href = json.url;
    } catch (e) {
      setError(String(e));
      setConnecting(null);
    }
  };

  const stepTitles: Record<WizardStep, string> = {
    pick: 'Connect a Calendar',
    apple: 'Apple iCloud Calendar',
    ical: 'iCal URL Subscription',
  };
  const stepSubs: Record<WizardStep, string> = {
    pick: 'Choose your calendar provider.',
    apple: 'Sign in with an app-specific password.',
    ical: 'Paste any .ics or webcal link.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          {step !== 'pick' && (
            <button onClick={() => setStep('pick')} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors shrink-0">
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{stepTitles[step]}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stepSubs[step]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {step === 'pick' && (
            <>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
                </div>
              )}

              {OAUTH_PROVIDERS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handleOAuth(p.key)}
                  disabled={!!connecting}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md disabled:opacity-60 hover:scale-[1.01] active:scale-100 ${p.bgColor} ${p.borderColor}`}
                >
                  <div className="shrink-0">{p.key === 'google' ? <GoogleIcon /> : p.key === 'outlook' ? <OutlookIcon /> : <ZoomIcon />}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${p.color}`}>{p.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{p.description}</p>
                  </div>
                  {connecting === p.key
                    ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 shrink-0" />
                    : <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />}
                </button>
              ))}

              <button
                onClick={() => setStep('apple')}
                disabled={!!connecting}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md disabled:opacity-60 hover:scale-[1.01] active:scale-100 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
              >
                <div className="shrink-0 text-slate-700 dark:text-slate-300"><AppleIcon /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Apple iCloud Calendar</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Connect with an app-specific password</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
              </button>

              <button
                onClick={() => setStep('ical')}
                disabled={!!connecting}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md disabled:opacity-60 hover:scale-[1.01] active:scale-100 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40"
              >
                <div className="shrink-0 text-indigo-600 dark:text-indigo-500"><ICalIcon /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">iCal / webcal URL</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Subscribe to any .ics calendar feed</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
              </button>
            </>
          )}

          {step === 'apple' && (
            <AppleCalDAVForm onClose={onClose} onConnected={() => { onConnected(); onClose(); }} />
          )}

          {step === 'ical' && (
            <ICalUrlForm hostId={hostId} onClose={onClose} onConnected={() => { onConnected(); onClose(); }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CalendarConnectionsProps {
  compact?: boolean;
}

export function CalendarConnections({ compact = false }: CalendarConnectionsProps) {
  const { profile } = useAuth();
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    // One-time backfill: ensure both calendar purpose flags are enabled
    await supabase
      .from('connected_calendars')
      .update({ use_for_scheduling: true, use_for_reminders: true })
      .eq('host_id', profile.id)
      .or('use_for_scheduling.eq.false,use_for_reminders.eq.false');
    const { data, error } = await supabase
      .from('connected_calendars')
      .select('id,host_id,provider,provider_account_email,calendar_name,sync_enabled,last_synced_at,token_expires_at,calendar_id')
      .eq('host_id', profile.id)
      .order('created_at');
    if (!error) setCalendars((data ?? []) as ConnectedCalendar[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setStatusMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-sync`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      const json = await res.json();
      if (json.error) {
        setStatusIsError(true);
        setStatusMsg(`Sync failed: ${json.error}`);
      } else {
        const total = Object.values(json.results ?? {}).reduce((acc: number, r: unknown) => acc + ((r as { synced?: number }).synced ?? 0), 0);
        setStatusIsError(false);
        setStatusMsg(`Synced ${total} event${total !== 1 ? 's' : ''}`);
        await load();
      }
    } catch (e) {
      setStatusIsError(true);
      setStatusMsg(`Error: ${String(e)}`);
    }
    setSyncing(false);
  };

  const handleToggleSync = async (cal: ConnectedCalendar) => {
    await supabase.from('connected_calendars').update({ sync_enabled: !cal.sync_enabled }).eq('id', cal.id);
    setCalendars((prev) => prev.map((c) => c.id === cal.id ? { ...c, sync_enabled: !cal.sync_enabled } : c));
  };

  const handleDisconnect = async (calId: string) => {
    await supabase.from('connected_calendars').delete().eq('id', calId);
    await supabase.from('calendar_events').delete().eq('calendar_id', calId);
    setCalendars((prev) => prev.filter((c) => c.id !== calId));
  };

  const providerLabel = (cal: ConnectedCalendar) => {
    if (cal.provider === 'google') return 'Google Calendar';
    if (cal.provider === 'outlook') return 'Outlook';
    if (cal.provider === 'zoom') return 'Zoom';
    if (cal.provider === 'apple') return 'Apple iCloud';
    if (cal.provider === 'ical') return 'iCal feed';
    return cal.calendar_name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
      </div>
    );
  }

  // ── Compact sidebar view ──────────────────────────────────────────────────

  if (compact) {
    return (
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-indigo-600" />
            Calendars
          </p>
          {calendars.length > 0 && (
            <button onClick={handleSync} disabled={syncing} className="text-xs text-indigo-600 dark:text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium transition-colors disabled:opacity-50 flex items-center gap-1">
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} /> Sync
            </button>
          )}
        </div>

        {statusMsg && (
          <p className={`text-xs mb-2 ${statusIsError ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-500'}`}>{statusMsg}</p>
        )}

        {calendars.length === 0 ? (
          <button onClick={() => setShowWizard(true)} className="w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:border-indigo-500 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-500 transition-colors">
            <Calendar className="h-3.5 w-3.5" /> Connect a calendar
          </button>
        ) : (
          <div className="space-y-2">
            {calendars.map((cal) => (
              <div key={cal.id} className="flex items-center gap-2">
                <ProviderIcon provider={cal.provider} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-slate-300 truncate font-medium">{cal.calendar_name || providerLabel(cal)}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{cal.sync_enabled ? `Synced ${timeAgo(cal.last_synced_at)}` : 'Sync paused'}</p>
                </div>
                <button onClick={() => handleToggleSync(cal)} className="shrink-0" title={cal.sync_enabled ? 'Pause sync' : 'Enable sync'}>
                  {cal.sync_enabled ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-slate-400" />}
                </button>
                <button onClick={() => handleDisconnect(cal.id)} className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors" title="Disconnect">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button onClick={() => setShowWizard(true)} className="w-full text-left text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-500 transition-colors pt-1">
              + Add another calendar
            </button>
          </div>
        )}

        {showWizard && profile && (
          <ConnectWizard hostId={profile.id} onClose={() => setShowWizard(false)} onConnected={() => { setShowWizard(false); load(); }} />
        )}
      </div>
    );
  }

  // ── Full panel view ───────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Wifi className="h-4 w-4 text-indigo-600" />
          Connected Calendars
        </h2>
        <div className="flex items-center gap-2">
          {calendars.length > 0 && (
            <button onClick={handleSync} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} /> Sync all
            </button>
          )}
          <button onClick={() => setShowWizard(true)} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-colors">
            <PlusIcon className="h-3.5 w-3.5" /> Connect calendar
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`mb-4 flex items-center gap-2 p-3 rounded-xl text-sm border ${statusIsError ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400' : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-500'}`}>
          {statusIsError ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {statusMsg}
        </div>
      )}

      {calendars.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">No calendars connected</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-5 max-w-xs mx-auto">
            Connect Google, Outlook, Apple iCloud, or paste any iCal URL to block busy times and prevent double-bookings.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: 'Google', bgCls: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400', icon: <GoogleIcon /> },
              { label: 'Outlook', bgCls: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400', icon: <OutlookIcon /> },
              { label: 'Zoom', bgCls: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/50 text-sky-600 dark:text-sky-400', icon: <ZoomIcon /> },
              { label: 'Apple', bgCls: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300', icon: <span className="text-slate-700 dark:text-slate-300"><AppleIcon /></span> },
              { label: 'iCal URL', bgCls: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-500', icon: <span className="text-indigo-600 dark:text-indigo-500"><ICalIcon /></span> },
            ].map(({ label, bgCls, icon }) => (
              <button key={label} onClick={() => setShowWizard(true)} className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-xl text-sm font-semibold hover:shadow-md transition-all ${bgCls}`}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {calendars.map((cal) => {
            const tokenExpired = cal.token_expires_at && new Date(cal.token_expires_at) < new Date();
            return (
              <div key={cal.id} className={`bg-white dark:bg-slate-900/50 border rounded-xl p-4 transition-colors ${tokenExpired ? 'border-amber-200 dark:border-amber-800/50' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center gap-4">
                  <ProviderIcon provider={cal.provider} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cal.calendar_name || providerLabel(cal)}</p>
                      {cal.sync_enabled && !tokenExpired && (
                        <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" /> Live
                        </span>
                      )}
                      {tokenExpired && <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">Token expired — reconnect</span>}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      {cal.provider === 'ical' ? (cal.calendar_id ?? '') : (cal.provider_account_email || providerLabel(cal))}
                      {' · Synced '}{timeAgo(cal.last_synced_at)}
                    </p>
                  </div>
                  <button onClick={() => handleToggleSync(cal)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${cal.sync_enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform" style={{ transform: cal.sync_enabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                  {cal.provider !== 'ical' && cal.provider !== 'apple' && cal.provider !== 'zoom' && (
                    <button onClick={handleSync} disabled={syncing} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-500 rounded-lg transition-colors disabled:opacity-50" title="Sync now">
                      <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  <button onClick={() => handleDisconnect(cal.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Disconnect">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          <button onClick={() => setShowWizard(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-500 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-500 transition-colors">
            <Calendar className="h-4 w-4" /> Add another calendar
          </button>
        </div>
      )}

      {showWizard && profile && (
        <ConnectWizard hostId={profile.id} onClose={() => setShowWizard(false)} onConnected={() => { setShowWizard(false); load(); }} />
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
