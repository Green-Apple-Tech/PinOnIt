import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Plus, Repeat, Search, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ContactAutocomplete } from '../components/ContactAutocomplete';
import { supabase } from '../lib/supabase';
import { PHONE_HINT, PHONE_PLACEHOLDER, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { SMS_BOOKING_CONSENT_CTA } from '../lib/smsCompliance';
import {
  formatStandingFrequency,
  nextStandingVisit,
  standingComposePath,
  type StandingFrequency,
  type StandingJob,
} from '../lib/standingJobs';
import type { Service } from '../lib/types';

type VisitRow = { id: string; start_time: string; status: string; standing_job_id: string | null };

const FREQS: { key: StandingFrequency; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Every 2 weeks' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom', label: 'Custom interval' },
];

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

export function StandingJobsPage() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<StandingJob[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<StandingJob | null>(null);
  const [error, setError] = useState('');

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
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.customer_name, j.customer_phone, j.customer_email, j.services?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [jobs, query]);

  const visitsFor = (id: string) => visits.filter((v) => v.standing_job_id === id);

  return (
    <main className="flex-1 p-4 md:p-8 max-w-4xl w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Standing jobs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Host-created repeating visits. Guests still book recurring event types on your public page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setError(''); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl"
        >
          <Plus className="h-4 w-4" /> New standing job
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
            ? 'No standing jobs yet. Add weekly lawn, biweekly pool, or a custom interval.'
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
                return (
                  <tr
                    key={job.id}
                    className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    onClick={() => setDetail(job)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{job.customer_name}</p>
                      <p className="text-xs text-slate-400">{job.customer_phone || job.customer_email || ''}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-600 dark:text-slate-300">
                      {job.services?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                        <Repeat className="h-3 w-3" />
                        {formatStandingFrequency(job.frequency, job.interval_days)}
                      </span>
                      {job.status !== 'active' && (
                        <span className="ml-1 text-[11px] text-slate-400 capitalize">{job.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {next ? when(next.start_time) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{money(job.price_cents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && profile?.id && (
        <StandingJobForm
          hostId={profile.id}
          services={services}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}

      {detail && (
        <StandingJobDetail
          job={detail}
          visits={visitsFor(detail.id)}
          services={services}
          onClose={() => setDetail(null)}
          onChanged={() => { setDetail(null); void load(); }}
        />
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </main>
  );
}

function StandingJobForm({
  hostId,
  services,
  onClose,
  onSaved,
}: {
  hostId: string;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [frequency, setFrequency] = useState<StandingFrequency>('weekly');
  const [intervalDays, setIntervalDays] = useState(10);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [price, setPrice] = useState('');
  const [endType, setEndType] = useState<'never' | 'date' | 'count'>('never');
  const [endDate, setEndDate] = useState('');
  const [endCount, setEndCount] = useState(12);
  const [smsConsent, setSmsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const svc = services.find((s) => s.id === serviceId);

  const save = async () => {
    if (!name.trim() || !date || !time) {
      setError('Customer name, date, and time are required.');
      return;
    }
    if (smsConsent && !phone.trim()) {
      setError('A phone number is required to carry SMS consent across visits.');
      return;
    }
    setSaving(true);
    setError('');
    const starts = new Date(`${date}T${time}:00`);
    const e164 = phone.trim() ? normalizePhoneE164(phone.trim()) : null;
    const notify: string[] = ['email'];
    if (smsConsent && e164) notify.push('sms');
    const { data, error: err } = await supabase.from('standing_jobs').insert({
      host_id: hostId,
      service_id: serviceId || null,
      customer_name: name.trim(),
      customer_email: email.trim() || null,
      customer_phone: e164,
      customer_address: address.trim() || null,
      frequency,
      interval_days: frequency === 'custom' ? Math.max(1, intervalDays) : null,
      starts_at: starts.toISOString(),
      duration_minutes: svc?.duration_minutes ?? 60,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      ends_at: endType === 'date' && endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
      occurrence_count: endType === 'count' ? Math.max(1, endCount) : null,
      price_cents: Math.round((Number(price) || 0) * 100),
      sms_consent: smsConsent,
      notify_via: notify,
      reminder_channels: smsConsent ? ['sms', 'email'] : ['email'],
    }).select('id').maybeSingle();
    if (err || !data) {
      setSaving(false);
      setError(err?.message || 'Could not save this standing job.');
      return;
    }
    if (smsConsent && e164) {
      await supabase.from('sms_optins').insert({
        name: name.trim(),
        phone: e164,
        consent: true,
        source: 'standing_job',
        disclosure_text: SMS_BOOKING_CONSENT_CTA,
        page_url: typeof window !== 'undefined' ? window.location.href : null,
      });
    }
    const { error: extErr } = await supabase.rpc('extend_standing_jobs', { p_job_id: data.id });
    setSaving(false);
    if (extErr) {
      setError(extErr.message || 'Saved the job, but could not create the visits yet.');
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold">New standing job</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <ContactAutocomplete
            hostId={hostId}
            onSelect={(c) => {
              setName(c.fullName || `${c.firstName} ${c.lastName}`.trim());
              if (c.phone) setPhone(c.phone);
              if (c.email) setEmail(c.email);
            }}
          />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setPhone(blurFormatPhone(phone))}
            placeholder={PHONE_PLACEHOLDER} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
          <p className="text-[11px] text-slate-400">{PHONE_HINT}</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Service address (optional)"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm">
            <option value="">No service linked</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {FREQS.map((f) => (
              <button key={f.key} type="button" onClick={() => setFrequency(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${frequency === f.key ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {frequency === 'custom' && (
            <label className="text-sm block">Every
              <input type="number" min={1} max={365} value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value) || 1)}
                className="ml-2 w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent" /> days
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
          </div>
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price per visit (optional)"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
          <div className="flex gap-2 text-xs">
            {(['never', 'date', 'count'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setEndType(k)}
                className={`px-3 py-1.5 rounded-full font-semibold border ${endType === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border-slate-200 dark:border-slate-700'}`}>
                {k === 'never' ? 'No end' : k === 'date' ? 'End date' : 'Visit count'}
              </button>
            ))}
          </div>
          {endType === 'date' && <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />}
          {endType === 'count' && <input type="number" min={1} value={endCount} onChange={(e) => setEndCount(Number(e.target.value) || 1)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-0.5" />
            <span className="text-slate-600 dark:text-slate-300">{SMS_BOOKING_CONSENT_CTA} Consent is stored on this job and copied onto each visit — not asked again.</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={() => void save()} disabled={saving}
            className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Create and fill the next 90 days'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StandingJobDetail({
  job,
  visits,
  services,
  onClose,
  onChanged,
}: {
  job: StandingJob;
  visits: VisitRow[];
  services: Service[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [forwardOpen, setForwardOpen] = useState(false);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fromTime, setFromTime] = useState('09:00');
  const [frequency, setFrequency] = useState<StandingFrequency>(job.frequency);
  const [intervalDays, setIntervalDays] = useState(job.interval_days ?? 10);
  const [busy, setBusy] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleWhen, setRescheduleWhen] = useState('');
  const upcoming = visits.filter((v) => v.status === 'confirmed').slice(0, 8);

  const skip = async (id: string) => {
    setBusy(true);
    await supabase.from('bookings').update({ status: 'skipped' }).eq('id', id);
    setBusy(false);
    onChanged();
  };

  const pause = async (status: 'paused' | 'ended' | 'active') => {
    setBusy(true);
    await supabase.from('standing_jobs').update({ status, updated_at: new Date().toISOString() }).eq('id', job.id);
    setBusy(false);
    onChanged();
  };

  const changeForward = async () => {
    setBusy(true);
    const starts = new Date(`${fromDate}T${fromTime}:00`);
    await supabase.rpc('standing_job_change_forward', {
      p_job_id: job.id,
      p_from: starts.toISOString(),
      p_starts_at: starts.toISOString(),
      p_frequency: frequency,
      p_interval_days: frequency === 'custom' ? intervalDays : null,
    });
    setBusy(false);
    onChanged();
  };

  const saveReschedule = async () => {
    if (!rescheduleId || !rescheduleWhen) return;
    const start = new Date(rescheduleWhen);
    const end = new Date(start.getTime() + job.duration_minutes * 60000);
    setBusy(true);
    await supabase.from('bookings').update({ start_time: start.toISOString(), end_time: end.toISOString() }).eq('id', rescheduleId);
    setBusy(false);
    setRescheduleId(null);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">{job.customer_name}</h2>
            <p className="text-sm text-slate-500">{job.services?.name || 'Standing job'} · {formatStandingFrequency(job.frequency, job.interval_days)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Link to={standingComposePath('quote', { name: job.customer_name, phone: job.customer_phone, email: job.customer_email })}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold">
            Quote <ArrowRight className="h-3 w-3" />
          </Link>
          <Link to={standingComposePath('receipt', { name: job.customer_name, phone: job.customer_phone, email: job.customer_email })}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            Receipt
          </Link>
          {job.status === 'active' ? (
            <button type="button" disabled={busy} onClick={() => void pause('paused')} className="px-3 py-2 rounded-xl border text-xs font-semibold">Pause</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void pause('active')} className="px-3 py-2 rounded-xl border text-xs font-semibold">Resume</button>
          )}
          <button type="button" disabled={busy} onClick={() => void pause('ended')} className="px-3 py-2 rounded-xl border text-xs font-semibold text-red-600">End series</button>
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Upcoming visits</h3>
        <ul className="space-y-2 mb-4">
          {upcoming.length === 0 && <li className="text-sm text-slate-400">None on the calendar yet.</li>}
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
            <div className="flex flex-wrap gap-2">
              {FREQS.map((f) => (
                <button key={f.key} type="button" onClick={() => setFrequency(f.key)}
                  className={`px-2 py-1 rounded-full text-xs font-semibold border ${frequency === f.key ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {frequency === 'custom' && (
              <input type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value) || 1)} className="w-24 px-2 py-1 rounded-lg border text-sm" />
            )}
            <p className="text-[11px] text-slate-400">{services.find((s) => s.id === job.service_id)?.name || 'Service unchanged'}</p>
            <button type="button" disabled={busy} onClick={() => void changeForward()} className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
              Update series
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
