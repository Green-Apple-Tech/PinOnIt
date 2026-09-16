import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Service } from '../lib/types';
import {
  Copy,
  ExternalLink,
  CalendarDays,
  Clock,
  Plus,
  Settings as SettingsIcon,
  QrCode,
  ArrowRight,
  Loader2,
  Repeat,
  Phone,
} from 'lucide-react';
import { formatRecurrenceBadge } from '../lib/recurring';
import { HostProxyBookingModal } from '../components/HostProxyBookingModal';
import { RecurringJobsPanel } from './StandingJobs';
import { QRModal } from '../components/QRModal';

function BookingLinkQrThumb({ url, onOpen }: { url: string; onOpen: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, url, {
      width: 96,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch(() => {});
  }, [url]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1.5 hover:border-brand-300 dark:hover:border-brand-500/40 transition-colors"
      aria-label="Open booking page QR code"
    >
      <canvas ref={canvasRef} className="block h-20 w-20" />
    </button>
  );
}

export function BookingPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'recurring' ? 'recurring' : 'page';
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showProxyBook, setShowProxyBook] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('host_id', profile.id)
        .order('created_at');
      setServices((data as Service[]) ?? []);
      setLoading(false);
    })();
  }, [profile]);

  if (!profile) return null;

  const bookingUrl = profile.slug
    ? `https://pinonit.com/${profile.slug}`
    : 'https://pinonit.com/your-name';

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setTab = (next: 'recurring' | 'page') => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (next === 'recurring') nextParams.set('tab', 'recurring');
      else nextParams.delete('tab');
      return nextParams;
    }, { replace: true });
  };

  return (
    <main className="flex-1 p-4 md:p-8 max-w-4xl w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Booking</h1>
      </div>

      <div className="flex gap-1 p-1 mb-6 rounded-xl bg-slate-100 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setTab('page')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold ${
            tab === 'page'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Booking page
        </button>
        <button
          type="button"
          onClick={() => setTab('recurring')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold ${
            tab === 'recurring'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Recurring jobs
        </button>
      </div>

      {tab === 'recurring' && <RecurringJobsPanel />}

      {tab === 'page' && (
        <>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            Your booking page, services, and sharing tools.
          </p>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center shrink-0">
                <ExternalLink className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Your booking page</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  Send this link to clients so they can book a time on your calendar.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <span className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate">{bookingUrl}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyLink}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {copied ? <span className="text-green-600">Copied!</span> : <><Copy className="h-4 w-4" /> Copy</>}
                    </button>
                    <a
                      href={bookingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" /> View
                    </a>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    to="/dashboard/settings?tab=event-types&new=one_on_one"
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/40 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Add new Booking Type
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowQr(true)}
                    disabled={!profile.slug}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/40 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <QrCode className="h-4 w-4" /> QR code
                  </button>
                </div>
                {!profile.slug && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Set up your custom link in{' '}
                    <Link to="/dashboard/settings?tab=profile" className="font-semibold underline">Settings → Profile</Link>.
                  </p>
                )}
              </div>
              {profile.slug && (
                <BookingLinkQrThumb url={bookingUrl} onOpen={() => setShowQr(true)} />
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowProxyBook(true)}
            className="w-full text-left flex items-start gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 mb-6 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-sm transition-all"
          >
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Phone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Book for someone</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Use this when you already know the time they want. Book it here and we send it to them — they&apos;re on the calendar and they get reminders.
              </p>
            </div>
          </button>

          <div className="mb-6">
            <Link
              to="/dashboard/settings?tab=availability"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Set your Availability
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setTab('recurring')}
            className="w-full text-left flex items-start gap-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/20 p-5 md:p-6 mb-6 hover:border-indigo-300 dark:hover:border-indigo-600/60 hover:shadow-sm transition-all"
          >
            <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Repeat className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Let customers book repeating visits</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                On Recurring jobs, turn this on for a booking type and pick weekly, every 2 weeks, monthly, or custom. They opt in when they book — you confirm the series.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                Set up repeating visits <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </button>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your services</h2>
              <Link
                to="/dashboard/settings?tab=event-types"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
              >
                <SettingsIcon className="h-3.5 w-3.5" /> Manage
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  No booking types yet. Add one so clients can book you.
                </p>
                <Link
                  to="/dashboard/settings?tab=event-types&new=one_on_one"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add new Booking Type
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{svc.name}</p>
                        {svc.is_recurring && svc.recurrence_frequency && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50">
                            <Repeat className="h-3 w-3" />
                            {formatRecurrenceBadge(svc.recurrence_frequency, svc.recurrence_interval_days)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {svc.duration_minutes} min{svc.price_cents ? ` · $${(svc.price_cents / 100).toFixed(2)}` : ''}
                      </p>
                    </div>
                    <Link
                      to="/dashboard/appointments"
                      className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline shrink-0"
                    >
                      View calendar <ArrowRight className="inline h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900 p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Calendar</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                  See upcoming appointments, add meetings, and manage your schedule.
                </p>
                <Link
                  to="/dashboard/appointments"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"
                >
                  Open Calendar <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {showProxyBook && (
        <HostProxyBookingModal
          onClose={() => setShowProxyBook(false)}
          onSaved={() => setShowProxyBook(false)}
        />
      )}

      {showQr && profile.slug && (
        <QRModal
          url={bookingUrl}
          title={`${profile.slug}'s booking page`}
          variant="booking"
          onClose={() => setShowQr(false)}
        />
      )}
    </main>
  );
}
