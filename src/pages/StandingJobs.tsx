import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Loader2, Plus, Repeat, Search, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { FrequencyPicker } from '../components/FrequencyPicker';
import { HostProxyBookingModal } from '../components/HostProxyBookingModal';
import { QuestionLead } from '../components/QuestionLead';
import { supabase } from '../lib/supabase';
import {
  formatStandingFrequency,
  nextStandingVisit,
  standingComposePath,
  type StandingFrequency,
  type StandingJob,
  type StandingJobStatus,
} from '../lib/standingJobs';
import type { Service } from '../lib/types';

type VisitRow = { id: string; start_time: string; status: string; standing_job_id: string | null };

const STATUS_RANK: Record<StandingJobStatus, number> = {
  pending_host_confirmation: 0,
  active: 1,
  paused: 2,
  ended: 3,
  declined: 4,
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusLabel(status: StandingJobStatus) {
  if (status === 'pending_host_confirmation') return 'Needs confirmation';
  if (status === 'declined') return 'Won’t repeat';
  if (status === 'paused') return 'Paused';
  if (status === 'ended') return 'Ended';
  return '';
}

async function notifyGuestRecurringDeclined(bookingId: string | null, guestName: string | null) {
  if (!bookingId) return;
  const { data: { session } } = await supabase.auth.getSession();
  const name = guestName?.trim() || 'there';
  const message =
    `Hi ${name}, your first visit is confirmed, but this won’t repeat automatically. ` +
    `We’ll be in touch if you want to book again.`;
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        notify_recurring_declined: true,
        booking_id: bookingId,
        message,
      }),
    });
  } catch {
    /* best-effort */
  }
}

export function StandingJobsPage() {
  return <Navigate to="/dashboard/booking?tab=recurring" replace />;
}

export function RecurringJobsPanel() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<StandingJob[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<StandingJob | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [jobRes, svcRes, visRes] = await Promise.all([
      supabase
        .from('standing_jobs')
        .select('*, services(name, duration_minutes)')
        .eq('host_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase.from('services').select('*').eq('host_id', profile.id).eq('is_active', true).order('name'),
      supabase
        .from('bookings')
        .select('id, start_time, status, standing_job_id')
        .eq('host_id', profile.id)
        .not('standing_job_id', 'is', null)
        .gte('start_time', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('start_time'),
    ]);
    setJobs((jobRes.data as StandingJob[]) ?? []);
    setServices((svcRes.data as Service[]) ?? []);
    setVisits((visRes.data as VisitRow[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = !q
      ? jobs
      : jobs.filter((j) =>
        [j.customer_name, j.customer_phone, j.customer_email, j.services?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    return [...rows].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
  }, [jobs, query]);

  const visitsFor = (id: string) => visits.filter((v) => v.standing_job_id === id);

  const confirmJob = async (job: StandingJob) => {
    setBusyId(job.id);
    setError('');
    const { error: err } = await supabase.rpc('confirm_standing_job', { p_job_id: job.id });
    setBusyId(null);
    if (err) {
      setError(err.message || 'Could not confirm this job.');
      return;
    }
    void load();
  };

  const declineJob = async (job: StandingJob) => {
    setBusyId(job.id);
    setError('');
    const { data, error: err } = await supabase.rpc('decline_standing_job', { p_job_id: job.id });
    if (err) {
      setBusyId(null);
      setError(err.message || 'Could not decline this job.');
      return;
    }
    const row = data as { booking_id?: string | null; guest_name?: string | null } | null;
    await notifyGuestRecurringDeclined(row?.booking_id ?? job.first_booking_id ?? null, row?.guest_name ?? job.customer_name);
    setBusyId(null);
    setDetail(null);
    void load();
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <QuestionLead
          lead="Book someone once, or make it repeat"
          body="Book for someone is the same form as on your Booking page. Add their first visit, then check This repeats if they come weekly or on Tuesday and Thursday."
          secondary="When a customer asks to repeat from your public link, confirm or decline the extra visits here."
        />
        <button
          type="button"
          onClick={() => { setShowForm(true); setError(''); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl shrink-0"
        >
          <Plus className="h-4 w-4" /> Book someone
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by customer"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
          {jobs.length === 0
            ? 'No recurring jobs yet. Book someone and check This repeats, or wait for a customer to ask from your booking link.'
            : 'No customers match that search.'}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold hidden sm:table-cell">Service</th>
                <th className="px-4 py-3 font-semibold">Frequency</th>
                <th className="px-4 py-3 font-semibold">Next visit</th>
                <th className="px-4 py-3 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const next = nextStandingVisit(visitsFor(job.id));
                const pending = job.status === 'pending_host_confirmation';
                return (
                  <tr
                    key={job.id}
                    className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    onClick={() => setDetail(job)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{job.customer_name}</p>
                      <p className="text-xs text-slate-400">{job.customer_phone || job.customer_email || ''}</p>
                      {job.origin === 'guest' && (
                        <p className="mt-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Requested by customer</p>
                      )}
                      {pending && (
                        <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={busyId === job.id}
                            onClick={() => void confirmJob(job)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={busyId === job.id}
                            onClick={() => void declineJob(job)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-600 dark:text-slate-300">
                      {job.services?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                        <Repeat className="h-3 w-3" />
                        {formatStandingFrequency(job.frequency, job.interval_days, job.weekdays, job.month_nth)}
                      </span>
                      {job.status !== 'active' && (
                        <span className="ml-1 text-[11px] text-slate-400">{statusLabel(job.status)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {pending ? 'Waiting on you' : next ? when(next.start_time) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{money(job.price_cents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <HostProxyBookingModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}

      {detail && (
        <StandingJobDetail
          job={detail}
          visits={visitsFor(detail.id)}
          services={services}
          busy={busyId === detail.id}
          onClose={() => setDetail(null)}
          onChanged={() => { setDetail(null); void load(); }}
          onConfirm={() => void confirmJob(detail)}
          onDecline={() => void declineJob(detail)}
        />
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}


function StandingJobDetail({
  job,
  visits,
  services,
  busy,
  onClose,
  onChanged,
  onConfirm,
  onDecline,
}: {
  job: StandingJob;
  visits: VisitRow[];
  services: Service[];
  busy: boolean;
  onClose: () => void;
  onChanged: () => void;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  const [forwardOpen, setForwardOpen] = useState(false);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fromTime, setFromTime] = useState('09:00');
  const [frequency, setFrequency] = useState<StandingFrequency>(job.frequency);
  const [intervalDays, setIntervalDays] = useState(job.interval_days ?? 10);
  const [weekdays, setWeekdays] = useState<number[]>(() => job.weekdays?.length ? job.weekdays : [new Date(job.starts_at).getDay()]);
  const [monthNth, setMonthNth] = useState<number | null>(job.month_nth ?? null);
  const [localBusy, setLocalBusy] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleWhen, setRescheduleWhen] = useState('');
  const upcoming = visits.filter((v) => v.status === 'confirmed').slice(0, 8);
  const pending = job.status === 'pending_host_confirmation';

  const skip = async (id: string) => {
    setLocalBusy(true);
    await supabase.from('bookings').update({ status: 'skipped' }).eq('id', id);
    setLocalBusy(false);
    onChanged();
  };

  const pause = async (status: 'paused' | 'ended' | 'active') => {
    setLocalBusy(true);
    await supabase.from('standing_jobs').update({ status, updated_at: new Date().toISOString() }).eq('id', job.id);
    setLocalBusy(false);
    onChanged();
  };

  const changeForward = async () => {
    setLocalBusy(true);
    await supabase.rpc('standing_job_change_forward', {
      p_job_id: job.id,
      p_from: new Date(`${fromDate}T${fromTime}:00`).toISOString(),
      p_starts_at: new Date(`${fromDate}T${fromTime}:00`).toISOString(),
      p_frequency: frequency,
      p_interval_days: frequency === 'custom' ? intervalDays : null,
      p_weekdays:
        frequency === 'weekly' || frequency === 'biweekly' || (frequency === 'monthly' && monthNth != null)
          ? weekdays
          : null,
      p_month_nth: frequency === 'monthly' ? monthNth : null,
    });
    setLocalBusy(false);
    onChanged();
  };

  const saveReschedule = async () => {
    if (!rescheduleId || !rescheduleWhen) return;
    const start = new Date(rescheduleWhen);
    const end = new Date(start.getTime() + job.duration_minutes * 60000);
    setLocalBusy(true);
    await supabase.from('bookings').update({ start_time: start.toISOString(), end_time: end.toISOString() }).eq('id', rescheduleId);
    setLocalBusy(false);
    setRescheduleId(null);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">{job.customer_name}</h2>
            <p className="text-sm text-slate-500">{job.services?.name || 'Recurring job'} · {formatStandingFrequency(job.frequency, job.interval_days, job.weekdays, job.month_nth)}</p>
            {job.origin === 'guest' && (
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">Requested by customer</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        {pending && (
          <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-3">
            <p className="text-sm text-amber-900 dark:text-amber-200 mb-3">
              First visit is already booked. Confirm to add the rest of the series, or decline to keep only that first visit.
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={onConfirm} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold">
                Confirm series
              </button>
              <button type="button" disabled={busy} onClick={onDecline} className="px-3 py-2 rounded-xl border text-xs font-semibold">
                Decline — keep first visit only
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-4">
          <Link to={standingComposePath('quote', { name: job.customer_name, phone: job.customer_phone, email: job.customer_email })}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold">
            Quote <ArrowRight className="h-3 w-3" />
          </Link>
          <Link to={standingComposePath('receipt', { name: job.customer_name, phone: job.customer_phone, email: job.customer_email })}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            Receipt
          </Link>
          {!pending && job.status !== 'declined' && (
            job.status === 'active' ? (
              <button type="button" disabled={localBusy} onClick={() => void pause('paused')} className="px-3 py-2 rounded-xl border text-xs font-semibold">Pause</button>
            ) : (
              <button type="button" disabled={localBusy} onClick={() => void pause('active')} className="px-3 py-2 rounded-xl border text-xs font-semibold">Resume</button>
            )
          )}
          {!pending && job.status !== 'declined' && job.status !== 'ended' && (
            <button type="button" disabled={localBusy} onClick={() => void pause('ended')} className="px-3 py-2 rounded-xl border text-xs font-semibold text-red-600">End series</button>
          )}
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Upcoming visits</h3>
        <ul className="space-y-2 mb-4">
          {upcoming.length === 0 && <li className="text-sm text-slate-400">{pending ? 'Only the first visit is on the calendar until you confirm.' : 'None on the calendar yet.'}</li>}
          {upcoming.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{when(v.start_time)}</span>
              <span className="flex gap-2">
                <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => { setRescheduleId(v.id); setRescheduleWhen(v.start_time.slice(0, 16)); }}>Reschedule</button>
                <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => void skip(v.id)}>Skip</button>
              </span>
            </li>
          ))}
        </ul>
        {rescheduleId && (
          <div className="mb-4 flex gap-2">
            <input type="datetime-local" value={rescheduleWhen} onChange={(e) => setRescheduleWhen(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border text-sm" />
            <button type="button" onClick={() => void saveReschedule()} className="px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold">Save</button>
          </div>
        )}
        {job.status === 'active' && (
          <>
            <button type="button" onClick={() => setForwardOpen((v) => !v)} className="text-sm font-semibold text-indigo-600 mb-2">
              Change from this date forward
            </button>
            {forwardOpen && (
              <div className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <p className="text-xs text-slate-500">Unstarted future visits are regenerated. Completed and skipped visits stay.</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" />
                  <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" />
                </div>
                <FrequencyPicker
                  value={frequency}
                  intervalDays={intervalDays}
                  advanced
                  weekdays={weekdays}
                  monthNth={monthNth}
                  onWeekdaysChange={setWeekdays}
                  onMonthNthChange={setMonthNth}
                  onChange={(freq, days) => {
                    setFrequency(freq);
                    if (days != null) setIntervalDays(days);
                    if (freq !== 'monthly') setMonthNth(null);
                  }}
                  size="sm"
                />
                <p className="text-[11px] text-slate-400">{services.find((s) => s.id === job.service_id)?.name || 'Service unchanged'}</p>
                <button type="button" disabled={localBusy} onClick={() => void changeForward()} className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
                  Update series
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
