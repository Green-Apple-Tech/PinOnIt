import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Repeat } from 'lucide-react';
import { FrequencyPicker } from './FrequencyPicker';
import { supabase } from '../lib/supabase';
import { formatRecurrenceBadge } from '../lib/recurring';
import type { RecurrenceFrequency, Service } from '../lib/types';

type Props = {
  hostId: string;
};

export function GuestRepeatSetup({ hostId }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('services')
      .select('*')
      .eq('host_id', hostId)
      .order('created_at');
    if (err) {
      setError(err.message || 'Could not load booking types.');
      setServices([]);
    } else {
      setError('');
      setServices((data as Service[]) ?? []);
    }
    setLoading(false);
  }, [hostId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const persist = async (
    svc: Service,
    next: {
      is_recurring: boolean;
      recurrence_frequency: RecurrenceFrequency | null;
      recurrence_interval_days: number | null;
    },
  ) => {
    setBusyId(svc.id);
    setError('');
    const prev = services;
    setServices((rows) => rows.map((row) => (row.id === svc.id ? { ...row, ...next } : row)));
    const { error: err } = await supabase
      .from('services')
      .update({
        is_recurring: next.is_recurring,
        recurrence_frequency: next.recurrence_frequency,
        recurrence_interval_days: next.recurrence_interval_days,
        max_recurring_clients: next.is_recurring ? (svc.max_recurring_clients ?? 1) : svc.max_recurring_clients,
      })
      .eq('id', svc.id)
      .eq('host_id', hostId);
    setBusyId(null);
    if (err) {
      setServices(prev);
      setError(err.message || 'Could not save repeating visits.');
    }
  };

  const toggle = (svc: Service) => {
    if (svc.is_recurring) {
      void persist(svc, {
        is_recurring: false,
        recurrence_frequency: null,
        recurrence_interval_days: null,
      });
      return;
    }
    void persist(svc, {
      is_recurring: true,
      recurrence_frequency: svc.recurrence_frequency ?? 'weekly',
      recurrence_interval_days: svc.recurrence_frequency === 'custom' ? (svc.recurrence_interval_days ?? 10) : null,
    });
  };

  return (
    <div
      id="recurring-bookings-help"
      className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/20 p-4 md:p-5"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
          <Repeat className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">Offer repeating visits on your booking page</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
            Turn this on for a booking type and pick how often it repeats. When someone books, they can opt in to that schedule. You confirm each new request under Recurring jobs.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-800/50 bg-white/70 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-300">
          <p className="mb-3">Add a booking type first, then turn on repeating here.</p>
          <Link
            to="/dashboard/settings?tab=event-types&new=one_on_one"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
          >
            <Plus className="h-4 w-4" /> Add new Booking Type
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="rounded-xl border border-indigo-100 dark:border-indigo-800/50 bg-white dark:bg-slate-900 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{svc.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {svc.is_recurring && svc.recurrence_frequency
                      ? formatRecurrenceBadge(svc.recurrence_frequency, svc.recurrence_interval_days)
                      : 'Does not repeat — one visit only'}
                    {!svc.is_active ? ' · Inactive' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === svc.id}
                  onClick={() => toggle(svc)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                    svc.is_recurring ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-slate-600'
                  } disabled:opacity-60`}
                  aria-label={svc.is_recurring ? `Turn off repeating for ${svc.name}` : `Turn on repeating for ${svc.name}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      svc.is_recurring ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {svc.is_recurring && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">How often</p>
                  <FrequencyPicker
                    size="sm"
                    value={svc.recurrence_frequency ?? 'weekly'}
                    intervalDays={svc.recurrence_interval_days ?? 10}
                    onChange={(freq, days) => {
                      void persist(svc, {
                        is_recurring: true,
                        recurrence_frequency: freq,
                        recurrence_interval_days: freq === 'custom' ? days : null,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
