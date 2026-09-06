import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle,
  ClipboardSignature,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  QrCode,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { documentsNewPath } from '../lib/documentActions';
import { documentTypeLabel } from '../lib/documents';
import type { SmbDocument } from '../lib/types';

type ReminderRow = {
  id: string;
  title: string | null;
  due_at: string;
};

export type DashboardBookingGlance = {
  id: string;
  status: string;
  start_time: string;
  guest_name: string | null;
  guest_email?: string | null;
};

type Props = {
  hostId: string;
  bookings: DashboardBookingGlance[];
  onOpenWizard?: () => void;
  showWizardButton?: boolean;
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatShort(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

type DashTool = {
  to: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  accent: string;
  docsCombined?: boolean;
};

const PRIMARY_TOOLS: DashTool[] = [
  {
    to: '/dashboard/documents',
    title: 'Send Docs + Sign-by-Text',
    blurb: 'Quotes, invoices, NDAs, waivers — verify & sign by SMS when you need it.',
    icon: ClipboardSignature,
    accent: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    docsCombined: true,
  },
  {
    to: '/dashboard/appointments',
    title: 'Calendar',
    blurb: 'Your schedule, upcoming meetings, and availability.',
    icon: CalendarDays,
    accent: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  },
  {
    to: '/dashboard/booking',
    title: 'Booking',
    blurb: 'Your booking page, services, and sharing tools.',
    icon: ExternalLink,
    accent: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  },
  {
    to: '/dashboard/reminders',
    title: 'NeverMiss Reminders',
    blurb: 'Email, SMS, and voice so nobody misses a meeting.',
    icon: Bell,
    accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
];

const OTHER_TOOLS: DashTool[] = [
  {
    to: '/dashboard/group-scheduling',
    title: 'Group Scheduling',
    blurb: 'Meeting polls & SMS coordination.',
    icon: Users,
    accent: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    to: '/dashboard/paid-booking',
    title: 'Paid Booking',
    blurb: 'Collect payment at booking.',
    icon: ShoppingBag,
    accent: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    to: '/dashboard/qr-code',
    title: 'QR Codes',
    blurb: 'Codes for cards, flyers, signs.',
    icon: QrCode,
    accent: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    to: '/dashboard/signature',
    title: 'Signature Creator',
    blurb: 'Email signature with booking link.',
    icon: Mail,
    accent: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
  },
];

export function DashboardHome({ hostId, bookings, onOpenWizard, showWizardButton }: Props) {
  const [docs, setDocs] = useState<SmbDocument[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingExtras(true);
      const nowIso = new Date().toISOString();
      const [docsRes, remRes] = await Promise.all([
        supabase
          .from('documents')
          .select('*')
          .eq('sender_id', hostId)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('personal_reminders')
          .select('id, title, due_at')
          .eq('host_id', hostId)
          .eq('status', 'active')
          .gte('due_at', nowIso)
          .order('due_at', { ascending: true })
          .limit(5),
      ]);
      if (cancelled) return;
      setDocs((docsRes.data as SmbDocument[]) ?? []);
      setReminders((remRes.data as ReminderRow[]) ?? []);
      setLoadingExtras(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hostId]);

  const now = Date.now();
  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'confirmed' && new Date(b.start_time).getTime() >= now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5),
    [bookings, now],
  );

  const waitingSignature = useMemo(
    () => docs.filter((d) => d.status === 'pending' || d.status === 'viewed').slice(0, 5),
    [docs],
  );
  const recentlySigned = useMemo(
    () =>
      docs
        .filter((d) => d.status === 'signed' && d.signed_at)
        .sort((a, b) => new Date(b.signed_at!).getTime() - new Date(a.signed_at!).getTime())
        .slice(0, 5),
    [docs],
  );
  const recentSent = useMemo(() => docs.slice(0, 5), [docs]);

  const summary = {
    upcoming: upcomingBookings.length,
    waiting: docs.filter((d) => d.status === 'pending' || d.status === 'viewed').length,
    signed: docs.filter((d) => d.status === 'signed').length,
    sent: docs.length,
  };

  return (
    <main className="flex-1 p-4 md:p-8 max-w-5xl w-full">
      <div className="mb-5 md:mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            What’s happening across booking, docs, and reminders.
          </p>
        </div>
        {showWizardButton && onOpenWizard && (
          <button
            type="button"
            onClick={onOpenWizard}
            className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Run setup wizard"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Wizard Setup</span>
          </button>
        )}
      </div>

      {/* All tools: 3 primary large, others compact */}
      <div className="mb-6 md:mb-8 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {PRIMARY_TOOLS.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.to}
                to={tile.to}
                className="group rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 min-h-[7.5rem] shadow-sm hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-md transition-all flex flex-col"
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${tile.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {tile.docsCombined ? (
                    <>
                      Send Docs +{' '}
                      <span className="font-sign-by-text text-xl text-violet-700 dark:text-violet-300">
                        Sign-by-Text
                      </span>
                    </>
                  ) : (
                    tile.title
                  )}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 flex-1">{tile.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 group-hover:gap-1.5 transition-all">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {OTHER_TOOLS.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.to}
                to={tile.to}
                className="group flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-sm transition-all"
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${tile.accent}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-snug">
                    {tile.title}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate leading-snug">
                    {tile.blurb}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick usage summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Upcoming bookings', value: summary.upcoming },
          { label: 'Waiting on signature', value: summary.waiting },
          { label: 'Signed / confirmed', value: summary.signed },
          { label: 'Docs sent (recent)', value: summary.sent },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"
          >
            <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {loadingExtras && s.label !== 'Upcoming bookings' ? '—' : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-5">
        <GlanceCard
          title="Upcoming bookings"
          icon={CalendarDays}
          empty="No upcoming bookings."
          linkTo="/dashboard/appointments"
          linkLabel="Open Calendar"
          rows={upcomingBookings.map((b) => ({
            id: b.id,
            primary: b.guest_name || b.guest_email || 'Guest',
            secondary: formatWhen(b.start_time),
          }))}
        />

        <GlanceCard
          title="Waiting for signature"
          icon={Clock}
          empty="Nothing waiting — nice."
          linkTo={documentsNewPath()}
          linkLabel="Open docs"
          rows={waitingSignature.map((d) => ({
            id: d.id,
            primary: d.recipient_name,
            secondary: `${documentTypeLabel(d.document_type, d.document_type_custom)} · ${d.status} · ${formatShort(d.created_at)}`,
          }))}
        />

        <GlanceCard
          title="Recent documents sent"
          icon={FileText}
          empty="No documents sent yet."
          linkTo="/dashboard/documents"
          linkLabel="Doc list"
          rows={recentSent.map((d) => ({
            id: d.id,
            primary: d.recipient_name,
            secondary: `${documentTypeLabel(d.document_type, d.document_type_custom)} · ${formatShort(d.created_at)}`,
          }))}
        />

        <GlanceCard
          title="Recently signed"
          icon={CheckCircle}
          empty="No signed documents yet."
          linkTo="/dashboard/documents"
          linkLabel="View all"
          rows={recentlySigned.map((d) => ({
            id: d.id,
            primary: d.recipient_name,
            secondary: `${documentTypeLabel(d.document_type, d.document_type_custom)} · ${formatShort(d.signed_at!)}`,
          }))}
        />

        <GlanceCard
          title="Upcoming reminders"
          icon={Bell}
          empty="No upcoming personal reminders."
          linkTo="/dashboard/reminders"
          linkLabel="NeverMiss Reminders"
          rows={reminders.map((r) => ({
            id: r.id,
            primary: r.title?.trim() || 'Reminder',
            secondary: r.due_at ? formatWhen(r.due_at) : '—',
          }))}
        />

        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2">PinOnIt at a glance</h2>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
            <li>
              <span className="font-semibold text-gray-800 dark:text-slate-100">BOOK IT</span> — client scheduling
            </li>
            <li>
              <span className="font-sign-by-text text-lg text-brand-700 dark:text-brand-300">Sign-by-Text</span>
              <span className="ml-1">— verify &amp; sign by SMS</span>
            </li>
            <li>
              <span className="font-semibold text-gray-800 dark:text-slate-100">SEND IT</span> — quotes, invoices, docs
            </li>
            <li>
              <span className="font-semibold text-gray-800 dark:text-slate-100">REMIND IT</span> — NeverMiss reminders
            </li>
          </ul>
          <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">
            Share your booking link anytime from Booking or Settings.
          </p>
        </div>
      </div>
    </main>
  );
}

function GlanceCard({
  title,
  icon: Icon,
  rows,
  empty,
  linkTo,
  linkLabel,
  linkClassName,
}: {
  title: string;
  icon: typeof Clock;
  rows: { id: string; primary: string; secondary: string }[];
  empty: string;
  linkTo: string;
  linkLabel: string;
  linkClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 flex flex-col min-h-[12rem]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h2>
        </div>
        <Link
          to={linkTo}
          className={`text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline shrink-0 ${linkClassName ?? ''}`}
        >
          {linkLabel}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 flex-1">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-800 flex-1">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5 first:pt-0 last:pb-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{row.primary}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{row.secondary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
