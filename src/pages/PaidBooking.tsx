import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { eventTypeSlug, isExamplePaidConsultation } from '../lib/eventTypes';
import {
  mergePaidBookingSuggestion,
  resolvePaidBookingSuggestion,
  isStoredPaidBookingCustomized,
  type PaidBookingDemoService,
} from '../lib/paidBookingSuggestions';
import type { Service, PaidBookingSettings } from '../lib/types';
import QRCode from 'qrcode';
import {
  Copy, Check, Loader2, ExternalLink, Image as ImageIcon, Palette,
  Save, AlertCircle, QrCode, Code, ChevronRight, ChevronLeft, X, Download,
  Link2, ShoppingBag, Mail, MessageSquare, Sparkles,
} from 'lucide-react';
import { ColorSwatchRow } from '../components/ColorSwatchRow';

type Theme = 'clean' | 'bold' | 'warm';
type WizardStep = 1 | 2 | 3;

interface ServiceWithMeta extends Service {
  category: string | null;
  banner_image_url: string | null;
}

interface ThemeDef {
  id: Theme;
  label: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  btnBg: string;
  btnText: string;
  previewBg: string;
}

const THEMES: ThemeDef[] = [
  {
    id: 'clean',
    label: 'Clean',
    bg: '#ffffff',
    surface: '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    muted: '#64748b',
    btnBg: '#5864C6',
    btnText: '#ffffff',
    previewBg: '#f1f5f9',
  },
  {
    id: 'bold',
    label: 'Bold',
    bg: '#141414',
    surface: '#1e1e1e',
    border: '#2a2a2a',
    text: '#f5f5f5',
    muted: '#a0a0a0',
    btnBg: '#ffffff',
    btnText: '#141414',
    previewBg: '#0a0a0a',
  },
  {
    id: 'warm',
    label: 'Warm',
    bg: '#fdf6ec',
    surface: '#fef9f3',
    border: '#e8d5bc',
    text: '#3b2a1a',
    muted: '#8a6a50',
    btnBg: '#5864C6',
    btnText: '#ffffff',
    previewBg: '#f5ebe0',
  },
];

const FALLBACK_DEMO: PaidBookingDemoService[] = [
  { id: '__demo_1', name: '15 Min Quick Call', duration_minutes: 15, price_cents: 0, color: '#5864C6', description: 'A quick intro call.', category: null, banner_image_url: null },
  { id: '__demo_2', name: '30 Min Consultation', duration_minutes: 30, price_cents: 5000, color: '#5864C6', description: 'Go deeper on your goals.', category: null, banner_image_url: null },
  { id: '__demo_3', name: '60 Min Session', duration_minutes: 60, price_cents: 10000, color: '#5864C6', description: 'Full session with clear next steps.', category: null, banner_image_url: null },
];

const BTN_LABELS = ['Book', 'Select', 'Reserve', 'Schedule'];

const STEPS: { n: WizardStep; label: string }[] = [
  { n: 1, label: 'What it is' },
  { n: 2, label: 'Customize' },
  { n: 3, label: 'Share' },
];

function getTheme(id: Theme): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

function ic(extra = '') {
  return `w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition text-sm ${extra}`;
}

function formatPrice(cents: number) {
  return cents > 0 ? `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}` : 'Free';
}

function CameraLogoSVG() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="20" cy="20" r="20" fill="#5864C6" />
      <path d="M14 16h2.5l1.5-2h4l1.5 2H26a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 26 28H14a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 14 16z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="20" cy="22" r="3" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

type PreviewSvc = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  description?: string | null;
  show_description_on_paid_booking?: boolean;
};

function PriceListPreview({
  theme,
  settings,
  services,
  usingExamples,
  slugHint,
  compact = false,
}: {
  theme: ThemeDef;
  settings: PaidBookingSettings;
  services: PreviewSvc[];
  usingExamples?: boolean;
  slugHint?: string;
  compact?: boolean;
}) {
  const btnColor = settings.btn_color || theme.btnBg;
  const btnLabel = settings.btn_label || 'Book';
  const pageBg = settings.bg_color || theme.bg;
  const displayName = settings.display_name?.trim() || 'Your business';
  const tagline = settings.tagline?.trim() || 'Book a time that works for you';
  const bio = settings.bio?.trim();
  const photoUrl = settings.business_photo_url;
  const list = (services.length > 0 ? services : FALLBACK_DEMO).slice(0, 3);

  return (
    <div className={`rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg ${compact ? '' : 'shadow-xl'}`}>
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-indigo-500" />
        <div className="flex-1 mx-2 px-2 py-0.5 bg-white dark:bg-slate-900 rounded text-[10px] text-slate-400 truncate font-mono">
          pinonit.com/{slugHint || 'your-page'}/services
        </div>
      </div>
      <div style={{ backgroundColor: pageBg }}>
        <div className="h-1 w-full" style={{ backgroundColor: btnColor }} />
        <div className={`space-y-4 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
          <div className="flex items-center gap-3">
            <div className={`${compact ? 'h-12 w-12' : 'h-14 w-14'} rounded-full overflow-hidden shrink-0 border-2`} style={{ borderColor: btnColor }}>
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <CameraLogoSVG />
              )}
            </div>
            <div className="min-w-0">
              <h3 className={`font-bold truncate ${compact ? 'text-base' : 'text-lg'}`} style={{ color: theme.text }}>
                {displayName}
              </h3>
              <p className="text-xs sm:text-sm truncate" style={{ color: theme.muted }}>{tagline}</p>
            </div>
          </div>
          {bio && !compact && (
            <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>{bio}</p>
          )}
          <div className="space-y-2.5">
            {list.map((svc) => (
              <div
                key={svc.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl"
                style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: theme.text }}>{svc.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: theme.muted }}>
                    {svc.duration_minutes} min
                    <span className="ml-1.5 font-semibold" style={{ color: svc.price_cents > 0 ? btnColor : theme.muted }}>
                      {formatPrice(svc.price_cents)}
                    </span>
                  </p>
                </div>
                <span
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: btnColor, color: theme.btnText }}
                >
                  {btnLabel}
                </span>
              </div>
            ))}
          </div>
          {usingExamples && (
            <p className="text-[11px] text-center" style={{ color: theme.muted }}>
              Example options — yours show here after you add paid event types
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function QRModal({ url, onClose }: { url: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, url, { width: 240, margin: 2 });
  }, [url]);

  const download = (format: 'png' | 'svg') => {
    if (format === 'png' && canvasRef.current) {
      const a = document.createElement('a');
      a.href = canvasRef.current.toDataURL('image/png');
      a.download = 'booking-qr.png';
      a.click();
    } else {
      void QRCode.toString(url, { type: 'svg' }).then((svg) => {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'booking-qr.svg';
        a.click();
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white">QR Code</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex justify-center"><canvas ref={canvasRef} className="rounded-xl" /></div>
          <div className="flex gap-2">
            <button type="button" onClick={() => download('png')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-white text-sm font-semibold rounded-xl" style={{ backgroundColor: '#5864C6' }}>
              <Download className="h-4 w-4" /> PNG
            </button>
            <button type="button" onClick={() => download('svg')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-sm font-semibold rounded-xl">
              <Download className="h-4 w-4" /> SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbedModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<iframe src="${url}/embed"\n  width="100%" height="600"\n  frameborder="0" style="border-radius:12px">\n</iframe>`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white">Embed on your website</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Paste into Wix, Squarespace, Webflow, or any HTML block.</p>
          <div className="relative">
            <pre className="p-4 bg-slate-900 rounded-xl text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre">{snippet}</pre>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-2 right-2 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildEmailInvite(bookingUrl: string, displayName: string, hostName?: string) {
  const name = displayName.trim() || 'me';
  const lines = ['Hi,', '', 'You can browse my services and book a time here:', '', bookingUrl, '', 'Thanks!'];
  if (hostName) lines.push(hostName);
  return { subject: `Book with ${name}`, body: lines.join('\n') };
}

function buildSmsInvite(bookingUrl: string, displayName: string, hostName?: string) {
  const name = displayName.trim() || 'me';
  return `Hi — book a time on my services page:\n${bookingUrl}\n— ${hostName || name}`;
}

function ShareRow({
  bookingUrl,
  accent,
  displayName,
  hostName,
  showToast,
  onShowQR,
  onShowEmbed,
  size = 'md',
}: {
  bookingUrl: string | null;
  accent: string;
  displayName: string;
  hostName?: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
  onShowQR: () => void;
  onShowEmbed: () => void;
  size?: 'md' | 'lg';
}) {
  const [copied, setCopied] = useState(false);
  const disabled = !bookingUrl;
  const pad = size === 'lg' ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-xs sm:text-sm';
  const base = `inline-flex items-center justify-center gap-2 ${pad} rounded-xl border font-semibold transition-all`;
  const idle = `${base} bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300`;
  const dim = disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-300';

  const copy = () => {
    if (!bookingUrl) return;
    void navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Link copied', 'success');
  };

  const email = () => {
    if (!bookingUrl) return;
    const { subject, body } = buildEmailInvite(bookingUrl, displayName, hostName);
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const sms = () => {
    if (!bookingUrl) return;
    window.location.href = `sms:?body=${encodeURIComponent(buildSmsInvite(bookingUrl, displayName, hostName))}`;
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} disabled={disabled} className={`${idle} ${dim}`} style={copied ? { backgroundColor: accent, color: '#fff', borderColor: 'transparent' } : {}}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button type="button" onClick={email} disabled={disabled} className={`${idle} ${dim}`}>
        <Mail className="h-4 w-4" /> Email
      </button>
      <button type="button" onClick={sms} disabled={disabled} className={`${idle} ${dim}`}>
        <MessageSquare className="h-4 w-4" /> SMS
      </button>
      <button type="button" onClick={onShowEmbed} disabled={disabled} className={`${idle} ${dim}`}>
        <Code className="h-4 w-4" /> Embed
      </button>
      <button type="button" onClick={onShowQR} disabled={disabled} className={`${idle} ${dim}`}>
        <QrCode className="h-4 w-4" /> QR
      </button>
      {bookingUrl && (
        <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className={idle}>
          <ExternalLink className="h-4 w-4" /> Preview
        </a>
      )}
    </div>
  );
}

function StepProgress({ step, onJump }: { step: WizardStep; onJump: (s: WizardStep) => void }) {
  return (
    <nav className="flex items-center justify-center gap-1 sm:gap-2" aria-label="Setup steps">
      {STEPS.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        return (
          <div key={s.n} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && <div className={`hidden sm:block w-8 h-px ${done || active ? 'bg-[#5864C6]' : 'bg-slate-200 dark:bg-slate-700'}`} />}
            <button
              type="button"
              onClick={() => onJump(s.n)}
              className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? 'bg-[#5864C6] text-white'
                  : done
                    ? 'bg-[#5864C6]/15 text-[#5864C6]'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] ${active ? 'bg-white/20' : ''}`}>
                {done && !active ? <Check className="h-3 w-3" /> : s.n}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export function PaidBookingPage() {
  const { user, profile, refreshProfile } = useAuth();

  const [step, setStep] = useState<WizardStep>(1);
  const [theme, setTheme] = useState<Theme>('clean');
  const [settings, setSettings] = useState<PaidBookingSettings>({});
  const [services, setServices] = useState<ServiceWithMeta[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const suggestion = useMemo(
    () =>
      resolvePaidBookingSuggestion({
        email: user?.email ?? profile?.email,
        businessType: profile?.business_type,
        fullName: profile?.full_name,
      }),
    [user?.email, profile?.email, profile?.business_type, profile?.full_name],
  );

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const set = useCallback(<K extends keyof PaidBookingSettings>(k: K, v: PaidBookingSettings[K]) => {
    setSettings((prev) => ({ ...prev, [k]: v }));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const t = ((profile as { paid_booking_theme?: Theme }).paid_booking_theme ?? 'clean') as Theme;
    setTheme(t);
    const s = ((profile as { paid_booking_settings?: PaidBookingSettings }).paid_booking_settings ?? {}) as PaidBookingSettings;
    const customized = isStoredPaidBookingCustomized(s as Record<string, unknown>);
    const base: PaidBookingSettings = {
      display_name: s.display_name || profile.full_name || '',
      tagline: s.tagline || profile.booking_page_header || '',
      bio: s.bio || profile.bio || '',
      btn_color: s.btn_color || profile.brand_color || '#5864C6',
      btn_label: s.btn_label || 'Book',
      layout: s.layout || 'list',
      show_descriptions: s.show_descriptions ?? true,
      business_photo_url: s.business_photo_url || profile.avatar_url || null,
      visible_service_ids: s.visible_service_ids ?? null,
    };
    if (!customized) {
      const merged = mergePaidBookingSuggestion(
        { display_name: base.display_name, tagline: base.tagline, bio: base.bio },
        suggestion,
      );
      setSettings({ ...base, ...merged });
    } else {
      setSettings(base);
    }
  }, [profile, suggestion]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from('services')
      .select('*')
      .eq('host_id', user.id)
      .eq('is_active', true)
      .order('created_at')
      .then(({ data }) => {
        setServices((data as ServiceWithMeta[]) ?? []);
        setLoadingServices(false);
      });
  }, [user]);

  const themeDef = getTheme(theme);
  const accent = settings.btn_color || themeDef.btnBg;
  const bookingUrl = profile?.slug ? `${window.location.origin}/${profile.slug}/services` : null;

  const realServices = useMemo(
    () => services.filter((s) => !isExamplePaidConsultation(s)),
    [services],
  );

  const visibleIds = settings.visible_service_ids;
  const menuServices = useMemo(() => {
    if (!visibleIds || visibleIds.length === 0) return realServices;
    const setIds = new Set(visibleIds);
    return realServices.filter((s) => setIds.has(s.id));
  }, [realServices, visibleIds]);

  const previewServices = useMemo(() => {
    if (menuServices.length > 0) return menuServices.slice(0, 6);
    return suggestion.demoServices.slice(0, 3);
  }, [menuServices, suggestion.demoServices]);

  const usingExamples = menuServices.length === 0;
  const paidCount = realServices.filter((s) => (s.price_cents ?? 0) > 0).length;

  const handleSave = async (andContinue = false) => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({
        paid_booking_theme: theme,
        paid_booking_settings: settings,
      })
      .eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    if (andContinue) setStep(3);
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be under 5MB', 'error');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Use JPG, PNG, or WebP', 'error');
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      set('business_photo_url', publicUrl);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      showToast('Photo updated', 'success');
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const toggleService = (id: string) => {
    const current = visibleIds && visibleIds.length > 0
      ? [...visibleIds]
      : realServices.map((s) => s.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    set('visible_service_ids', next.length === realServices.length ? null : next);
  };

  const applySuggestion = () => {
    const merged = mergePaidBookingSuggestion(
      { display_name: settings.display_name, tagline: settings.tagline, bio: settings.bio },
      suggestion,
      { onlyEmpty: false },
    );
    set('display_name', merged.display_name);
    set('tagline', merged.tagline);
    set('bio', merged.bio);
    showToast(`Applied ${suggestion.sourceLabel}`, 'success');
  };

  const serviceLink = (svc: ServiceWithMeta) =>
    profile?.slug
      ? `${window.location.origin}/${profile.slug}?types=${eventTypeSlug(svc)}`
      : null;

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-slate-50/80 dark:bg-slate-950">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#5864C620' }}>
                <ShoppingBag className="h-4 w-4" style={{ color: '#5864C6' }} />
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">Paid Booking</h1>
            </div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => void handleSave(false)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-semibold rounded-xl disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {saved ? 'Saved' : 'Save'}
              </button>
            )}
          </div>
          <StepProgress step={step} onJump={setStep} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* ─── STEP 1 ─── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                A nice price list clients can book from
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                One page with your main options and prices. Share it by link, email, text, or embed it on your website — like Calendly’s landing page, but with clear pricing up front.
              </p>
            </div>

            {loadingServices ? (
              <div className="h-72 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ) : (
              <PriceListPreview
                theme={themeDef}
                settings={settings}
                services={previewServices}
                usingExamples={usingExamples}
                slugHint={profile.slug || undefined}
              />
            )}

            {paidCount === 0 && !loadingServices && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Add a paid event type so clients can pay when they book.{' '}
                  <Link to="/dashboard/settings?tab=event-types" className="font-semibold underline">Open Event types</Link>
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Share this page</p>
              <ShareRow
                bookingUrl={bookingUrl}
                accent={accent}
                displayName={settings.display_name || profile.full_name || ''}
                hostName={profile.full_name?.trim() || undefined}
                showToast={showToast}
                onShowQR={() => setShowQR(true)}
                onShowEmbed={() => setShowEmbed(true)}
                size="lg"
              />
              {!bookingUrl && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Set a username in Settings to get your link
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-5 py-3 text-white font-semibold rounded-xl shadow-sm"
                style={{ backgroundColor: accent }}
              >
                Next: Customize
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 ─── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customize your page</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Logo, colors, and which options show on your price list.
              </p>
            </div>

            {suggestion.source !== 'default' && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-[#5864C6]" />
                <span>
                  Suggested from {suggestion.source === 'business_type' ? 'your business type' : 'your email domain'}:{' '}
                  <strong>{suggestion.sourceLabel}</strong>
                </span>
                <button type="button" onClick={applySuggestion} className="font-semibold text-[#5864C6] underline">
                  Use suggested text
                </button>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="relative shrink-0 w-20 h-20 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-800 hover:border-[#5864C6] transition-colors"
                    >
                      {settings.business_photo_url ? (
                        <img src={settings.business_photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-7 w-7 text-slate-300 m-auto" />
                      )}
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                    </button>
                    <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void handlePhoto(e)} />
                    <div className="flex-1 space-y-3 min-w-0">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Business name</label>
                        <input type="text" value={settings.display_name ?? ''} onChange={(e) => set('display_name', e.target.value)} className={ic()} placeholder="Your business" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Tagline</label>
                        <input type="text" value={settings.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} className={ic()} placeholder="One line about what you offer" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Short bio</label>
                    <textarea value={settings.bio ?? ''} onChange={(e) => set('bio', e.target.value)} rows={3} className={ic('resize-none')} placeholder="A few sentences clients will see…" />
                  </div>
                </section>

                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Palette className="h-4 w-4 text-slate-400" /> Colors & style
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`rounded-xl border-2 p-2 text-left transition-all ${
                          theme === t.id ? 'border-[#5864C6] shadow-sm' : 'border-slate-200 dark:border-slate-700'
                        }`}
                        style={{ backgroundColor: t.previewBg }}
                      >
                        <div className="h-6 rounded-md mb-1 border" style={{ backgroundColor: t.bg, borderColor: t.border }} />
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.label}</p>
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Brand / button color</label>
                    <ColorSwatchRow value={settings.btn_color || themeDef.btnBg} onChange={(v) => set('btn_color', v)} size="sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Button says</label>
                    <div className="flex flex-wrap gap-1.5">
                      {BTN_LABELS.map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => set('btn_label', lbl)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                            (settings.btn_label || 'Book') === lbl ? 'text-white border-transparent' : 'border-slate-200 dark:border-slate-700'
                          }`}
                          style={(settings.btn_label || 'Book') === lbl ? { backgroundColor: accent } : {}}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Options on your list</h3>
                    <Link to="/dashboard/settings?tab=event-types" className="text-xs font-semibold text-[#5864C6] underline">
                      Edit prices in Event types
                    </Link>
                  </div>
                  {loadingServices ? (
                    <p className="text-sm text-slate-400">Loading…</p>
                  ) : realServices.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No event types yet.{' '}
                      <Link to="/dashboard/settings?tab=event-types" className="font-semibold text-[#5864C6] underline">Create one</Link>
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {realServices.map((svc) => {
                        const checked = !visibleIds || visibleIds.length === 0 || visibleIds.includes(svc.id);
                        return (
                          <li key={svc.id}>
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleService(svc.id)}
                                className="h-4 w-4 rounded border-slate-300 text-[#5864C6] focus:ring-[#5864C6]"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{svc.name}</p>
                                <p className="text-xs text-slate-500">
                                  {svc.duration_minutes} min · {formatPrice(svc.price_cents ?? 0)}
                                </p>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                      {services.some((s) => isExamplePaidConsultation(s)) && (
                        <li className="px-3 py-2 text-xs text-slate-400">
                          Example “Paid Consultation” stays off this page until you create your own paid types.
                        </li>
                      )}
                    </ul>
                  )}
                </section>
              </div>

              <div className="lg:sticky lg:top-28">
                <p className="text-xs font-semibold text-slate-500 mb-2">Live preview</p>
                <PriceListPreview
                  theme={themeDef}
                  settings={settings}
                  services={previewServices}
                  usingExamples={usingExamples}
                  slugHint={profile.slug || undefined}
                  compact
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => void handleSave(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-3 text-white font-semibold rounded-xl disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save & continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3 ─── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white mx-auto" style={{ backgroundColor: accent }}>
                <Check className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">You’re ready to share</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Send the full menu, or a link to one option only.
              </p>
            </div>

            {saved && bookingUrl && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-white" style={{ backgroundColor: accent }}>
                <Check className="h-4 w-4 shrink-0" />
                Live at{' '}
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold truncate">
                  {bookingUrl}
                </a>
              </div>
            )}

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Your price list page</h3>
                {bookingUrl ? (
                  <p className="mt-1 text-sm font-mono text-slate-600 dark:text-slate-400 break-all flex items-start gap-2">
                    <Link2 className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                    {bookingUrl}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-amber-600">Set a username in Settings first.</p>
                )}
              </div>
              <ShareRow
                bookingUrl={bookingUrl}
                accent={accent}
                displayName={settings.display_name || profile.full_name || ''}
                hostName={profile.full_name?.trim() || undefined}
                showToast={showToast}
                onShowQR={() => setShowQR(true)}
                onShowEmbed={() => setShowEmbed(true)}
                size="lg"
              />
            </section>

            {menuServices.length > 0 && profile.slug && (
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Single-option booking links</h3>
                <p className="text-xs text-slate-500">For when you only want to offer one service in an email or SMS.</p>
                <ul className="space-y-2">
                  {menuServices.map((svc) => {
                    const url = serviceLink(svc);
                    return (
                      <li key={svc.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{svc.name}</p>
                          <p className="text-xs text-slate-500 truncate font-mono">{url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!url) return;
                            void navigator.clipboard.writeText(url);
                            showToast('Link copied', 'success');
                          }}
                          className="shrink-0 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                          title="Copy link"
                        >
                          <Copy className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400">
                <ChevronLeft className="h-4 w-4" /> Back to edit
              </button>
              <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold text-[#5864C6]">
                See what it looks like again
              </button>
            </div>
          </div>
        )}
      </div>

      {showQR && bookingUrl && <QRModal url={bookingUrl} onClose={() => setShowQR(false)} />}
      {showEmbed && bookingUrl && <EmbedModal url={bookingUrl} onClose={() => setShowEmbed(false)} />}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
          }`}
        >
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
