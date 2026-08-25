import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Booking, Service } from '../lib/types';
import {
  TrendingUp, CalendarDays, Users, Clock, Check,
  ArrowUp, ArrowDown, Minus, BarChart2,
} from 'lucide-react';

type Period = '7d' | '30d' | '90d' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
};

function getPeriodStart(period: Period): Date | null {
  if (period === 'all') return null;
  const d = new Date();
  const days = parseInt(period);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({
  label, value, sub, icon: Icon, color, delta,
}: {
  label: string; value: string | number; sub?: string;
  icon: typeof TrendingUp; color: string; delta?: number;
}) {
  return (
    <div className="p-5 bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl">
      <div className="flex items-start justify-between mb-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${delta > 0 ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : delta < 0 ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
            {delta > 0 ? <ArrowUp className="h-3 w-3" /> : delta < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</p>
      <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniBarChart({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="p-5 bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl">
      <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">{label}</p>
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div
              className="w-full bg-brand-500 dark:bg-brand-400 rounded-t transition-all hover:bg-brand-600 dark:hover:bg-brand-300 relative"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
              title={`${d.date}: ${d.count}`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-gray-400 dark:text-slate-500">
        <span>{data[0]?.date ?? ''}</span>
        <span>{data[data.length - 1]?.date ?? ''}</span>
      </div>
    </div>
  );
}

export function AnalyticsPage({ embedded }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    Promise.all([
      supabase.from('bookings').select('*, services(name, color, duration_minutes)').eq('host_id', profile.id).order('start_time', { ascending: true }),
      supabase.from('services').select('*').eq('host_id', profile.id),
    ]).then(([{ data: b }, { data: s }]) => {
      setBookings((b ?? []) as Booking[]);
      setServices((s ?? []) as Service[]);
      setLoading(false);
    });
  }, [profile]);

  const periodStart = getPeriodStart(period);

  const inPeriod = (b: Booking) => !periodStart || new Date(b.start_time) >= periodStart;

  const filtered = bookings.filter(inPeriod);
  const confirmed = filtered.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const canceled = filtered.filter((b) => b.status === 'canceled');
  const completed = filtered.filter((b) => b.status === 'completed');
  const noShow = filtered.filter((b) => b.status === 'no_show');

  const totalMinutes = confirmed.reduce((sum, b) => {
    const start = new Date(b.start_time);
    const end = new Date(b.end_time);
    return sum + (end.getTime() - start.getTime()) / 60000;
  }, 0);

  const completionRate = confirmed.length > 0 ? Math.round((completed.length / confirmed.length) * 100) : 0;
  const cancelRate = filtered.length > 0 ? Math.round((canceled.length / filtered.length) * 100) : 0;

  // Bookings by day chart
  const chartDays = period === 'all' ? 30 : parseInt(period);
  const chartData: { date: string; count: number }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = confirmed.filter((b) => b.start_time.slice(0, 10) === dateStr).length;
    chartData.push({ date: formatDate(d.toISOString()), count });
  }

  // By service
  const byService = services.map((svc) => {
    const svcBookings = confirmed.filter((b) => b.service_id === svc.id);
    return { svc, count: svcBookings.length };
  }).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);

  // Unique guests
  const uniqueGuests = new Set(confirmed.map((b) => b.guest_email)).size;

  // Avg per week
  const weeks = period === 'all' ? Math.max(1, Math.ceil(bookings.length > 0 ? (new Date().getTime() - new Date(bookings[0]?.start_time ?? new Date()).getTime()) / (7 * 86400000) : 1)) : parseInt(period) / 7;
  const avgPerWeek = weeks > 0 ? (confirmed.length / weeks).toFixed(1) : '0';

  const Wrapper = embedded ? 'div' : 'main';
  const wrapperClass = embedded ? 'w-full' : 'flex-1 p-6 md:p-8 max-w-4xl w-full';

  return (
    <Wrapper className={wrapperClass}>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Track your booking activity and performance.</p>
          </div>
        )}
        <div className={`flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm ${embedded ? '' : ''}`}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5 bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Meetings booked"
              value={confirmed.length}
              sub={`${avgPerWeek}/week avg`}
              icon={CalendarDays}
              color="bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400"
            />
            <StatCard
              label="Unique guests"
              value={uniqueGuests}
              icon={Users}
              color="bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400"
            />
            <StatCard
              label="Hours scheduled"
              value={totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${Math.round(totalMinutes)}m`}
              icon={Clock}
              color="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
            />
            <StatCard
              label="Completion rate"
              value={`${completionRate}%`}
              sub={`${cancelRate}% canceled`}
              icon={Check}
              color="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
            />
          </div>

          {/* Chart */}
          {period !== 'all' && (
            <div className="mb-6">
              <MiniBarChart data={chartData} label={`Bookings — ${PERIOD_LABELS[period]}`} />
            </div>
          )}

          {/* By status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Confirmed', value: confirmed.length, color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10' },
              { label: 'Completed', value: completed.length, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' },
              { label: 'Canceled', value: canceled.length, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10' },
              { label: 'No-show', value: noShow.length, color: 'text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800' },
            ].map((s) => (
              <div key={s.label} className={`flex items-center justify-between px-4 py-3 rounded-xl ${s.color}`}>
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="text-xl font-bold">{s.value}</span>
              </div>
            ))}
          </div>

          {/* By event type */}
          {byService.length > 0 ? (
            <div className="bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 mb-6">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Bookings by event type</p>
              <div className="space-y-3">
                {byService.map(({ svc, count }) => {
                  const maxCount = byService[0].count;
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={svc.id} className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: svc.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">{svc.name}</p>
                          <span className="text-sm font-bold text-gray-900 dark:text-white ml-2 shrink-0">{count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: svc.color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            !loading && confirmed.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 bg-brand-50 dark:bg-brand-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BarChart2 className="h-7 w-7 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">No bookings to chart yet</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs mb-4">Share your booking link. After 10 meetings, Analytics also appears in your sidebar.</p>
                <Link to="/dashboard#share" className="inline-flex text-sm font-semibold text-brand-600 hover:underline">Share your link →</Link>
              </div>
            )
          )}

          {/* Recent bookings table */}
          {confirmed.length > 0 && (
            <div className="bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Recent meetings</p>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
                {[...confirmed].reverse().slice(0, 10).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: (b.services as any)?.color ?? '#1a56db' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{b.guest_name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{(b.services as any)?.name ?? 'Meeting'}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-gray-500 dark:text-slate-400">{new Date(b.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      <span className={`text-xs font-medium ${b.status === 'completed' ? 'text-indigo-600 dark:text-indigo-400' : 'text-brand-600 dark:text-brand-400'}`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Wrapper>
  );
}
