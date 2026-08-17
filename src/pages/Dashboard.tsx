import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { OnboardingWizard, wizardIsActive, wizardSavedStep, onboardingIsCompleted } from '../components/OnboardingWizard';
import { clearStaleOnboardingLocalState, markOnboardingCompletedLocal } from '../lib/onboardingState';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import { syncStripeSubscription } from '../lib/stripe';
import { effectivePlan } from '../lib/plan';
import type { Booking, Service } from '../lib/types';
import { CalendarDays, Settings, LogOut, Users, X, Check, Sun, Moon, Copy, Share2, Mail, Link2, ExternalLink, PenLine, Video, Phone, MapPin, ChevronRight, Loader2, CalendarCheck, Plus, ChevronLeft, LayoutGrid, Menu, AlertCircle, Sparkles, Search, ShoppingBag, Wrench as Tool, QrCode, MessageSquare, ChevronDown } from 'lucide-react';
import { QRModal } from '../components/QRModal';
import {
  buildAvailabilityEmailInvite,
  buildAvailabilitySmsInvite,
  openEmailComposer,
  openSmsComposer,
  openWhatsAppComposer,
} from '../lib/bookingShare';
import {
  LINK_EXPIRY_OPTIONS,
  isSingleUseLinksEnabled,
  linkExpiryToDays,
  resolveLinkExpiry,
  type LinkExpiryValue,
} from '../lib/singleUseLinks';

type NavItem = { to: string; icon: typeof LayoutGrid; label: string };

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
          body: 'Reminder: your {{service_name}} with {{host_name}} starts in 1 hour at {{time}}. {{location}} Reply STOP to opt out.',
        });
      }
      if (reminderWhatsapp) {
        reminderChannels.push({
          channel: 'whatsapp',
          subject: null,
          body: 'Hi {{guest_name}}! Just a reminder that your *{{service_name}}* with {{host_name}} starts in 1 hour at {{time}}.\n\n{{location}}\n\nReply STOP to opt out.',
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
                  <opt.icon className="h-4 w-4 shrink-0" />
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

// ── Success banner ────────────────────────────────────────────────────────────

function LinkCreatedBanner({ bookingUrl, onDismiss }: { bookingUrl: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [bookingUrl]);

  if (!bookingUrl) return null;

  return (
    <div className="mb-6 bg-brand-50 border border-brand-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-5 w-5 bg-brand-600 rounded-full flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
        <h2 className="font-semibold text-brand-900 text-sm">Your meeting link is live!</h2>
        <button onClick={onDismiss} className="ml-auto p-1 text-brand-400 hover:text-brand-700 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-brand-700 mb-3">Share this link so people can schedule directly on your calendar.</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-brand-200 rounded-xl px-3 py-2.5 min-w-0">
          <Link2 className="h-3.5 w-3.5 text-brand-500 shrink-0" />
          <span className="text-sm text-gray-700 truncate font-mono">{bookingUrl}</span>
        </div>
        <button
          onClick={copy}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            copied ? 'bg-brand-600 text-white' : 'bg-white border border-brand-200 text-brand-700 hover:bg-brand-50'
          }`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-2.5 rounded-xl bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

// ── Inline slug editor ────────────────────────────────────────────────────────

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function SlugEditor({ currentSlug, userId, onSaved }: { currentSlug: string; userId: string; onSaved: (newSlug: string) => void }) {
  const [draft, setDraft] = useState(currentSlug);
  const [status, setStatus] = useState<SlugStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const sanitize = (val: string) =>
    val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');

  const buildSuggestions = (slug: string): string[] => {
    const results: string[] = [];
    for (let i = 1; i <= 3; i++) results.push(`${slug}${i}`);
    return results.filter((s) => s !== currentSlug);
  };

  const checkSlug = useCallback(async (slug: string) => {
    if (!slug || slug === currentSlug) { setStatus('idle'); setSuggestions([]); return; }
    if (slug.length < 2) { setStatus('invalid'); setSuggestions([]); return; }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) { setStatus('invalid'); setSuggestions([]); return; }

    setStatus('checking');
    const { data } = await supabase
      .from('public_host_profiles')
      .select('id')
      .eq('slug', slug)
      .neq('id', userId)
      .maybeSingle();

    if (data) {
      setStatus('taken');
      setSuggestions(buildSuggestions(slug));
    } else {
      setStatus('available');
      setSuggestions([]);
    }
  }, [currentSlug, userId]);

  const handleChange = (val: string) => {
    const clean = sanitize(val);
    setDraft(clean);
    setSaveError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkSlug(clean), 400);
  };

  const handleSave = async () => {
    if (status !== 'available' || !draft || draft === currentSlug) return;
    setSaving(true);
    setSaveError('');
    const { error } = await supabase.from('profiles').update({ slug: draft }).eq('id', userId);
    if (error) {
      setSaveError(error.message || 'Failed to save. Please try again.');
      setSaving(false);
      return;
    }
    onSaved(draft);
  };

  const statusIcon = () => {
    if (status === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />;
    if (status === 'available') return <Check className="h-4 w-4 text-emerald-500" />;
    if (status === 'taken' || status === 'invalid') return <AlertCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  const statusText = () => {
    if (draft === currentSlug || status === 'idle') return null;
    if (status === 'checking') return <span className="text-xs text-slate-400">Checking…</span>;
    if (status === 'available') return <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Available!</span>;
    if (status === 'taken') return <span className="text-xs text-red-600 dark:text-red-400 font-medium">Already taken</span>;
    if (status === 'invalid') return <span className="text-xs text-red-600 dark:text-red-400 font-medium">Use only letters, numbers, and hyphens (min 2 chars)</span>;
    return null;
  };

  const origin = window.location.origin;

  return (
    <div className="mt-3 p-4 bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-700 rounded-xl space-y-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Customize your URL</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 transition">
          <span className="pl-3 pr-1 text-sm text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
            {origin.replace(/^https?:\/\//, '')}/
          </span>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && status === 'available') handleSave(); }}
            className="flex-1 min-w-0 py-2.5 pr-3 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            placeholder="your-name"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="pr-3 shrink-0">{statusIcon()}</div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || status !== 'available' || draft === currentSlug}
          className="shrink-0 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>{statusText()}</div>
      </div>

      {status === 'taken' && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 dark:text-slate-500">Try:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setDraft(s); if (debounceRef.current) clearTimeout(debounceRef.current); checkSlug(s); }}
              className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700 rounded-full transition-colors font-medium"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {saveError && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {saveError}
        </p>
      )}
    </div>
  );
}

// ── Single-use links (scheduling page) ────────────────────────────────────────

function SingleUseLinksRow() {
  const { profile, refreshProfile } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [linkExpiry, setLinkExpiry] = useState<LinkExpiryValue>('1_booking');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    setEnabled(isSingleUseLinksEnabled(profile));
    setLinkExpiry(resolveLinkExpiry(profile));
  }, [profile?.id]);

  const persist = useCallback(async (nextEnabled: boolean, nextExpiry: LinkExpiryValue) => {
    if (!profile?.id) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({
        single_use_links: nextEnabled,
        link_expiry: nextEnabled ? nextExpiry : '1_booking',
        single_use_links_enabled: nextEnabled,
        default_link_expiry_days: nextEnabled ? linkExpiryToDays(nextExpiry) : null,
      })
      .eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
  }, [profile?.id, refreshProfile]);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    void persist(next, linkExpiry);
  };

  const handleExpiryChange = (expiry: LinkExpiryValue) => {
    setLinkExpiry(expiry);
    if (enabled) void persist(true, expiry);
  };

  if (!profile) return null;

  return (
    <div className="mb-6 bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link2 className="h-4 w-4 text-brand-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Single use links</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Hand out a booking link that stops working once it&apos;s been used. Pick how long it stays valid: until <span className="font-medium text-gray-600 dark:text-slate-300">1 booking</span> is made, or for <span className="font-medium text-gray-600 dark:text-slate-300">7</span> or <span className="font-medium text-gray-600 dark:text-slate-300">30 days</span> — whichever comes first.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${enabled ? 'bg-[#5864C6]' : 'bg-gray-300 dark:bg-slate-600'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        {enabled && (
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:ml-auto">
            {LINK_EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={saving}
                onClick={() => handleExpiryChange(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-60 ${
                  linkExpiry === opt.value
                    ? 'bg-[#5864C6] border-[#5864C6] text-white'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Share panel ───────────────────────────────────────────────────────────────

function buildShareUrl(
  slug: string,
  services: Service[],
  selectedIds: Set<string>,
  origin = (import.meta.env.VITE_APP_URL ?? 'https://pinonit.com').replace(/\/$/, ''),
): string {
  const base = `${origin}/${slug}`;
  if (services.length === 0 || selectedIds.size === 0 || selectedIds.size >= services.length) {
    return base;
  }
  return `${base}?types=${Array.from(selectedIds).join(',')}`;
}

function SharePanel({
  slug,
  userId,
  onSlugChange,
  shareUrl,
  hostName,
}: {
  slug: string;
  userId: string;
  onSlugChange: (newSlug: string) => void;
  shareUrl: string;
  hostName?: string;
}) {
  const [currentSlug, setCurrentSlug] = useState(slug);
  const [showEditor, setShowEditor] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [linkCopiedToast, setLinkCopiedToast] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentSlug(slug);
  }, [slug]);

  useEffect(() => {
    if (!shareMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [shareMenuOpen]);

  const showShareToast = useCallback((msg: string) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(null), 2500);
  }, []);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopiedToast(true);
      setTimeout(() => setLinkCopiedToast(false), 2000);
    });
  }, [shareUrl]);

  const emailInvite = buildAvailabilityEmailInvite(shareUrl, hostName);
  const smsInvite = buildAvailabilitySmsInvite(shareUrl, hostName);

  const handleEmail = (provider: 'gmail' | 'outlook' | 'default') => {
    openEmailComposer(provider, emailInvite.subject, emailInvite.body);
    setShareMenuOpen(false);
    showShareToast(provider === 'gmail' ? 'Opened Gmail compose' : provider === 'outlook' ? 'Opened Outlook compose' : 'Opened email app');
  };

  const handleSms = () => {
    openSmsComposer(smsInvite);
    setShareMenuOpen(false);
    showShareToast('Opened Messages');
  };

  const handleWhatsApp = () => {
    openWhatsAppComposer(smsInvite);
    setShareMenuOpen(false);
    showShareToast('Opened WhatsApp');
  };

  const copyEmailInvite = async () => {
    await navigator.clipboard.writeText(`Subject: ${emailInvite.subject}\n\n${emailInvite.body}`);
    setShareMenuOpen(false);
    showShareToast('Email message copied');
  };

  const copySmsInvite = async () => {
    await navigator.clipboard.writeText(smsInvite);
    setShareMenuOpen(false);
    showShareToast('Text message copied');
  };

  const handleSaved = (newSlug: string) => {
    setCurrentSlug(newSlug);
    setShowEditor(false);
    onSlugChange(newSlug);
  };

  const menuItemCls =
    'w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors';

  return (
    <div className="mb-6 bg-brand-50 border border-brand-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Share2 className="h-4 w-4 text-brand-600" />
        <h2 className="font-semibold text-brand-900 text-sm">Your meeting link</h2>
      </div>
      <p className="text-xs text-brand-700 mb-3">Share this link anywhere so people can schedule a meeting with you.</p>

      {/* URL display row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-brand-200 rounded-xl px-3 py-2.5 min-w-0">
          <Link2 className="h-3.5 w-3.5 text-brand-500 shrink-0" />
          <span className="text-sm text-gray-700 truncate font-mono">{shareUrl}</span>
        </div>
      </div>

      {/* Quick actions — copy link & compact QR */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors"
        >
          <Copy className="h-4 w-4" />
          Copy Link
        </button>
        <button
          type="button"
          onClick={() => setShowQR(true)}
          title="QR code"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors"
        >
          <QrCode className="h-3.5 w-3.5" />
          QR
        </button>
      </div>

      {linkCopiedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full shadow-lg">
          Link copied!
        </div>
      )}

      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full shadow-lg">
          {shareToast}
        </div>
      )}

      {/* Primary share actions */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="relative" ref={shareMenuRef}>
          <button
            type="button"
            onClick={() => setShareMenuOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors"
            aria-expanded={shareMenuOpen}
            aria-haspopup="menu"
          >
            <Mail className="h-4 w-4" />
            Send Availability (Email/SMS/WhatsApp)
            <ChevronDown className={`h-4 w-4 transition-transform ${shareMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {shareMenuOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5"
              role="menu"
            >
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Send email with
              </p>
              <button type="button" onClick={() => handleEmail('gmail')} className={menuItemCls}>Gmail</button>
              <button type="button" onClick={() => handleEmail('outlook')} className={menuItemCls}>Outlook</button>
              <button type="button" onClick={() => handleEmail('default')} className={menuItemCls}>Default email app</button>
              <button type="button" onClick={copyEmailInvite} className={`${menuItemCls} flex items-center gap-1.5`}>
                <Copy className="h-3.5 w-3.5" /> Copy email message
              </button>
              <div className="my-1 border-t border-gray-100 dark:border-slate-800" />
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Send text with
              </p>
              <button type="button" onClick={handleSms} className={`${menuItemCls} flex items-center gap-1.5`}>
                <MessageSquare className="h-3.5 w-3.5" /> SMS
              </button>
              <button type="button" onClick={handleWhatsApp} className={`${menuItemCls} flex items-center gap-1.5`}>
                <MessageSquare className="h-3.5 w-3.5" style={{ color: '#25D366' }} /> WhatsApp
              </button>
              <button type="button" onClick={copySmsInvite} className={`${menuItemCls} flex items-center gap-1.5`}>
                <Copy className="h-3.5 w-3.5" /> Copy text message
              </button>
            </div>
          )}
        </div>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View as End User
        </a>
      </div>

      {showQR && (
        <QRModal
          variant="booking"
          url={shareUrl}
          title={currentSlug}
          onClose={() => setShowQR(false)}
        />
      )}

      {showEditor && (
        <SlugEditor
          currentSlug={currentSlug}
          userId={userId}
          onSaved={handleSaved}
        />
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user, profile, subscription, subscriptionLoaded, signOut, refreshProfile } = useAuth();
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const displayEmail = profile?.email || user?.email || '';
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [calendarCount, setCalendarCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const planName = effectivePlan(subscription, profile);
  const [checklistDismissed, setChecklistDismissed] = useState(() => localStorage.getItem('onboarding_checklist_dismissed') === '1');
  const [liveSlug, setLiveSlug] = useState<string | null>(null);

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

  // Resume wizard after OAuth redirect if wizard_active was set in localStorage
  const [showWizard, setShowWizard] = useState(() => {
    if (new URLSearchParams(window.location.search).get('onboarding') === '1') return true;
    if (shouldReopenWizardForCalendly()) return true;
    if (!onboardingIsCompleted() && wizardIsActive()) return true;
    return false;
  });
  const [wizardChecked, setWizardChecked] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<number | undefined>(() => {
    if (shouldReopenWizardForCalendly()) return 0;
    if (!onboardingIsCompleted() && wizardIsActive()) return wizardSavedStep();
    return undefined;
  });
  const [trialToast, setTrialToast] = useState<{ message: string } | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceQrModal, setServiceQrModal] = useState<{ url: string; title: string } | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());

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
      setTrialToast({ message: 'You\'re on Pro — $6/mo, cancel anytime in Billing.' });
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
    if (new URLSearchParams(window.location.search).get('onboarding') === '1') {
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding');
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
    // Wait until profile, local data, AND subscription have all settled
    if (wizardChecked || !profile || loading || !subscriptionLoaded) return;
    setWizardChecked(true);

    // Never show if already opened from checkout return, ?onboarding=1, or OAuth resume
    if (showWizard) return;

    // DB is source of truth — stale localStorage must not skip wizard after a wipe / fresh account
    if (profile.onboarding_completed) return;

    if (!profile.wizard_active && onboardingIsCompleted()) {
      clearStaleOnboardingLocalState();
    }

    // Active Pro/trialing subscription — mark completed and do not show
    const isActivePro = (
      subscription?.plan === 'pro' && subscription?.status !== 'canceled'
    ) || profile.plan === 'pro';
    if (isActivePro) {
      supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id);
      return;
    }

    // Has connected calendar AND event types — clearly past initial setup
    if (calendarCount > 0 && services.length > 0) {
      supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id);
      return;
    }

    // Has a slug AND services — has completed setup manually
    if (services.length > 0 && profile.slug) {
      supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id);
      return;
    }

    // Genuine new user — show the wizard
    setShowWizard(true);
  }, [profile, subscription, subscriptionLoaded, loading, wizardChecked, showWizard, calendarCount, services]);

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
      { name: '15 Minute Meeting', duration_minutes: 15, color: '#5864C6' },
      { name: '30 Minute Meeting', duration_minutes: 30, color: '#3b82f6' },
      { name: '60 Minute Meeting', duration_minutes: 60, color: '#f59e0b' },
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
        price_cents: 0,
        is_active: true,
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
          .select('*, services(name, color, duration_minutes)')
          .eq('host_id', profile.id)
          .order('start_time', { ascending: true }),
        supabase.from('services').select('*').eq('host_id', profile.id),
        supabase.from('connected_calendars').select('id', { count: 'exact', head: true }).eq('host_id', profile.id),
      ]);
      setBookings(bookRes.data ?? []);
      setServices(svcRes.data ?? []);
      setCalendarCount(calRes.count ?? 0);
      setLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    setSelectedServiceIds(new Set(services.map((s) => s.id)));
  }, [services]);

  const effectiveSlug = (liveSlug || profile?.slug || '').trim();
  const bookingSlug = effectiveSlug;
  const shareUrl = bookingSlug ? buildShareUrl(bookingSlug, services, selectedServiceIds) : '';

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        if (next.size <= 1) return prev;
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  // Seed default availability (Mon-Fri, 10am-12pm + 1pm-3pm) for users with none
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
      const days = [1, 2, 3, 4, 5];
      const rows = days.flatMap((d) => [
        { host_id: profile.id, day_of_week: d, start_time: '10:00', end_time: '12:00', is_active: true },
        { host_id: profile.id, day_of_week: d, start_time: '13:00', end_time: '15:00', is_active: true },
      ]);
      await supabase.from('availability').insert(rows);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, loading]);

  const upcomingBookings = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.start_time) >= new Date()
  );

  const handleCreated = (service: Service, bookingUrl: string) => {
    setServices((prev) => [...prev, service]);
    setShowCreateModal(false);
    setCreatedUrl(bookingUrl);
  };

  const mainNavItems: NavItem[] = [
    { to: '/dashboard', icon: LayoutGrid, label: 'Send your Availability' },
    { to: '/dashboard/appointments', icon: CalendarCheck, label: 'Calendar' },
    { to: '/dashboard/contacts', icon: Users, label: 'Contacts' },
    { to: '/dashboard/group-scheduling', icon: Users, label: 'Group Scheduling' },
    { to: '/dashboard/more-tools', icon: Tool, label: 'More Tools' },
    { to: '/dashboard/paid-booking', icon: ShoppingBag, label: 'Paid Booking' },
    { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/group-scheduling') {
      return location.pathname.startsWith('/dashboard/group-scheduling')
        || location.pathname === '/dashboard/coordinate';
    }
    if (path === '/dashboard/more-tools') {
      return location.pathname === '/dashboard/more-tools'
        || location.pathname === '/dashboard/qr-code'
        || location.pathname === '/dashboard/qr'
        || location.pathname === '/dashboard/signature';
    }
    return location.pathname === path;
  };
  const initials = (displayName?.[0] ?? displayEmail?.[0] ?? '?').toUpperCase();

  const navLinkClass = (path: string) => {
    const active = isActive(path);
    const padding = active ? 'pl-[calc(0.75rem-3px)] pr-3' : 'px-3';
    return `flex items-center gap-3 py-2.5 rounded-lg text-sm transition-colors ${padding} ${
      active
        ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-semibold border-l-[3px] border-brand-600 dark:border-brand-500 rounded-l-none'
        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-900'
    }`;
  };

  const renderNavLink = (item: NavItem, opts?: { collapsed?: boolean; onNavigate?: () => void }) => (
    <Link
      key={item.to}
      to={item.to}
      title={opts?.collapsed ? item.label : undefined}
      onClick={opts?.onNavigate}
      className={`${navLinkClass(item.to)} ${opts?.collapsed ? 'justify-center px-3' : ''}`}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      {!opts?.collapsed && item.label}
    </Link>
  );

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
        <button onClick={toggleTheme} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors rounded-lg" title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button onClick={() => setShowLogoutConfirm(true)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors rounded-lg" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white flex transition-colors">

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
          {mainNavItems.map((item) => renderNavLink(item, { collapsed: sidebarCollapsed }))}
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
              {mainNavItems.map((item) => renderNavLink(item, { onNavigate: () => setMobileMenuOpen(false) }))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Desktop account bar — upper right */}
        <header className="hidden md:flex sticky top-0 z-40 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-2.5 items-center justify-end shrink-0">
          {renderAccountBar()}
        </header>

        {/* Mobile top bar */}
        <header className="md:hidden border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-40 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          <a href="https://pinonit.com" target="_blank" rel="noopener noreferrer">
            <img src="/pinonit_logo.png" alt="Pin on It" className="h-8 w-auto" />
          </a>
          {renderAccountBar({ compact: true })}
        </header>

        {/* Dashboard home */}
        {isActive('/dashboard') && (
          <main className="flex-1 p-6 md:p-8 max-w-4xl w-full">

            {/* Page heading */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Send your Availability</h1>
                <p className="mt-1 text-gray-500 dark:text-slate-400 text-sm">
                  {upcomingBookings.length > 0
                    ? `${upcomingBookings.length} upcoming meeting${upcomingBookings.length !== 1 ? 's' : ''}`
                    : 'Manage your event types and booking link.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {profile?.show_wizard_button !== false && (
                  <button
                    onClick={() => setShowWizard(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title="Run setup wizard"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Wizard Setup</span>
                  </button>
                )}
              </div>
            </div>

            {/* Onboarding checklist — hidden automatically when all steps complete */}
            {!loading && !checklistDismissed && (() => {
              const hasCalendar = calendarCount > 0;
              const hasService = services.length > 0;
              const hasSlug = !!(profile?.slug || liveSlug);
              const slugDisplay = profile?.slug || liveSlug || '';
              const steps = [
                { label: 'Connect your calendar', sub: 'Sync Google or Outlook to prevent double-bookings', done: hasCalendar, to: '/dashboard/settings?tab=availability' },
                { label: 'Create your first event type', sub: 'Define a meeting type guests can book', done: hasService, to: '/dashboard/services' },
                { label: 'Share your booking link', sub: hasSlug ? `pinonit.com/${slugDisplay}` : 'Set a custom username in Settings', done: hasSlug, to: hasSlug ? undefined : '/dashboard/settings?tab=booking_page' },
              ];
              const completedCount = steps.filter((s) => s.done).length;
              const allDone = completedCount === steps.length;
              if (allDone) return null;
              return (
                <div className="mb-6 bg-white dark:bg-slate-900/50 rounded-2xl overflow-hidden shadow-sm" style={{ border: '1.5px solid #f97316', animation: 'onboarding-pulse 2s ease-in-out infinite' }}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {steps.map((s, i) => (
                          <div key={i} className={`h-2 w-8 rounded-full transition-colors ${s.done ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {`Get started — ${completedCount} of ${steps.length} done`}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {steps.map((step, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-4 px-5 py-3.5 ${step.to ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors' : ''}`}
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

            {/* Share panel / link created banner */}
            {createdUrl && <LinkCreatedBanner bookingUrl={createdUrl} onDismiss={() => setCreatedUrl('')} />}
            {profile && effectiveSlug && !createdUrl && (
              <SharePanel
                slug={effectiveSlug}
                userId={profile.id}
                onSlugChange={(s) => {
                  setLiveSlug(s);
                  void refreshProfile();
                }}
                shareUrl={shareUrl || `https://pinonit.com/${effectiveSlug}`}
                hostName={profile.full_name?.trim() || undefined}
              />
            )}

            <SingleUseLinksRow />

            {/* No slug nudge */}
            {!effectiveSlug && !createdUrl && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Set your meeting URL</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Add a username so your meeting link is shareable.</p>
                </div>
                <Link to="/dashboard/settings" className="shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors">
                  Go to Settings <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Types of Meetings section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Meetings</h2>
                <button
                  onClick={() => navigate('/dashboard/services?new=one_on_one')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-all shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  New Meeting Type
                </button>
              </div>

              {/* Search */}
              {services.length > 3 && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search event types..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  />
                </div>
              )}

              {loading ? (
                <div className="text-center py-12 text-gray-400 dark:text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : services.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-12 text-center">
                  <div className="h-14 w-14 bg-brand-50 dark:bg-brand-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CalendarDays className="h-7 w-7 text-brand-600 dark:text-brand-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">No meeting types yet</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                    Create your first meeting type and share the link so people can book time with you.
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/services?new=one_on_one')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    New Meeting Type
                  </button>
                </div>
              ) : (
                <>
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    SELECT EVENTS TO INCLUDE IN YOUR LINK
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Only checked events appear when someone visits your booking link.
                  </p>
                </div>
                <div className="space-y-2">
                  {services
                    .filter((s) => !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                    .map((svc) => {
                      const eventTypeUrl = bookingSlug
                        ? buildShareUrl(bookingSlug, [svc], new Set([svc.id]))
                        : null;
                      const meta = `${svc.duration_minutes} min · ${svc.price_cents ? `$${(svc.price_cents / 100).toFixed(2)}` : 'Free'} · ${(svc.location_type ?? 'video').replace('_', ' ')}`;
                      const isSelected = selectedServiceIds.has(svc.id);
                      return (
                        <div
                          key={svc.id}
                          className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-xl transition-colors group hover:border-gray-300 dark:hover:border-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleServiceSelection(svc.id)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 shrink-0 cursor-pointer"
                            aria-label={`Include ${svc.name} in booking link`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{svc.name}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{meta}</p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {eventTypeUrl && (
                              <button
                                type="button"
                                onClick={() => setServiceQrModal({ url: eventTypeUrl, title: svc.name })}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-300 dark:hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
                                title="QR code for this event type"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/dashboard/services?edit=${svc.id}`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 transition-colors text-white"
                              style={{ backgroundColor: '#5864C6' }}
                              title="Edit meeting type"
                            >
                              <PenLine className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                </>
              )}
            </div>

            {serviceQrModal && (
              <QRModal
                variant="booking"
                url={serviceQrModal.url}
                title={serviceQrModal.title}
                onClose={() => setServiceQrModal(null)}
              />
            )}
          </main>
        )}

        {!isActive('/dashboard') && <Outlet />}

        <footer className="mt-auto border-t border-gray-200 dark:border-slate-800 py-4 px-6 bg-white dark:bg-slate-950">
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
          isModal
          onClose={() => {
            setShowWizard(false);
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
    </div>
  );
}
