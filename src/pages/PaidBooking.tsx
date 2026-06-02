import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Service, PaidBookingSettings } from '../lib/types';
import QRCode from 'qrcode';
import {
  Copy, Check, Loader2, ExternalLink, Plus, Trash2,
  ChevronDown, Image as ImageIcon, Palette,
  LayoutGrid, List, User, Save, AlertCircle,
  QrCode, Code, ChevronRight, X, Download, Link2,
  Settings2, ShoppingBag,
} from 'lucide-react';
import { ColorSwatchRow } from '../components/ColorSwatchRow';

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = 'clean' | 'bold' | 'warm';

interface ServiceWithMeta extends Service {
  category: string | null;
  banner_image_url: string | null;
}

// ─── Theme definitions ────────────────────────────────────────────────────────

interface ThemeDef {
  id: Theme;
  label: string;
  tagline: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  btnBg: string;
  btnText: string;
  accentBar: string;
  previewBg: string;
}

const THEMES: ThemeDef[] = [
  {
    id: 'clean',
    label: 'Clean',
    tagline: 'Minimal & professional',
    bg: '#ffffff',
    surface: '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    muted: '#64748b',
    btnBg: '#5864C6',
    btnText: '#ffffff',
    accentBar: '#5864C6',
    previewBg: '#f1f5f9',
  },
  {
    id: 'bold',
    label: 'Bold',
    tagline: 'Dark & dramatic',
    bg: '#141414',
    surface: '#1e1e1e',
    border: '#2a2a2a',
    text: '#f5f5f5',
    muted: '#a0a0a0',
    btnBg: '#ffffff',
    btnText: '#141414',
    accentBar: '#ffffff',
    previewBg: '#0a0a0a',
  },
  {
    id: 'warm',
    label: 'Warm',
    tagline: 'Soft & elegant',
    bg: '#fdf6ec',
    surface: '#fef9f3',
    border: '#e8d5bc',
    text: '#3b2a1a',
    muted: '#8a6a50',
    btnBg: '#5864C6',
    btnText: '#ffffff',
    accentBar: '#c0622a',
    previewBg: '#f5ebe0',
  },
];

// ─── Demo content for preview ─────────────────────────────────────────────────

const DEMO_DISPLAY_NAME = 'Smith Photography';
const DEMO_TAGLINE = 'Professional Headshots & Portrait Sessions';
const DEMO_BIO = 'Capturing your best professional image in a relaxed, modern studio environment. Book your session today.';
const DEMO_SERVICES: Pick<ServiceWithMeta, 'id' | 'name' | 'duration_minutes' | 'price_cents' | 'color' | 'description' | 'category' | 'banner_image_url'>[] = [
  { id: '__demo_1', name: '15 Min Quick Call', duration_minutes: 15, price_cents: 0, color: '#5864C6', description: 'A quick intro call to discuss your session needs.', category: null, banner_image_url: null },
  { id: '__demo_2', name: 'Headshot Session', duration_minutes: 30, price_cents: 10000, color: '#5864C6', description: 'Professional headshots for LinkedIn, websites, and press.', category: null, banner_image_url: null },
  { id: '__demo_3', name: 'Paid Service/Consultation', duration_minutes: 60, price_cents: 5000, color: '#5864C6', description: 'In-depth consultation for custom photography packages.', category: null, banner_image_url: null },
];

function CameraLogoSVG() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="20" cy="20" r="20" fill="#5864C6" />
      <path d="M14 16h2.5l1.5-2h4l1.5 2H26a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 26 28H14a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 14 16z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="20" cy="22" r="3" stroke="white" strokeWidth="1.5"/>
    </svg>
  );
}

function CameraLogoMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="12" cy="12" r="12" fill="#5864C6" />
      <path d="M7 9.5h1.5l1-1.5h5l1 1.5H19a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" stroke="white" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="13" cy="13" r="2" stroke="white" strokeWidth="1.2"/>
    </svg>
  );
}

function getTheme(id: Theme): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BTN_LABELS = ['Book', 'Select', 'Reserve', 'Schedule', 'Get started'];

function ic(extra = '') {
  return `w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition text-sm ${extra}`;
}

function formatPrice(cents: number) {
  return cents > 0 ? `$${(cents / 100).toFixed(2)}` : 'Free';
}

// ─── Mini theme card preview ──────────────────────────────────────────────────

function ThemeCardPreview({
  theme, settings, selected, onClick,
}: {
  theme: ThemeDef;
  settings: PaidBookingSettings;
  selected: boolean;
  onClick: () => void;
}) {
  const btnColor = theme.btnBg;
  const preview = DEMO_SERVICES.slice(0, 2);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden transition-all border-2 text-left w-full ${
        selected
          ? 'border-[#5864C6] shadow-lg shadow-[#5864C6]/20 scale-[1.02]'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:scale-[1.01]'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full flex items-center justify-center shadow" style={{ backgroundColor: '#5864C6' }}>
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {/* Theme label */}
      <div className="px-3 pt-3 pb-2" style={{ backgroundColor: theme.previewBg }}>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{theme.label}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">{theme.tagline}</p>
      </div>

      {/* Mini booking page */}
      <div className="p-2.5 space-y-2" style={{ backgroundColor: theme.bg }}>
        {/* Accent line */}
        <div className="h-0.5 w-full rounded-full" style={{ backgroundColor: theme.accentBar }} />

        {/* Profile row */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full overflow-hidden shrink-0">
            <CameraLogoMini />
          </div>
          <div>
            <p className="text-[10px] font-bold leading-tight" style={{ color: theme.text }}>
              {DEMO_DISPLAY_NAME}
            </p>
            <p className="text-[8px]" style={{ color: theme.muted }}>Headshots & Portraits</p>
          </div>
        </div>

        {/* Services */}
        <div className="space-y-1.5">
          {preview.map((svc) => (
            <div key={svc.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg"
              style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
              <div>
                <p className="text-[9px] font-semibold leading-tight" style={{ color: theme.text }}>{svc.name}</p>
                <p className="text-[8px]" style={{ color: theme.muted }}>{svc.duration_minutes} min · {formatPrice(svc.price_cents)}</p>
              </div>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: btnColor, color: theme.btnText }}>
                {settings.btn_label || 'Book'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─── Full-width live preview ──────────────────────────────────────────────────

function FullPreview({
  theme, settings, plan, liveServices,
}: {
  theme: ThemeDef;
  settings: PaidBookingSettings;
  plan: string;
  liveServices: Pick<ServiceWithMeta, 'id' | 'name' | 'duration_minutes' | 'price_cents' | 'color' | 'description' | 'category' | 'banner_image_url' | 'show_description_on_paid_booking'>[];
}) {
  const btnColor = settings.btn_color || theme.btnBg;
  const btnLabel = settings.btn_label || 'Book';
  const isBold = theme.id === 'bold';
  const displayName = settings.display_name?.trim() || DEMO_DISPLAY_NAME;
  const tagline = settings.tagline?.trim() || DEMO_TAGLINE;
  const bio = settings.bio?.trim() || DEMO_BIO;
  const photoUrl = settings.business_photo_url;

  const previewServices = liveServices.length > 0 ? liveServices : DEMO_SERVICES;
  const showDesc = settings.show_descriptions ?? true;

  const renderSvc = (svc: typeof previewServices[0]) => {
    const svcShowDesc = showDesc && ((svc as any).show_description_on_paid_booking ?? true);
    return (
    <div key={svc.id}
      className="flex items-start justify-between gap-3 p-3.5 rounded-xl"
      style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${isBold ? 'text-base' : 'text-sm'}`} style={{ color: theme.text }}>{svc.name}</p>
        <p className="text-xs mt-0.5" style={{ color: theme.muted }}>
          {svc.duration_minutes} min
          {svc.price_cents > 0
            ? <span className="ml-1.5 font-semibold" style={{ color: btnColor }}>{formatPrice(svc.price_cents)}</span>
            : <span className="ml-1.5" style={{ color: theme.muted }}>Free</span>
          }
        </p>
        {svcShowDesc && svc.description && <p className="text-xs mt-1 leading-relaxed" style={{ color: theme.muted }}>{svc.description}</p>}
      </div>
      <button style={{ backgroundColor: btnColor, color: theme.btnText }}
        className="shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap self-center transition-opacity hover:opacity-90">
        {btnLabel}
      </button>
    </div>
    );
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="flex-1 mx-3 px-3 py-1 bg-white dark:bg-slate-900 rounded text-xs text-slate-400 truncate font-mono">
          pinonit.com/smith-photo
        </div>
      </div>

      <div style={{ backgroundColor: theme.bg }}>
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: theme.accentBar }} />

        <div className="p-6 space-y-5 max-h-[500px] overflow-y-auto">
          {/* Profile header */}
          <div className={`flex items-center gap-4 ${isBold ? 'pb-4 border-b' : ''}`}
            style={isBold ? { borderColor: theme.border } : {}}>
            <div className="h-16 w-16 rounded-full overflow-hidden shrink-0 border-2" style={{ borderColor: btnColor }}>
              {photoUrl
                ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                : <CameraLogoSVG />
              }
            </div>
            <div>
              <h1 className={`font-bold ${isBold ? 'text-2xl' : 'text-xl'}`} style={{ color: theme.text }}>
                {displayName}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: theme.muted }}>{tagline}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>{bio}</p>

          {/* Service list */}
          <div className="space-y-3">{previewServices.map(renderSvc)}</div>

          {/* Powered by (free users) */}
          {plan === 'free' && (
            <div className="text-center pt-2">
              <span className="text-xs" style={{ color: theme.muted, opacity: 0.5 }}>Powered by PinOnIt</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── QR Code modal ────────────────────────────────────────────────────────────

function QRModal({ url, onClose }: { url: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 240, margin: 2 });
    }
  }, [url]);

  const download = (format: 'png' | 'svg') => {
    if (format === 'png' && canvasRef.current) {
      const a = document.createElement('a');
      a.href = canvasRef.current.toDataURL('image/png');
      a.download = 'booking-qr.png';
      a.click();
    } else {
      QRCode.toString(url, { type: 'svg' }).then((svg) => {
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
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex justify-center">
            <canvas ref={canvasRef} className="rounded-xl" />
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-mono break-all">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {url}
          </div>
          <div className="flex gap-2">
            <button onClick={() => download('png')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors hover:opacity-90"
              style={{ backgroundColor: '#5864C6' }}>
              <Download className="h-4 w-4" /> PNG
            </button>
            <button onClick={() => download('svg')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors">
              <Download className="h-4 w-4" /> SVG
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors">
              {copied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center leading-relaxed">
            Print this or add to your email signature so clients can scan and book instantly.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Embed modal ──────────────────────────────────────────────────────────────

function EmbedModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<iframe src="${url}/embed"\n  width="100%" height="600"\n  frameborder="0" style="border-radius:12px">\n</iframe>`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white">Embed on your website</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Paste this into any website builder — Wix, Squarespace, Webflow, or raw HTML.
          </p>
          <div className="relative">
            <pre className="p-4 bg-slate-900 dark:bg-black rounded-xl text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre">
{snippet}
            </pre>
            <button
              onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Works with:</p>
            {['Wix — Add HTML widget → paste code', 'Squarespace — Code block → paste code', 'Webflow — Embed element → paste code', 'WordPress — Custom HTML block → paste code'].map((tip) => (
              <p key={tip} className="flex items-start gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#5864C6]" />{tip}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Color picker field ───────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{label}</label>
      <ColorSwatchRow value={value} onChange={onChange} size="sm" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PaidBookingPage() {
  const { user, profile, subscription, refreshProfile } = useAuth();
  const plan = subscription?.plan ?? profile?.plan ?? 'free';

  const [theme, setTheme] = useState<Theme>('clean');
  const [settings, setSettings] = useState<PaidBookingSettings>({});
  const [services, setServices] = useState<ServiceWithMeta[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Load profile settings
  useEffect(() => {
    if (!profile) return;
    const t = ((profile as any).paid_booking_theme ?? 'clean') as Theme;
    setTheme(t);
    const s = (profile as any).paid_booking_settings ?? {};
    setSettings({
      display_name: s.display_name || profile.full_name || '',
      tagline: s.tagline || profile.booking_page_header || '',
      bio: s.bio || profile.bio || '',
      btn_color: s.btn_color || profile.brand_color || '#5864C6',
      btn_label: s.btn_label || 'Book',
      layout: s.layout || 'list',
      show_descriptions: s.show_descriptions ?? true,
      show_images: s.show_images ?? false,
      use_categories: s.use_categories ?? false,
      categories: s.categories ?? [],
      business_photo_url: s.business_photo_url || profile.avatar_url || null,
    });
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.from('services').select('*').eq('host_id', user.id).eq('is_active', true).order('created_at')
      .then(({ data }) => { setServices((data as ServiceWithMeta[]) ?? []); setLoadingServices(false); });
  }, [user]);

  const set = useCallback(<K extends keyof PaidBookingSettings>(k: K, v: PaidBookingSettings[K]) =>
    setSettings((prev) => ({ ...prev, [k]: v })), []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({
      paid_booking_theme: theme,
      paid_booking_settings: settings,
    }).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const bookingUrl = profile?.slug ? `${window.location.origin}/${profile.slug}` : null;

  const copyLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleBusinessPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto('business');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/paid-booking-photo.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      set('business_photo_url', data.publicUrl);
    }
    setUploadingPhoto(null);
    e.target.value = '';
  };

  const handleServicePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, svcId: string) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(svcId);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/service-${svcId}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('services').update({ banner_image_url: data.publicUrl }).eq('id', svcId);
      setServices((prev) => prev.map((s) => s.id === svcId ? { ...s, banner_image_url: data.publicUrl } : s));
    }
    setUploadingPhoto(null);
    e.target.value = '';
  };

  const handleServiceCategory = async (svcId: string, category: string) => {
    await supabase.from('services').update({ category: category || null }).eq('id', svcId);
    setServices((prev) => prev.map((s) => s.id === svcId ? { ...s, category: category || null } : s));
  };

  const addCategory = () => {
    const t = newCategory.trim();
    if (!t || (settings.categories ?? []).includes(t)) return;
    set('categories', [...(settings.categories ?? []), t]);
    setNewCategory('');
    setAddingCategory(false);
  };

  const themeDef = getTheme(theme);
  const photoUrl = settings.business_photo_url || null;

  if (!profile) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#5864C620' }}>
              <ShoppingBag className="h-4 w-4" style={{ color: '#5864C6' }} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paid Booking Page</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg">
            Create a beautiful service menu your clients can book from — share via link, QR code, or embed in your website.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 disabled:opacity-60 text-white font-semibold rounded-xl transition-all shadow-md text-sm shrink-0 self-start"
          style={{ backgroundColor: '#5864C6' }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save & Publish'}
        </button>
      </div>

      {/* ── Share action buttons ── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={copyLink} disabled={!bookingUrl}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            copiedLink
              ? 'border-transparent text-white'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
          } ${!bookingUrl ? 'opacity-40 cursor-not-allowed' : ''}`}
          style={copiedLink ? { backgroundColor: '#5864C6' } : {}}>
          {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiedLink ? 'Copied!' : 'Copy Link'}
        </button>
        <button onClick={() => setShowQR(true)} disabled={!bookingUrl}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 ${!bookingUrl ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <QrCode className="h-4 w-4" /> QR Code
        </button>
        <button onClick={() => setShowEmbed(true)} disabled={!bookingUrl}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 ${!bookingUrl ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Code className="h-4 w-4" /> Embed HTML
        </button>
        {bookingUrl && (
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all">
            <ExternalLink className="h-4 w-4" /> Preview Live
          </a>
        )}
        {!bookingUrl && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 self-center">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Set a username in Settings to get your booking URL
          </p>
        )}
      </div>

      {saved && bookingUrl && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-white" style={{ backgroundColor: '#5864C6' }}>
          <Check className="h-4 w-4 shrink-0" />
          Live at <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold">{bookingUrl}</a>
        </div>
      )}

      {/* ── Theme selector ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4 text-slate-400" /> Choose a theme
        </h2>
        {loadingServices ? (
          <div className="flex items-center gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="flex-1 h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {THEMES.map((t) => (
              <ThemeCardPreview
                key={t.id}
                theme={t}
                settings={settings}
                selected={theme === t.id}
                onClick={() => setTheme(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Full live preview ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-slate-400" /> Live preview
          <span className="ml-auto text-xs font-normal text-slate-400">Updates as you edit</span>
        </h2>
        <FullPreview
          theme={themeDef}
          settings={settings}
          plan={plan}
          liveServices={services}
        />
      </div>

      {/* ── Quick edit ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" /> Quick edit
        </h2>

        {/* Profile photo + name + tagline */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <div
              onClick={() => photoInputRef.current?.click()}
              className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-[#5864C6] transition-colors overflow-hidden relative group"
              style={photoUrl ? { backgroundImage: `url(${photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            >
              {!photoUrl && (uploadingPhoto === 'business' ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <ImageIcon className="h-5 w-5 text-slate-400" />)}
              {photoUrl && <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ImageIcon className="h-4 w-4 text-white" /></div>}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleBusinessPhotoUpload} />
            <p className="text-[10px] text-slate-400 text-center mt-1">Photo</p>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Business / display name</label>
              <input type="text" value={settings.display_name ?? ''} onChange={(e) => set('display_name', e.target.value)} placeholder="Your name or business name" className={ic()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Tagline</label>
              <input type="text" value={settings.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} placeholder="NYC Photographer & Art Director" className={ic()} />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Short bio</label>
          <textarea value={settings.bio ?? ''} onChange={(e) => set('bio', e.target.value)} rows={2} placeholder="A few sentences about what you do and who you help…" className={ic('resize-none')} />
        </div>

        {/* Button label */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Button label</label>
          <div className="flex flex-wrap gap-2">
            {BTN_LABELS.map((lbl) => (
              <button key={lbl} type="button" onClick={() => set('btn_label', lbl)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  (settings.btn_label || 'Book') === lbl
                    ? 'border-transparent text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
                style={(settings.btn_label || 'Book') === lbl ? { backgroundColor: '#5864C6' } : {}}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Advanced section */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <button type="button" onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors w-full">
            <Settings2 className="h-4 w-4" />
            Advanced customization
            <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-5">
              {/* Button color */}
              <ColorField label="Button color" value={settings.btn_color || themeDef.btnBg} onChange={(v) => set('btn_color', v)} />

              {/* Layout */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Layout</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['list', 'grid'] as const).map((layout) => (
                    <button key={layout} type="button" onClick={() => set('layout', layout)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                        (settings.layout || 'list') === layout
                          ? 'text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                      style={(settings.layout || 'list') === layout ? { borderColor: '#5864C6', backgroundColor: '#5864C6' } : {}}>
                      {layout === 'list' ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                      {layout === 'list' ? 'List' : 'Grid'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              {[
                { key: 'show_descriptions' as const, label: 'Show service descriptions' },
                { key: 'show_images' as const, label: 'Show service thumbnails', desc: 'Upload images per service below' },
                { key: 'use_categories' as const, label: 'Group services into categories' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{item.label}</p>
                    {item.desc && <p className="text-xs text-slate-400 dark:text-slate-500">{item.desc}</p>}
                  </div>
                  <button type="button" onClick={() => set(item.key, !(settings[item.key] ?? (item.key === 'show_descriptions')))  }
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      (settings[item.key] ?? (item.key === 'show_descriptions')) ? '' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    style={(settings[item.key] ?? (item.key === 'show_descriptions')) ? { backgroundColor: '#5864C6' } : {}}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${(settings[item.key] ?? (item.key === 'show_descriptions')) ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}

              {/* Categories */}
              {settings.use_categories && (
                <div className="space-y-3 pl-1">
                  {(settings.categories ?? []).map((cat) => (
                    <div key={cat} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{cat}</span>
                      <button type="button" onClick={() => set('categories', (settings.categories ?? []).filter((c) => c !== cat))}
                        className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {addingCategory ? (
                    <div className="flex gap-2">
                      <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCategory(false); setNewCategory(''); } }}
                        placeholder="e.g. Consultations" className={`${ic()} flex-1`} autoFocus />
                      <button type="button" onClick={addCategory} className="px-3 py-2 text-white text-xs font-semibold rounded-lg transition-colors hover:opacity-90" style={{ backgroundColor: '#5864C6' }}>Add</button>
                      <button type="button" onClick={() => { setAddingCategory(false); setNewCategory(''); }} className="px-3 py-2 text-slate-500 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAddingCategory(true)} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#5864C6' }}>
                      <Plus className="h-3.5 w-3.5" /> Add category
                    </button>
                  )}
                </div>
              )}

              {/* Service thumbnails */}
              {settings.show_images && services.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Service thumbnails</p>
                  {services.map((svc) => (
                    <div key={svc.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: svc.color }} />
                      <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{svc.name}</p>
                      <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 rounded-lg transition-colors">
                        {uploadingPhoto === svc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                          : svc.banner_image_url ? <img src={svc.banner_image_url} alt="" className="h-5 w-5 rounded object-cover" />
                          : <ImageIcon className="h-3.5 w-3.5 text-slate-400" />}
                        <span className="text-xs text-slate-500">{svc.banner_image_url ? 'Change' : 'Upload'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleServicePhotoUpload(e, svc.id)} disabled={uploadingPhoto === svc.id} />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Category assignment */}
              {settings.use_categories && (settings.categories ?? []).length > 0 && services.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Assign categories</p>
                  {services.map((svc) => (
                    <div key={svc.id} className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: svc.color }} />
                      <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate min-w-0">{svc.name}</p>
                      <select value={svc.category ?? ''} onChange={(e) => handleServiceCategory(svc.id, e.target.value)}
                        className="w-36 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#5864C6]">
                        <option value="">— None —</option>
                        {(settings.categories ?? []).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom share bar ── */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button onClick={copyLink} disabled={!bookingUrl}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            copiedLink ? 'border-transparent text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
          } ${!bookingUrl ? 'opacity-40 cursor-not-allowed' : ''}`}
          style={copiedLink ? { backgroundColor: '#5864C6' } : {}}>
          {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiedLink ? 'Copied!' : 'Copy Link'}
        </button>
        <button onClick={() => setShowQR(true)} disabled={!bookingUrl}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all ${!bookingUrl ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <QrCode className="h-4 w-4" /> QR Code
        </button>
        <button onClick={() => setShowEmbed(true)} disabled={!bookingUrl}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all ${!bookingUrl ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Code className="h-4 w-4" /> Embed HTML
        </button>
      </div>

      {/* ── Modals ── */}
      {showQR && bookingUrl && <QRModal url={bookingUrl} onClose={() => setShowQR(false)} />}
      {showEmbed && bookingUrl && <EmbedModal url={bookingUrl} onClose={() => setShowEmbed(false)} />}
    </div>
  );
}
