import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TIMEZONES } from '../lib/types';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Clock,
  CalendarDays,
  Calendar,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  Copy,
  ExternalLink,
  Zap,
  Gift,
} from 'lucide-react';
import { ColorSwatchRow } from '../components/ColorSwatchRow';
import { withoutPinOnItDemoFeedback } from '../lib/eventTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

type Path = 'pick' | 'calendly' | 'other' | 'fresh';

interface ScrapedEvent {
  name: string;
  duration_minutes: number;
  description: string;
  color: string;
  selected: boolean;
}

interface FreshTemplate {
  name: string;
  duration_minutes: number;
  description: string;
  color: string;
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

// ─── Constants ────────────────────────────────────────────────────────────────

const FRESH_TEMPLATES: FreshTemplate[] = [
  { name: '30-Minute Intro Call', duration_minutes: 30, description: 'A quick intro to see if we\'re a good fit.', color: '#5864C6' },
  { name: '1-Hour Consultation', duration_minutes: 60, description: 'Deep dive into your goals and how I can help.', color: '#3b82f6' },
  { name: '15-Minute Discovery Call', duration_minutes: 15, description: 'A short call to learn about your needs.', color: '#f59e0b' },
  { name: '45-Minute Strategy Session', duration_minutes: 45, description: 'Focused session to map out your next steps.', color: '#8b5cf6' },
  { name: '90-Minute Workshop', duration_minutes: 90, description: 'In-depth working session on a specific topic.', color: '#ec4899' },
  { name: 'Custom Event', duration_minutes: 30, description: '', color: '#6b7280' },
];


// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeSlug(val: string) {
  return val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
}

function slugFromName(name: string): string {
  return sanitizeSlug(name.trim().replace(/\s+/g, '-')).slice(0, 30);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CalendlyLogo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#006BFF" />
      <path d="M33.5 30.5c-1.8 2.5-4.7 4-7.8 4-5.5 0-9.9-4.5-9.9-10s4.4-10 9.9-10c3.1 0 5.9 1.5 7.7 3.9" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="35" cy="24" r="2.5" fill="white" />
    </svg>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="flex gap-1.5 flex-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i < current ? 'bg-indigo-600' : i === current ? 'bg-indigo-300' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 font-medium">
        Step {current + 1} of {total}
      </span>
    </div>
  );
}

function SkipLink() {
  return (
    <div className="mt-8 text-center">
      <Link
        to="/dashboard"
        className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors underline-offset-2 hover:underline"
      >
        Skip setup, go to dashboard
      </Link>
    </div>
  );
}

// ─── Slug availability checker ────────────────────────────────────────────────

function SlugField({
  value,
  onChange,
  userId,
  onStatusChange,
}: {
  value: string;
  onChange: (v: string) => void;
  userId: string;
  onStatusChange: (s: SlugStatus) => void;
}) {
  const [status, setStatus] = useState<SlugStatus>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = window.location.origin.replace(/^https?:\/\//, '');

  const check = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2) {
      setStatus(slug ? 'invalid' : 'idle');
      onStatusChange(slug ? 'invalid' : 'idle');
      setSuggestions([]);
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      setStatus('invalid');
      onStatusChange('invalid');
      setSuggestions([]);
      return;
    }
    setStatus('checking');
    onStatusChange('checking');
    const { data } = await supabase
      .from('public_host_profiles')
      .select('id')
      .eq('slug', slug)
      .neq('id', userId)
      .maybeSingle();
    if (data) {
      setStatus('taken');
      onStatusChange('taken');
      setSuggestions([`${slug}1`, `${slug}2`, `${slug}3`]);
    } else {
      setStatus('available');
      onStatusChange('available');
      setSuggestions([]);
    }
  }, [userId, onStatusChange]);

  const handleChange = (val: string) => {
    const clean = sanitizeSlug(val);
    onChange(clean);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => check(clean), 400);
  };

  const statusIcon = () => {
    if (status === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />;
    if (status === 'available') return <Check className="h-4 w-4 text-indigo-600" />;
    if (status === 'taken' || status === 'invalid') return <AlertCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-600 transition">
        <span className="pl-3 pr-1 py-3 text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0">
          {origin}/
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="your-name"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 px-3 py-3 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-sm"
        />
        <div className="pr-3 shrink-0">{statusIcon()}</div>
      </div>

      {status === 'available' && (
        <p className="text-xs text-indigo-600 dark:text-indigo-500 font-medium flex items-center gap-1">
          <Check className="h-3.5 w-3.5" /> That URL is available!
        </p>
      )}
      {status === 'taken' && (
        <div>
          <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1.5">Already taken. Try one of these:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleChange(s)}
                className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-500 border border-slate-200 dark:border-slate-700 rounded-full transition-colors font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {status === 'invalid' && (
        <p className="text-xs text-red-600 dark:text-red-400">Use only lowercase letters, numbers, and hyphens (min 2 chars).</p>
      )}
    </div>
  );
}

// ─── Trial banner ─────────────────────────────────────────────────────────────

function TrialBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl success">
      <Gift className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">You're on a free 14-day Pro trial — no credit card needed. Want 60 days? Add a card ($0 today); billing starts after day 60.</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">After that it's just $6/mo, less than half of Calendly.</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Onboarding() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Path selection
  const [path, setPath] = useState<Path>('pick');

  // Shared state
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || profile?.timezone || 'America/New_York'
  );
  const [showTimezone, setShowTimezone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trialActivated, setTrialActivated] = useState(false);

  // Calendly path state
  const [calendlyStep, setCalendlyStep] = useState(0); // 0=url, 1=review, 2=calendar, 3=link, 4=success
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [calendlyConnecting, setCalendlyConnecting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [scrapedEvents, setScrapedEvents] = useState<ScrapedEvent[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fresh path state
  const [freshStep, setFreshStep] = useState(0); // 0=pick template, 1=customize, 2=link, 3=success
  const [selectedTemplate, setSelectedTemplate] = useState<FreshTemplate | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customDuration, setCustomDuration] = useState(30);
  const [customColor, setCustomColor] = useState('#5864C6');

  // Other path — reuses fresh flow
  const [otherStep, setOtherStep] = useState(0); // 0=customize, 1=link, 2=success

  // Auto-fill slug from name
  useEffect(() => {
    if (!slug && fullName) setSlug(slugFromName(fullName));
  }, [fullName, slug]);

  const activateTrial = useCallback(async () => {
    if (!user || trialActivated) return;
    const { hasStripeBilling, startLocalTrial } = await import('../lib/localTrial');
    if (await hasStripeBilling(user.id)) {
      setTrialActivated(true);
      return;
    }
    await startLocalTrial();
    setTrialActivated(true);
  }, [user, trialActivated]);

  const saveProfileAndServices = useCallback(async (
    services: { name: string; duration_minutes: number; description: string; color: string }[]
  ) => {
    if (!user) return;
    setSaving(true);

    await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
      slug: slug.trim() || null,
      timezone,
    }).eq('id', user.id);

    for (const svc of services) {
      await supabase.from('services').insert({
        host_id: user.id,
        name: svc.name,
        duration_minutes: svc.duration_minutes,
        description: svc.description || '',
        price_cents: 0,
        location_type: 'custom',
        location: '',
        is_active: true,
        color: svc.color,
      });
    }

    // Default Mon-Fri 9-5 availability
    const { data: existing } = await supabase
      .from('availability')
      .select('id')
      .eq('host_id', user.id)
      .limit(1);

    if (!existing?.length) {
      for (const day of [1, 2, 3, 4, 5]) {
        await supabase.from('availability').insert({
          host_id: user.id,
          day_of_week: day,
          start_time: '09:00',
          end_time: '17:00',
        });
      }
    }

    setSaving(false);
  }, [user, fullName, slug, timezone]);

  // ── Calendly: OAuth + scrape ───────────────────────────────────────────────

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
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('calendly-auth');
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
    if (!calendlyUrl.trim()) return;
    setScraping(true);
    setScrapeError('');
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-calendly`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ url: calendlyUrl.trim() }),
        }
      );
      const data = await resp.json() as { error?: string; events?: ScrapedEvent[] };
      if (data.error) { setScrapeError(data.error); setScraping(false); return; }
      const events = withoutPinOnItDemoFeedback(data.events ?? []).map((e) => ({ ...e, selected: true }));
      setScrapedEvents(events);
      await activateTrial();
      setCalendlyStep(1);
    } catch (e) {
      setScrapeError((e as Error).message ?? 'Failed to reach Calendly. Please try again.');
    }
    setScraping(false);
  };

  const toggleEventSelection = (i: number) => {
    setScrapedEvents((prev) => prev.map((e, idx) => idx === i ? { ...e, selected: !e.selected } : e));
  };

  const handleCalendlyFinish = async () => {
    const services = withoutPinOnItDemoFeedback(scrapedEvents.filter((e) => e.selected)).map((e) => ({
      name: e.name,
      duration_minutes: e.duration_minutes,
      description: e.description,
      color: e.color,
    }));
    await saveProfileAndServices(services);
    setCalendlyStep(4);
  };

  // ── Fresh / Other finish ──────────────────────────────────────────────────

  const handleFreshFinish = async () => {
    const svc = selectedTemplate?.name === 'Custom Event'
      ? { name: customName || 'Custom Event', duration_minutes: customDuration, description: customDesc, color: customColor }
      : selectedTemplate
        ? { name: customName || selectedTemplate.name, duration_minutes: customDuration || selectedTemplate.duration_minutes, description: customDesc || selectedTemplate.description, color: customColor }
        : null;
    if (!svc) return;
    await saveProfileAndServices([svc]);
    setFreshStep(3);
  };

  const handleOtherFinish = async () => {
    const svc = { name: customName || '30-Minute Meeting', duration_minutes: customDuration, description: customDesc, color: customColor };
    await saveProfileAndServices([svc]);
    setOtherStep(2);
  };

  const bookingUrl = `${window.location.origin}/${slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const inputCls = 'w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition text-sm';

  // ── Success screen (shared) ───────────────────────────────────────────────

  const SuccessScreen = () => (
    <div className="text-center py-4">
      <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto mb-5">
        <Check className="h-8 w-8 text-indigo-600 dark:text-indigo-500" />
      </div>
      <h1 className="text-2xl font-bold mb-1">You're all set!</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Your booking link is live.</p>
      {slug && (
        <p className="text-indigo-600 dark:text-indigo-500 font-semibold text-lg mb-6">
          {window.location.origin.replace(/^https?:\/\//, '')}/{slug}
        </p>
      )}
      {trialActivated && <TrialBanner />}
      <div className="flex items-center gap-2 mb-6 max-w-sm mx-auto">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 min-w-0">
          <span className="text-sm text-slate-700 dark:text-slate-300 truncate font-mono">{bookingUrl}</span>
        </div>
        <button
          onClick={copyLink}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            copiedLink ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiedLink ? 'Copied!' : 'Copy'}
        </button>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <button
        onClick={() => navigate('/dashboard')}
        className="px-8 py-3.5 text-white font-semibold rounded-xl transition-colors inline-flex items-center gap-2 shadow-lg hover:opacity-90"
        style={{ backgroundColor: '#5864C6' }}
      >
        Go to my dashboard <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  // ── Link claim step (shared) ──────────────────────────────────────────────

  const LinkClaimStep = ({ onBack, onNext }: { onBack: () => void; onNext: () => void }) => (
    <div>
      <ProgressBar current={path === 'calendly' ? 3 : path === 'fresh' ? 2 : 1} total={path === 'calendly' ? 5 : 4} />
      <div className="mb-8">
        <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
          <Zap className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Claim your booking link</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">This is the URL you'll share so people can book time with you.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Your name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (!slug) setSlug(slugFromName(e.target.value));
            }}
            placeholder="Jane Smith"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Your booking URL</label>
          {user && (
            <SlugField
              value={slug}
              onChange={setSlug}
              userId={user.id}
              onStatusChange={setSlugStatus}
            />
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowTimezone((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            Timezone: <span className="text-indigo-600 dark:text-indigo-500 font-medium">{timezone}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTimezone ? 'rotate-180' : ''}`} />
          </button>
          {showTimezone && (
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={`${inputCls} mt-2`}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={saving || !slug || (slugStatus !== 'available' && slugStatus !== 'idle')}
          className="flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 text-sm shadow-md hover:opacity-90"
          style={{ backgroundColor: '#5864C6' }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Finish setup'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <SkipLink />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col transition-colors">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-colors">
        <div className="max-w-xl mx-auto px-6 py-4">
          <img src="/pinonit_logo.png" alt="Pin on It" className="h-8 w-auto" />
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center">
        <div className="w-full max-w-xl px-6 py-10">

          {/* ── Path selection ── */}
          {path === 'pick' && (
            <div>
              <div className="mb-8 text-center">
                <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
                </div>
                <h1 className="text-2xl font-bold mb-1">How are you setting up PinOnIt?</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">We'll tailor the setup to match your situation.</p>
              </div>

              <div className="space-y-3">
                {/* Calendly card */}
                <button
                  onClick={() => setPath('calendly')}
                  className="w-full p-5 bg-white dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl text-left transition-all group hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      <CalendlyLogo />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">Switching from Calendly</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Import your event types. 60 days Pro with a card on file — $0 today.</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">Free trial</span>
                      <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors mt-1" />
                    </div>
                  </div>
                </button>

                {/* Other tool card */}
                <button
                  onClick={() => setPath('other')}
                  className="w-full p-5 bg-white dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 rounded-2xl text-left transition-all group hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">Switching from another tool</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Acuity, Doodle, SavvyCal, or anything else — set up manually.</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors shrink-0" />
                  </div>
                </button>

                {/* Fresh card */}
                <button
                  onClick={() => setPath('fresh')}
                  className="w-full p-5 bg-white dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-600 rounded-2xl text-left transition-all group hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">Starting fresh</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">New to scheduling tools — we'll walk you through everything.</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 transition-colors shrink-0" />
                  </div>
                </button>
              </div>
              <SkipLink />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              CALENDLY PATH
          ══════════════════════════════════════════════════════════════ */}

          {path === 'calendly' && calendlyStep === 0 && (
            <div>
              <ProgressBar current={0} total={5} />
              <div className="mb-8">
                <button onClick={() => setPath('pick')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-4">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <CalendlyLogo className="h-8 w-8" />
                  <h1 className="text-2xl font-bold">Import from Calendly</h1>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">We'll pull in your event types so you don't have to rebuild from scratch.</p>
              </div>
              <TrialBanner />
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => void handleConnectCalendly()}
                  disabled={calendlyConnecting}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-slate-900 border-2 border-[#006BFF] hover:bg-blue-50 dark:hover:bg-blue-950/20 disabled:opacity-50 text-[#006BFF] text-base font-bold rounded-2xl transition-colors shadow-sm"
                >
                  {calendlyConnecting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Calendar className="h-6 w-6" />
                  )}
                  Connect Calendly Account
                </button>

                <p className="text-center text-xs text-slate-400 dark:text-slate-500 tracking-widest">
                  ── or ──
                </p>

                <div className="space-y-2">
                  <label htmlFor="calendly-url-onboarding" className="block text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                    Paste your Calendly URL manually
                  </label>
                  <input
                    id="calendly-url-onboarding"
                    type="text"
                    value={calendlyUrl}
                    onChange={(e) => { setCalendlyUrl(e.target.value); setScrapeError(''); }}
                    placeholder="https://calendly.com/yourname"
                    className={inputCls}
                    onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                  />
                </div>
                {scrapeError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {scrapeError}
                  </div>
                )}
                <button
                  onClick={handleScrape}
                  disabled={scraping || !calendlyUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {scraping ? 'Importing your events...' : 'Import from URL'}
                </button>
              </div>
              <SkipLink />
            </div>
          )}

          {path === 'calendly' && calendlyStep === 1 && (
            <div>
              <ProgressBar current={1} total={5} />
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Review imported events</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Uncheck any you don't want to bring over.</p>
              </div>
              <div className="space-y-2 mb-6">
                {scrapedEvents.map((evt, i) => (
                  <button
                    key={i}
                    onClick={() => toggleEventSelection(i)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      evt.selected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-600'
                        : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        evt.selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {evt.selected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: evt.color }} />
                          <p className="font-semibold text-sm">{evt.name}</p>
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />{evt.duration_minutes} min
                          </span>
                        </div>
                        {evt.description && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate pl-4">{evt.description}</p>}
                      </div>
                      {evt.selected ? null : <X className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />}
                    </div>
                  </button>
                ))}
                {scrapedEvents.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No events found. They'll be created with defaults.</p>
                )}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setCalendlyStep(0)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={() => setCalendlyStep(2)}
                  className="flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-colors text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: '#5864C6' }}
                >
                  Looks good <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <SkipLink />
            </div>
          )}

          {path === 'calendly' && calendlyStep === 2 && (
            <div>
              <ProgressBar current={2} total={5} />
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Connect your calendar</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Automatically block busy times and add new meetings to your calendar.</p>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  {
                    key: 'google',
                    label: 'Google Calendar',
                    desc: 'Gmail, Google Workspace',
                    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50',
                    icon: (
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    ),
                  },
                  {
                    key: 'outlook',
                    label: 'Outlook / Office 365',
                    desc: 'Microsoft personal & work accounts',
                    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50',
                    icon: (
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                        <rect x="1" y="4" width="14" height="16" rx="1.5" fill="#0078D4"/>
                        <path d="M1 8l7 5 7-5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                        <rect x="13" y="12" width="10" height="8" rx="1" fill="#50B0F0"/>
                        <path d="M13 14l5 3 5-3" stroke="white" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                ].map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setCalendlyStep(3)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md hover:scale-[1.01] active:scale-100 ${p.bg}`}
                  >
                    <div className="shrink-0">{p.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{p.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{p.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setCalendlyStep(1)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={() => setCalendlyStep(3)} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  Skip for now →
                </button>
              </div>
              <SkipLink />
            </div>
          )}

          {path === 'calendly' && calendlyStep === 3 && (
            <LinkClaimStep
              onBack={() => setCalendlyStep(2)}
              onNext={handleCalendlyFinish}
            />
          )}

          {path === 'calendly' && calendlyStep === 4 && <SuccessScreen />}

          {/* ══════════════════════════════════════════════════════════════
              STARTING FRESH PATH
          ══════════════════════════════════════════════════════════════ */}

          {path === 'fresh' && freshStep === 0 && (
            <div>
              <ProgressBar current={0} total={4} />
              <button onClick={() => setPath('pick')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-6">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Pick an event type to start</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">You can always add more later from the Event Types page.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {FRESH_TEMPLATES.map((tpl, i) => {
                  const isCustom = tpl.name === 'Custom Event';
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        setCustomName(isCustom ? '' : tpl.name);
                        setCustomDesc(tpl.description);
                        setCustomDuration(tpl.duration_minutes);
                        setCustomColor(tpl.color);
                        setFreshStep(1);
                      }}
                      className="p-4 bg-white dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-600 rounded-xl text-left transition-all group hover:shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tpl.color }} />
                        <p className="font-semibold text-sm group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                          {isCustom ? 'Custom (blank)' : tpl.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mb-1.5 pl-5">
                        <Clock className="h-3 w-3" />
                        {tpl.duration_minutes >= 60
                          ? `${tpl.duration_minutes / 60}h`
                          : `${tpl.duration_minutes}min`}
                      </div>
                      {tpl.description && <p className="text-xs text-slate-400 dark:text-slate-500 pl-5 leading-snug">{tpl.description}</p>}
                      {isCustom && <p className="text-xs text-slate-400 dark:text-slate-500 pl-5">Start from scratch</p>}
                    </button>
                  );
                })}
              </div>
              <SkipLink />
            </div>
          )}

          {path === 'fresh' && freshStep === 1 && selectedTemplate && (
            <div>
              <ProgressBar current={1} total={4} />
              <div className="mb-6">
                <button onClick={() => setFreshStep(0)} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-4">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <h1 className="text-2xl font-bold mb-1">Customize your event type</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">You can adjust everything here.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Event name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={selectedTemplate.name}
                    autoFocus
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description <span className="font-normal text-slate-400">(optional)</span></label>
                  <textarea
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder="What's this meeting for?"
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {[15, 30, 45, 60, 90].map((d) => (
                      <button
                        key={d}
                        onClick={() => setCustomDuration(d)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                          customDuration === d
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {d >= 60 ? `${d / 60}h` : `${d}min`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
                  <ColorSwatchRow value={customColor} onChange={setCustomColor} size="sm" />
                </div>
              </div>
              <div className="mt-8 flex justify-between">
                <button onClick={() => setFreshStep(0)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={() => setFreshStep(2)}
                  disabled={!customName.trim() && selectedTemplate.name === 'Custom Event'}
                  className="flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: '#5864C6' }}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <SkipLink />
            </div>
          )}

          {path === 'fresh' && freshStep === 2 && (
            <LinkClaimStep
              onBack={() => setFreshStep(1)}
              onNext={handleFreshFinish}
            />
          )}

          {path === 'fresh' && freshStep === 3 && <SuccessScreen />}

          {/* ══════════════════════════════════════════════════════════════
              OTHER TOOL PATH
          ══════════════════════════════════════════════════════════════ */}

          {path === 'other' && otherStep === 0 && (
            <div>
              <ProgressBar current={0} total={3} />
              <button onClick={() => setPath('pick')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-6">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="mb-6">
                <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                  <CalendarDays className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                </div>
                <h1 className="text-2xl font-bold mb-1">Set up your first event type</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Create an event type — you can add more from the dashboard any time.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Event name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. 30-Minute Intro Call"
                    autoFocus
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description <span className="font-normal text-slate-400">(optional)</span></label>
                  <textarea
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder="What's this meeting for?"
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {[15, 30, 45, 60, 90].map((d) => (
                      <button
                        key={d}
                        onClick={() => setCustomDuration(d)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                          customDuration === d
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {d >= 60 ? `${d / 60}h` : `${d}min`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
                  <ColorSwatchRow value={customColor} onChange={setCustomColor} size="sm" />
                </div>
              </div>
              <div className="mt-8 flex justify-between">
                <button onClick={() => setPath('pick')} className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={() => setOtherStep(1)}
                  disabled={!customName.trim()}
                  className="flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: '#5864C6' }}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <SkipLink />
            </div>
          )}

          {path === 'other' && otherStep === 1 && (
            <LinkClaimStep
              onBack={() => setOtherStep(0)}
              onNext={handleOtherFinish}
            />
          )}

          {path === 'other' && otherStep === 2 && <SuccessScreen />}

        </div>
      </main>
    </div>
  );
}
