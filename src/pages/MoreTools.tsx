import { useState } from 'react';
import { Link } from 'react-router-dom';
import { documentsNewPath } from '../lib/documentActions';
import {
  QrCode, Mail, ClipboardSignature, ArrowRight, FileText,
  CalendarDays, Users, ShoppingBag, Bell, Sparkles,
  ChevronDown, type LucideIcon,
} from 'lucide-react';

type ToolItem = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
  accent?: 'brand' | 'teal' | 'default';
  badge?: string;
};

const MAIN_TOOLS: ToolItem[] = [
  {
    id: 'scheduler',
    icon: CalendarDays,
    title: 'Calendar Scheduler',
    badge: 'Tool 1',
    description: 'Your booking page, event types, and calendar sync — Google, Outlook, and Apple. Prevent double-bookings, accept payments, and share one link everywhere.',
    buttonLabel: 'Open Scheduler',
    to: '/dashboard/appointments',
    accent: 'brand',
  },
  {
    id: 'reminders',
    icon: Bell,
    title: 'Smart Reminders',
    badge: 'Tool 2',
    description: 'Email, SMS, WhatsApp, and Voice reminders for every booking and any calendar event. Make sure nobody misses a meeting.',
    buttonLabel: 'Open Smart Reminders',
    to: '/dashboard/reminders',
    accent: 'teal',
  },
];

const INCLUDED_TOOLS: ToolItem[] = [
  {
    id: 'sign-by-text',
    icon: ClipboardSignature,
    title: 'Sign-by-Text',
    description: 'Send NDAs, waivers, addendums, and simple agreements by text. Recipients verify with an SMS code and sign on their phone — no app required.',
    buttonLabel: 'Open Sign-by-Text',
    to: documentsNewPath('sign'),
  },
  {
    id: 'send-docs',
    icon: FileText,
    title: 'Send Docs',
    description: 'Quotes, invoices, receipts, and everyday documents — same Doc Center, send-without-signature flow.',
    buttonLabel: 'Open Send Docs',
    to: documentsNewPath('send'),
  },
  {
    id: 'documents',
    icon: ClipboardSignature,
    title: 'All documents',
    description: 'See every send — pending, viewed, and confirmed — in one list.',
    buttonLabel: 'Open document list',
    to: '/dashboard/documents',
  },
  {
    id: 'qr',
    icon: QrCode,
    title: 'QR Code Creator',
    description: 'Generate QR codes for your booking links to share anywhere — business cards, flyers, signs, or storefronts.',
    buttonLabel: 'Open QR Creator',
    to: '/dashboard/qr-code',
  },
  {
    id: 'signature',
    icon: Mail,
    title: 'Email Signature',
    description: 'Create a professional email signature with your booking link built in. Every email you send becomes a booking opportunity.',
    buttonLabel: 'Open Signature Builder',
    to: '/dashboard/signature',
  },
  {
    id: 'paid',
    icon: ShoppingBag,
    title: 'Paid Bookings',
    description: 'Accept payments at booking time — Stripe, PayPal, Venmo, Cash App, or Zelle.',
    buttonLabel: 'Open Paid Bookings',
    to: '/dashboard/paid-booking',
  },
  {
    id: 'group',
    icon: Users,
    title: 'Group Scheduling',
    description: 'Run meeting polls, coordinate via SMS with phone-only invitees, and find a time that works for everyone.',
    buttonLabel: 'Open Group Scheduling',
    to: '/dashboard/group-scheduling',
  },
  {
    id: 'appointments',
    icon: CalendarDays,
    title: 'Appointments',
    description: 'See your full calendar of upcoming, past, and pending bookings. Cancel or reschedule with one tap.',
    buttonLabel: 'Open Calendar',
    to: '/dashboard/appointments',
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
  return {
    border: 'border-gray-200 dark:border-slate-800',
    bg: 'bg-white dark:bg-slate-900',
    icon: 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400',
    badge: 'text-gray-400',
    btn: 'bg-brand-600 hover:bg-brand-700',
  };
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
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{tool.title}</p>
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
    <div className={`group flex flex-col rounded-3xl border-2 ${styles.border} ${styles.bg} p-8 shadow-sm hover:shadow-lg transition-all`}>
      <div className="flex items-center gap-4 mb-5">
        <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${styles.icon}`}>
          <Icon className="h-8 w-8" />
        </div>
        <div>
          {tool.badge ? (
            <span className={`text-[11px] font-bold uppercase tracking-widest ${styles.badge}`}>{tool.badge}</span>
          ) : null}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tool.title}</h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed flex-1">{tool.description}</p>
      <Link
        to={tool.to}
        className={`mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 text-white text-sm font-semibold rounded-xl transition-colors ${styles.btn}`}
      >
        {tool.buttonLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ComingSoonCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof QrCode;
  title: string;
  description: string;
}) {
  return (
    <div className="group flex flex-col rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 p-8">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-6">
        <Icon className="h-8 w-8 text-gray-400 dark:text-slate-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-500 dark:text-slate-400">{title}</h2>
      <p className="mt-2.5 text-sm text-gray-400 dark:text-slate-500 leading-relaxed flex-1">{description}</p>
      <span className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 text-sm font-semibold rounded-xl cursor-not-allowed">
        Coming Soon
      </span>
    </div>
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

      <div className="mb-6 md:mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-3 md:mb-4">
          Main Tools
        </h2>
        <MobileToolAccordion tools={MAIN_TOOLS} defaultOpen="scheduler" />
        <div className="hidden md:grid gap-6 md:grid-cols-2">
          {MAIN_TOOLS.map((tool) => (
            <FeaturedToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-3 md:mb-4">
          Included Tools
        </h2>
        <MobileToolAccordion tools={INCLUDED_TOOLS} />
        <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {INCLUDED_TOOLS.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>

      <div className="mt-8 md:mt-10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-3 md:mb-4">
          Coming Soon
        </h2>
        <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ComingSoonCard
            icon={Sparkles}
            title="AI Booking Assistant"
            description="Let AI draft your event descriptions, reminder messages, and follow-up notes in seconds."
          />
        </div>
        <div className="md:hidden rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 px-4 py-3.5 flex items-center gap-3">
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

function ToolCard({ tool }: { tool: ToolItem }) {
  const Icon = tool.icon;
  return (
    <div className="group flex flex-col rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="h-16 w-16 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-8 w-8 text-brand-600 dark:text-brand-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tool.title}</h2>
      <p className="mt-2.5 text-sm text-gray-600 dark:text-slate-400 leading-relaxed flex-1">{tool.description}</p>
      <Link
        to={tool.to}
        className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {tool.buttonLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
