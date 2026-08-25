import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { effectivePlan } from '../lib/plan';
import { isExamplePaidConsultation } from '../lib/eventTypes';
import {
  mergePaidBookingSuggestion,
  PAID_BOOKING_QUICK_STARTS,
  resolvePaidBookingSuggestion,
  isStoredPaidBookingCustomized,
  type PaidBookingDemoService,
} from '../lib/paidBookingSuggestions';
import type { Service, PaidBookingSettings } from '../lib/types';
import QRCode from 'qrcode';
import {
  Copy, Check, Loader2, ExternalLink, Plus, Trash2,
  ChevronDown, Image as ImageIcon, Palette,
  LayoutGrid, List, Save, AlertCircle,
  QrCode, Code, ChevronRight, X, Download, Link2,
  Settings2, ShoppingBag, Mail, MessageSquare, Sparkles,
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

// ─── Demo content (fallback when no industry match) ───────────────────────────

const DEMO_DISPLAY_NAME = 'Smith Photography';
const DEMO_TAGLINE = 'Professional Headshots & Portrait Sessions';
const DEMO_BIO = 'Capturing your best professional image in a relaxed, modern studio environment. Book your session today.';
const FALLBACK_DEMO_SERVICES: PaidBookingDemoService[] = [
  { id: '__demo_1', name: '15 Min Quick Call', duration_minutes: 15, price_cents: 0, color: '#5864C6', description: 'A quick intro call to discuss your session needs.', category: null, banner_image_url: null },
  { id: '__demo_2', name: 'Headshot Session', duration_minutes: 30, price_cents: 10000, color: '#5864C6', description: 'Professional headshots for LinkedIn, websites, and press.', category: null, banner_image_url: null },
  { id: '__demo_3', name: 'Paid Consultation', duration_minutes: 60, price_cents: 5000, color: '#5864C6', description: 'In-depth consultation for custom packages.', category: null, banner_image_url: null },
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

// ─── Full-width live preview ──────────────────────────────────────────────────

function FullPreview({
  theme, settings, plan, liveServices, usingExamples,
}: {
  theme: ThemeDef;
  settings: PaidBookingSettings;
  plan: string;
  liveServices: Pick<ServiceWithMeta, 'id' | 'name' | 'duration_minutes' | 'price_cents' | 'color' | 'description' | 'category' | 'banner_image_url' | 'show_description_on_paid_booking'>[];
  usingExamples?: boolean;
}) {
  const btnColor = settings.btn_color || theme.btnBg;
  const btnLabel = settings.btn_label || 'Book';
  const isBold = theme.id === 'bold';
  const pageBg = settings.bg_color || theme.bg;
  const displayName = settings.display_name?.trim() || DEMO_DISPLAY_NAME;
  const tagline = settings.tagline?.trim() || DEMO_TAGLINE;
  const bio = settings.bio?.trim() || DEMO_BIO;
  const photoUrl = settings.business_photo_url;

  const previewServices = liveServices.length > 0 ? liveServices : FALLBACK_DEMO_SERVICES;
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
        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
        <div className="flex-1 mx-3 px-3 py-1 bg-white dark:bg-slate-900 rounded text-xs text-slate-400 truncate font-mono">
          pinonit.com/smith-photo
        </div>
      </div>

      <div style={{ backgroundColor: pageBg }}>
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: btnColor }} />

        <div className="p-6 space-y-5 max-h-[500px] overflow-y-auto">
          {/* Profile header */}
          <div className={`flex items-center gap-4 ${isBold ? 'pb-4 border-b' : ''}`}
            style={isBold ? { borderColor: theme.border } : {}}>
            <div className="h-16 w-16 rounded-full overflow-hidden shrink-0 border-2" style={{ borderColor: btnColor }}>
              {photoUrl
                ? <img src={photoUrl} alt="" width={64} height={64} loading="lazy" className="h-full w-full object-cover" />
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

          {usingExamples && (
            <p className="text-xs text-center pt-1" style={{ color: theme.muted, opacity: 0.85 }}>
              Example services for your industry — your paid event types appear here after you add them.
            </p>
          )}

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

// ─── Share helpers ────────────────────────────────────────────────────────────

function buildPaidBookingEmailInvite(bookingUrl: string, displayName: string, hostName?: string) {
  const name = displayName.trim() || 'me';
  const lines = [
    'Hi,',
    '',
    `You can browse my services and book a time here:`,
    '',
    bookingUrl,
    '',
    'Thanks!',
  ];
  if (hostName) lines.push(hostName);
  return {
    subject: `Book with ${name}`,
    body: lines.join('\n'),
  };
}

function buildPaidBookingSmsInvite(bookingUrl: string, displayName: string, hostName?: string) {
  const name = displayName.trim() || 'me';
  const lines = [
    `Hi — book a time on my services page:`,
    bookingUrl,
  ];
  if (hostName) lines.push(`— ${hostName}`);
  else lines.push(`— ${name}`);
  return lines.join('\n');
}

function PaidBookingShareActions({
  bookingUrl,
  copiedLink,
  onCopyLink,
  onShowQR,
  onShowEmbed,
  displayName,
  hostName,
  showToast,
  showPreview = false,
  className = '',
}: {
  bookingUrl: string | null;
  copiedLink: boolean;
  onCopyLink: () => void;
  onShowQR: () => void;
  onShowEmbed: () => void;
  displayName: string;
  hostName?: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
  showPreview?: boolean;
  className?: string;
}) {
  const [openMenu, setOpenMenu] = useState<'email' | 'text' | null>(null);
  const disabled = !bookingUrl;

  const closeMenu = () => setOpenMenu(null);
  const toggleMenu = (kind: 'email' | 'text') =>
    setOpenMenu((prev) => (prev === kind ? null : kind));

  const emailInvite = bookingUrl
    ? buildPaidBookingEmailInvite(bookingUrl, displayName, hostName)
    : null;
  const smsInvite = bookingUrl
    ? buildPaidBookingSmsInvite(bookingUrl, displayName, hostName)
    : null;

  const openEmailComposer = (provider: 'gmail' | 'outlook' | 'default') => {
    if (!emailInvite) return;
    const { subject, body } = emailInvite;

    if (provider === 'gmail') {
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        '_blank',
        'noopener,noreferrer',
      );
      closeMenu();
      showToast('Opened Gmail compose', 'success');
      return;
    }

    if (provider === 'outlook') {
      window.open(
        `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        '_blank',
        'noopener,noreferrer',
      );
      closeMenu();
      showToast('Opened Outlook compose', 'success');
      return;
    }

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    closeMenu();
  };

  const openSmsComposer = () => {
    if (!smsInvite) return;
    window.location.href = `sms:?body=${encodeURIComponent(smsInvite)}`;
    closeMenu();
    showToast('Opened Messages', 'success');
  };

  const openWhatsAppComposer = () => {
    if (!smsInvite) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(smsInvite)}`, '_blank', 'noopener,noreferrer');
    closeMenu();
    showToast('Opened WhatsApp', 'success');
  };

  const copyEmailInvite = async () => {
    if (!emailInvite) return;
    await navigator.clipboard.writeText(`Subject: ${emailInvite.subject}\n\n${emailInvite.body}`);
    closeMenu();
    showToast('Email message copied', 'success');
  };

  const copySmsInvite = async () => {
    if (!smsInvite) return;
    await navigator.clipboard.writeText(smsInvite);
    closeMenu();
    showToast('Text message copied', 'success');
  };

  const btnBase =
    'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600';
  const disabledCls = disabled ? 'opacity-40 cursor-not-allowed' : '';

  const menuCls =
    'absolute left-0 top-full mt-2 w-52 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5';
  const menuItemCls =
    'w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <button onClick={onCopyLink} disabled={disabled}
        className={`${btnBase} ${disabledCls} ${copiedLink ? 'border-transparent text-white' : ''}`}
        style={copiedLink ? { backgroundColor: '#5864C6' } : {}}>
        {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copiedLink ? 'Copied!' : 'Copy Link'}
      </button>
      <button onClick={onShowQR} disabled={disabled} className={`${btnBase} ${disabledCls}`}>
        <QrCode className="h-4 w-4" /> QR Code
      </button>
      <button onClick={onShowEmbed} disabled={disabled} className={`${btnBase} ${disabledCls}`}>
        <Code className="h-4 w-4" /> Embed HTML
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && toggleMenu('email')}
          disabled={disabled}
          className={`${btnBase} ${disabledCls}`}
          aria-expanded={openMenu === 'email'}
          aria-haspopup="menu"
        >
          <Mail className="h-4 w-4" /> Email
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === 'email' ? 'rotate-180' : ''}`} />
        </button>
        {openMenu === 'email' && (
          <div className={menuCls} role="menu">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Send email with
            </p>
            <button type="button" onClick={() => openEmailComposer('gmail')} className={menuItemCls}>Gmail</button>
            <button type="button" onClick={() => openEmailComposer('outlook')} className={menuItemCls}>Outlook</button>
            <button type="button" onClick={() => openEmailComposer('default')} className={menuItemCls}>Default email app</button>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button type="button" onClick={copyEmailInvite} className={`${menuItemCls} flex items-center gap-1.5`}>
              <Copy className="h-3.5 w-3.5" /> Copy email message
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && toggleMenu('text')}
          disabled={disabled}
          className={`${btnBase} ${disabledCls}`}
          aria-expanded={openMenu === 'text'}
          aria-haspopup="menu"
        >
          <MessageSquare className="h-4 w-4" /> SMS / WhatsApp
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === 'text' ? 'rotate-180' : ''}`} />
        </button>
        {openMenu === 'text' && (
          <div className={menuCls} role="menu">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Send text with
            </p>
            <button type="button" onClick={openSmsComposer} className={`${menuItemCls} flex items-center gap-1.5`}>
              <MessageSquare className="h-3.5 w-3.5" /> SMS
            </button>
            <button type="button" onClick={openWhatsAppComposer} className={`${menuItemCls} flex items-center gap-1.5`}>
              <MessageSquare className="h-3.5 w-3.5" style={{ color: '#25D366' }} /> WhatsApp
            </button>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button type="button" onClick={copySmsInvite} className={`${menuItemCls} flex items-center gap-1.5`}>
              <Copy className="h-3.5 w-3.5" /> Copy text message
            </button>
          </div>
        )}
      </div>

      {showPreview && bookingUrl && (
        <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className={btnBase}>
          <ExternalLink className="h-4 w-4" /> Preview Live
        </a>
      )}
      {showPreview && !bookingUrl && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 self-center">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Set a username in Settings to get your booking URL
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PaidBookingPage() {
  const { user, profile, subscription, refreshProfile } = useAuth();
  const plan = effectivePlan(subscription, profile);

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
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

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

  // Load profile settings (+ industry examples when page is still blank)
  useEffect(() => {
    if (!profile) return;
    const t = ((profile as any).paid_booking_theme ?? 'clean') as Theme;
    setTheme(t);
    const s = (profile as any).paid_booking_settings ?? {};
    const customized = isStoredPaidBookingCustomized(s);

    const base: PaidBookingSettings = {
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
    };

    if (!customized) {
      const merged = mergePaidBookingSuggestion(
        {
          display_name: base.display_name,
          tagline: base.tagline,
          bio: base.bio,
        },
        suggestion,
      );
      setSettings({ ...base, ...merged });
      setSuggestionApplied(merged.filled.length > 0);
    } else {
      setSettings(base);
      setSuggestionApplied(false);
    }
  }, [profile, suggestion]);

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

  const bookingUrl = profile?.slug ? `${window.location.origin}/${profile.slug}/services` : null;

  const copyLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleBusinessPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be under 5MB', 'error');
      e.target.value = '';
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please use JPG, PNG, or WebP', 'error');
      e.target.value = '';
      return;
    }

    setUploadingPhoto('business');
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      set('business_photo_url', publicUrl);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      showToast('Photo updated!', 'success');
    } catch {
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploadingPhoto(null);
      e.target.value = '';
    }
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

  const applyBizTemplate = (tpl: (typeof PAID_BOOKING_QUICK_STARTS)[number]) => {
    set('tagline', tpl.tagline);
    set('bio', tpl.bio);
    setSuggestionApplied(false);
  };

  const applyFullSuggestion = () => {
    const merged = mergePaidBookingSuggestion(
      {
        display_name: settings.display_name,
        tagline: settings.tagline,
        bio: settings.bio,
      },
      suggestion,
      { onlyEmpty: false },
    );
    set('display_name', merged.display_name);
    set('tagline', merged.tagline);
    set('bio', merged.bio);
    setSuggestionApplied(true);
    showToast(`Applied examples for ${suggestion.sourceLabel}`, 'success');
  };

  const accentColor = settings.btn_color || themeDef.btnBg;
  const paidServiceCount = services.filter((s) => (s.price_cents ?? 0) > 0 && !isExamplePaidConsultation(s)).length;
  const previewServices = useMemo(() => {
    const live = services.filter((s) => !isExamplePaidConsultation(s));
    return live.length > 0 ? live : suggestion.demoServices;
  }, [services, suggestion.demoServices]);
  const usingExampleServices = previewServices.every((s) => String(s.id).startsWith('__demo_'));

  if (!profile) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="w-full min-h-full bg-slate-50/80 dark:bg-slate-950">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#5864C620' }}>
                <ShoppingBag className="h-4 w-4" style={{ color: '#5864C6' }} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">Your booking page</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Edit on the left · preview updates live on the right</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <ExternalLink className="h-4 w-4" /> Preview live
              </a>
            )}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 disabled:opacity-60 text-white font-semibold rounded-xl transition-all shadow-sm text-sm"
              style={{ backgroundColor: accentColor }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? 'Saved!' : 'Save & publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {saved && bookingUrl && (
          <div className="mb-6 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-white" style={{ backgroundColor: accentColor }}>
            <Check className="h-4 w-4 shrink-0" />
            Live at <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold truncate">{bookingUrl}</a>
          </div>
        )}

        {(suggestionApplied || suggestion.source !== 'default') && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/20 text-sm text-indigo-950 dark:text-indigo-100">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
              <p>
                {suggestion.source === 'business_type' && (
                  <>Using examples for your <strong>{suggestion.sourceLabel}</strong> business from setup.</>
                )}
                {suggestion.source === 'email_domain' && (
                  <>Using examples based on your business email <strong>{suggestion.sourceLabel}</strong>.</>
                )}
                {suggestion.source === 'default' && suggestionApplied && (
                  <>We filled in starter text — edit anything below, then save.</>
                )}
                {' '}Change anything you like, then hit Save &amp; publish.
              </p>
            </div>
            <button type="button" onClick={applyFullSuggestion}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-300 dark:border-indigo-700 hover:bg-white/60 dark:hover:bg-slate-900/40 transition-colors">
              Reset to suggestion
            </button>
          </div>
        )}

        {paidServiceCount === 0 && !loadingServices && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Add at least one paid event type first — go to{' '}
              <a href="/dashboard/services" className="font-semibold underline">Event types</a>, set a price, and choose how you get paid.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          {/* ── Editor ── */}
          <div className="space-y-4 lg:space-y-5 order-2 lg:order-1">
            {/* 1. Your business */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">1. Your business</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">What clients see at the top of your page</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Quick start
                  {suggestion.source !== 'default' && (
                    <span className="ml-1.5 text-indigo-600 dark:text-indigo-400">
                      · matched {suggestion.source === 'business_type' ? suggestion.sourceLabel : suggestion.sourceLabel}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PAID_BOOKING_QUICK_STARTS.map((tpl) => (
                    <button key={tpl.id} type="button" onClick={() => applyBizTemplate(tpl)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        suggestion.quickStartId === tpl.id
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#5864C6] hover:text-[#5864C6]'
                      }`}
                      style={suggestion.quickStartId === tpl.id ? { backgroundColor: accentColor } : {}}>
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="relative group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800 hover:border-[#5864C6] transition-colors relative">
                      {photoUrl ? (
                        <img src={photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <ImageIcon className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                      )}
                      {uploadingPhoto === 'business' && (
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-center text-slate-400 mt-1.5">Add photo</p>
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBusinessPhotoUpload} />
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Business name</label>
                    <input type="text" value={settings.display_name ?? ''} onChange={(e) => set('display_name', e.target.value)} placeholder="Smith Photography" className={ic()} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tagline</label>
                    <input type="text" value={settings.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} placeholder="What you do in one line" className={ic()} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Short bio</label>
                <textarea value={settings.bio ?? ''} onChange={(e) => set('bio', e.target.value)} rows={3} placeholder="A few sentences about what you offer and who you help…" className={ic('resize-none')} />
              </div>
            </section>

            {/* 2. Colors & style */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="h-4 w-4 text-slate-400" /> 2. Colors & style
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pick a look, then set your brand color</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Page style</label>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTheme(t.id)}
                      className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                        theme === t.id
                          ? 'border-[#5864C6] shadow-md shadow-[#5864C6]/15'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                      style={{ backgroundColor: t.previewBg }}>
                      <div className="h-8 rounded-lg mb-1.5 border" style={{ backgroundColor: t.bg, borderColor: t.border }} />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight">{t.tagline}</p>
                    </button>
                  ))}
                </div>
              </div>

              <ColorField label="Brand / button color" value={settings.btn_color || themeDef.btnBg} onChange={(v) => set('btn_color', v)} />

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Book button says</label>
                <div className="flex flex-wrap gap-1.5">
                  {BTN_LABELS.map((lbl) => (
                    <button key={lbl} type="button" onClick={() => set('btn_label', lbl)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        (settings.btn_label || 'Book') === lbl
                          ? 'border-transparent text-white'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                      style={(settings.btn_label || 'Book') === lbl ? { backgroundColor: accentColor } : {}}>{lbl}</button>
                  ))}
                </div>
              </div>
            </section>

            {/* 3. More options (collapsed) */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <button type="button" onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center gap-2 px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <Settings2 className="h-4 w-4 text-slate-400" />
                3. More options
                <span className="text-xs font-normal text-slate-400 ml-1">layout, categories, images</span>
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="px-5 pb-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="pt-4">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Service layout</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['list', 'grid'] as const).map((layout) => (
                        <button key={layout} type="button" onClick={() => set('layout', layout)}
                          className={`flex items-center justify-center gap-2 py-2 rounded-xl border-2 transition-all text-sm font-medium ${
                            (settings.layout || 'list') === layout ? 'text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600'
                          }`}
                          style={(settings.layout || 'list') === layout ? { borderColor: accentColor, backgroundColor: accentColor } : {}}>
                          {layout === 'list' ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                          {layout === 'list' ? 'List' : 'Grid'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {[
                    { key: 'show_descriptions' as const, label: 'Show service descriptions' },
                    { key: 'show_images' as const, label: 'Show service photos', desc: 'Upload per service below' },
                    { key: 'use_categories' as const, label: 'Group into categories' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{item.label}</p>
                        {item.desc && <p className="text-xs text-slate-400">{item.desc}</p>}
                      </div>
                      <button type="button" onClick={() => set(item.key, !(settings[item.key] ?? (item.key === 'show_descriptions')))}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          (settings[item.key] ?? (item.key === 'show_descriptions')) ? '' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        style={(settings[item.key] ?? (item.key === 'show_descriptions')) ? { backgroundColor: accentColor } : {}}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${(settings[item.key] ?? (item.key === 'show_descriptions')) ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}

                  {settings.use_categories && (
                    <div className="space-y-2">
                      {(settings.categories ?? []).map((cat) => (
                        <div key={cat} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <span className="text-sm text-slate-700 dark:text-slate-300">{cat}</span>
                          <button type="button" onClick={() => set('categories', (settings.categories ?? []).filter((c) => c !== cat))}
                            className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                      {addingCategory ? (
                        <div className="flex gap-2">
                          <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCategory(false); setNewCategory(''); } }}
                            placeholder="e.g. Consultations" className={`${ic()} flex-1`} autoFocus />
                          <button type="button" onClick={addCategory} className="px-3 py-2 text-white text-xs font-semibold rounded-lg" style={{ backgroundColor: accentColor }}>Add</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setAddingCategory(true)} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: accentColor }}>
                          <Plus className="h-3.5 w-3.5" /> Add category
                        </button>
                      )}
                    </div>
                  )}

                  {settings.show_images && services.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service photos</p>
                      {services.map((svc) => (
                        <div key={svc.id} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: svc.color }} />
                          <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{svc.name}</p>
                          <label className="flex items-center gap-1 cursor-pointer px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                            {uploadingPhoto === svc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : svc.banner_image_url ? <img src={svc.banner_image_url} alt="" className="h-5 w-5 rounded object-cover" />
                              : <ImageIcon className="h-3.5 w-3.5 text-slate-400" />}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleServicePhotoUpload(e, svc.id)} disabled={uploadingPhoto === svc.id} />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {settings.use_categories && (settings.categories ?? []).length > 0 && services.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign categories</p>
                      {services.map((svc) => (
                        <div key={svc.id} className="flex items-center gap-2">
                          <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{svc.name}</p>
                          <select value={svc.category ?? ''} onChange={(e) => handleServiceCategory(svc.id, e.target.value)}
                            className="w-32 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                            <option value="">None</option>
                            {(settings.categories ?? []).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 4. Share */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">4. Share with clients</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Save first, then copy your link or send by email / text</p>
              </div>
              <PaidBookingShareActions
                bookingUrl={bookingUrl}
                copiedLink={copiedLink}
                onCopyLink={copyLink}
                onShowQR={() => setShowQR(true)}
                onShowEmbed={() => setShowEmbed(true)}
                displayName={settings.display_name || profile.full_name || ''}
                hostName={profile.full_name?.trim() || undefined}
                showToast={showToast}
                showPreview
              />
            </section>
          </div>

          {/* ── Live preview (sticky) ── */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-[4.5rem] space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-slate-400" /> Live preview
              </h2>
              <span className="text-xs text-slate-400">Updates as you type</span>
            </div>
            {loadingServices ? (
              <div className="h-96 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ) : (
              <FullPreview
                theme={themeDef}
                settings={settings}
                plan={plan}
                liveServices={previewServices}
                usingExamples={usingExampleServices}
              />
            )}
            {bookingUrl ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center px-2">
                Your page:{' '}
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: accentColor }}>
                  {bookingUrl.replace(/^https?:\/\//, '')}
                </a>
              </p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center flex items-center justify-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> Set a username in Settings for your booking URL
              </p>
            )}
          </div>
        </div>
      </div>

      {showQR && bookingUrl && <QRModal url={bookingUrl} onClose={() => setShowQR(false)} />}
      {showEmbed && bookingUrl && <EmbedModal url={bookingUrl} onClose={() => setShowEmbed(false)} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
