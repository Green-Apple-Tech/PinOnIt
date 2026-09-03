import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Share2,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export function BookingPage() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  return (
    <main className="flex-1 p-4 md:p-8 max-w-4xl w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Booking</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your booking page, services, and sharing tools.
        </p>
      </div>

      {/* Booking link card */}
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
            {!profile.slug && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Set up your custom link in{' '}
                <Link to="/dashboard/settings?tab=profile" className="font-semibold underline">Settings → Profile</Link>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link
          to="/dashboard/settings?tab=event-types"
          className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-sm transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
            <Plus className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 text-center">Add Service</span>
        </Link>
        <Link
          to="/dashboard/settings?tab=availability"
          className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-sm transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 text-center">Availability</span>
        </Link>
        <Link
          to="/dashboard/qr-code"
          className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-sm transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center">
            <QrCode className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 text-center">QR Code</span>
        </Link>
        <Link
          to="/dashboard/signature"
          className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-sm transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 text-center">Add to Signature</span>
        </Link>
      </div>

      {/* Services list */}
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
              No services yet. Add one so clients can book you.
            </p>
            <Link
              to="/dashboard/settings?tab=event-types"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"
            >
              <Plus className="h-4 w-4" /> Add your first service
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
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{svc.name}</p>
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

      {/* Calendar link */}
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
    </main>
  );
}
