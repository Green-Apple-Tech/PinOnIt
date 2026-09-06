import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Mail, ClipboardSignature, ArrowRight,
  CalendarDays, ExternalLink, Users, ShoppingBag, Bell, Sparkles,
  ChevronDown, type LucideIcon,
} from 'lucide-react';

type ToolItem = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
  accent?: 'brand' | 'teal' | 'violet' | 'default';
  badge?: string;
  docsCombined?: boolean;
};

const MAIN_TOOLS: ToolItem[] = [
  {
    id: 'docs-hub',
    icon: ClipboardSignature,
    title: 'Send Docs + Sign-by-Text',
    description:
      'Quotes, invoices, NDAs, waivers, and PDF uploads. Turn on SMS verification & signature when you need it — no app for the recipient.',
    buttonLabel: 'Open Docs',
    to: '/dashboard/documents',
    accent: 'violet',
    docsCombined: true,
  },
  {
    id: 'calendar',
    icon: CalendarDays,
    title: 'Calendar',
    description: 'Your schedule, upcoming appointments, and meeting management. Synced with Google, Outlook, and Apple.',
    buttonLabel: 'Open Calendar',
    to: '/dashboard/appointments',
    accent: 'brand',
  },
  {
    id: 'booking',
    icon: ExternalLink,
    title: 'Booking',
    description: 'Your booking page, services, and sharing tools. Share one link everywhere and prevent double-bookings.',
    buttonLabel: 'Open Booking',
    to: '/dashboard/booking',
    accent: 'brand',
  },
  {
    id: 'reminders',
    icon: Bell,
    title: 'NeverMiss Reminders',
    description: 'Email, SMS, WhatsApp, and Voice reminders for every booking and calendar event so nobody misses a meeting.',
    buttonLabel: 'Open NeverMiss',
    to: '/dashboard/reminders',
    accent: 'teal',
  },
];

const OTHER_TOOLS: ToolItem[] = [
  {
    id: 'qr',
    icon: QrCode,
    title: 'QR Codes',
    description: 'QR codes for booking links — cards, flyers, signs.',
    buttonLabel: 'Open',
    to: '/dashboard/qr-code',
  },
  {
    id: 'signature',
    icon: Mail,
    title: 'Signature Creator',
    description: 'Email signature with your booking link built in.',
    buttonLabel: 'Open',
    to: '/dashboard/signature',
  },
  {
    id: 'paid',
    icon: ShoppingBag,
    title: 'Paid Booking',
    description: 'Collect payment at booking — Stripe, PayPal, Venmo, and more.',
    buttonLabel: 'Open',
    to: '/dashboard/paid-booking',
  },
  {
    id: 'group',
    icon: Users,
    title: 'Group Scheduling',
    description: 'Meeting polls and SMS coordination for groups.',
    buttonLabel: 'Open',
    to: '/dashboard/group-scheduling',
  },
];

function accentStyles(accent: ToolItem['accent']) {
  if (accent === 'brand') {
    return {
      border: 'border-brand-200 dark:border-brand-500/30',
      bg: 'bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900',
      icon: 'bg-brand-600 text-white',
      badge: 'text-brand-500',
      btn: 'bg-brand-600 hover:bg-brand-700',
    };
  }
  if (accent === 'teal') {
    return {
      border: 'border-teal-200 dark:border-teal-500/30',
      bg: 'bg-gradient-to-br from-teal-50 to-white dark:from-teal-900/20 dark:to-slate-900',
      icon: 'bg-teal-500 text-white',
      badge: 'text-teal-500',
      btn: 'bg-teal-600 hover:bg-teal-700',
    };
  }
  if (accent === 'violet') {
    return {
      border: 'border-violet-200 dark:border-violet-500/30',
      bg: 'bg-gradient-to-br from-violet-50 to-white dark:from-violet-900/20 dark:to-slate-900',
      icon: 'bg-violet-600 text-white',
      badge: 'text-violet-500',
      btn: 'bg-violet-600 hover:bg-violet-700',
    };
  }
  return {
    border: 'border-gray-200 dark:border-slate-800',
    bg: 'bg-white dark:bg-slate-900',
    icon: 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400',
    badge: 'text-gray-400',
    btn: 'bg-brand-600 hover:bg-brand-700',
  };
}

function ToolTitle({ tool, className = '' }: { tool: ToolItem; className?: string }) {
  if (tool.docsCombined) {
    return (
      <span className={className}>
        Send Docs + <span className="font-sign-by-text text-[1.15em] leading-none">Sign-by-Text</span>
      </span>
    );
  }
  return <span className={className}>{tool.title}</span>;
}

function MobileToolAccordion({ tools, defaultOpen }: { tools: ToolItem[]; defaultOpen?: string }) {
  const [openId, setOpenId] = useState<string | null>(defaultOpen ?? tools[0]?.id ?? null);

  return (
    <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {tools.map((tool) => {
        const open = openId === tool.id;
        const styles = accentStyles(tool.accent);
        const Icon = tool.icon;
        return (
          <div key={tool.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : tool.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              aria-expanded={open}
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                {tool.badge ? (
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${styles.badge}`}>{tool.badge}</p>
                ) : null}
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  <ToolTitle tool={tool} />
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? (
              <div className={`px-4 pb-4 border-t border-slate-100 dark:border-slate-800 ${styles.bg}`}>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-3">{tool.description}</p>
                <Link
                  to={tool.to}
                  className={`mt-3 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-white text-sm font-semibold rounded-xl transition-colors ${styles.btn}`}
                >
                  {tool.buttonLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FeaturedToolCard({ tool }: { tool: ToolItem }) {
  const styles = accentStyles(tool.accent);
  const Icon = tool.icon;
  return (
    <div className={`group flex flex-col rounded-3xl border-2 ${styles.border} ${styles.bg} p-6 md:p-8 shadow-sm hover:shadow-lg transition-all`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center ${styles.icon}`}>
          <Icon className="h-7 w-7 md:h-8 md:w-8" />
        </div>
        <div className="min-w-0">
          {tool.badge ? (
            <span className={`text-[11px] font-bold uppercase tracking-widest ${styles.badge}`}>{tool.badge}</span>
          ) : null}
          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
            <ToolTitle tool={tool} />
          </h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed flex-1">{tool.description}</p>
      <Link
        to={tool.to}
        className={`mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 text-white text-sm font-semibold rounded-xl transition-colors ${styles.btn}`}
      >
        {tool.buttonLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function CompactToolCard({ tool }: { tool: ToolItem }) {
  const Icon = tool.icon;
  return (
    <Link
      to={tool.to}
      className="group flex items-start gap-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-sm transition-all"
    >
      <div className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-brand-50 dark:group-hover:bg-brand-500/10 transition-colors">
        <Icon className="h-4 w-4 text-gray-600 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{tool.title}</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400 leading-snug line-clamp-2">{tool.description}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600 shrink-0 mt-1 group-hover:text-brand-500 transition-colors" />
    </Link>
  );
}

export function MoreToolsPage() {
  return (
    <main className="p-4 md:p-8 max-w-6xl w-full">
      <div className="mb-6 md:mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">All Tools</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              Everything included with your PinOnIt subscription.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8 md:mb-10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-3 md:mb-4">
          Main Tools
        </h2>
        <MobileToolAccordion tools={MAIN_TOOLS} defaultOpen="booking" />
        <div className="hidden md:grid gap-5 md:grid-cols-4">
          {MAIN_TOOLS.map((tool) => (
            <FeaturedToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-3 md:mb-4">
          More Tools
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {OTHER_TOOLS.map((tool) => (
            <CompactToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>

      <div className="mt-8 md:mt-10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-3 md:mb-4">
          Coming Soon
        </h2>
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 px-4 py-3.5 flex items-center gap-3 max-w-md">
          <Sparkles className="h-5 w-5 text-gray-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">AI Booking Assistant</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Coming soon</p>
          </div>
        </div>
      </div>
    </main>
  );
}
