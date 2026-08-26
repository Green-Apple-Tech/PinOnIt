import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PHONE_PLACEHOLDER, blurFormatPhone } from '../lib/phone';
import type { Service } from '../lib/types';
import {
  ALSO_CHANNEL_OPTIONS,
  ALSO_SCOPE_OPTIONS,
  alsoPersonIsReady,
  newAlsoPerson,
  normalizeAlsoPeople,
  type AlsoChannel,
  type AlsoPerson,
  type AlsoScope,
} from '../lib/reminderAlso';

export function AlsoRemindPeople() {
  const { user, profile, refreshProfile } = useAuth();
  const [people, setPeople] = useState<AlsoPerson[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPeople(normalizeAlsoPeople(profile?.reminder_also));
  }, [profile?.reminder_also]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from('services')
      .select('id, name')
      .eq('host_id', user.id)
      .order('name')
      .then(({ data }) => setServices((data ?? []) as Service[]));
  }, [user?.id]);

  const toggleChannel = (id: string, channel: AlsoChannel) => {
    setPeople((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const has = p.channels.includes(channel);
        const channels = has ? p.channels.filter((c) => c !== channel) : [...p.channels, channel];
        return { ...p, channels: channels.length ? channels : p.channels };
      }),
    );
    setSaved(false);
  };

  const setScope = (id: string, scope: AlsoScope) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, scope, service_ids: scope === 'services' ? (p.service_ids ?? []) : [] } : p)),
    );
    setSaved(false);
  };

  const toggleService = (personId: string, serviceId: string) => {
    setPeople((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p;
        const ids = p.service_ids ?? [];
        const next = ids.includes(serviceId) ? ids.filter((x) => x !== serviceId) : [...ids, serviceId];
        return { ...p, service_ids: next };
      }),
    );
    setSaved(false);
  };

  const save = async () => {
    if (!user?.id) return;
    const cleaned = people
      .map((p) => ({
        ...p,
        name: p.name.trim(),
        email: p.email.trim(),
        phone: p.phone.trim(),
        scope: p.scope ?? 'manual',
        service_ids: p.scope === 'services' ? (p.service_ids ?? []) : [],
      }))
      .filter((p) => p.name || p.email || p.phone);
    const bad = cleaned.find((p) => !alsoPersonIsReady(p));
    if (bad) {
      setError('Each person needs a name, contact info for their channels, and at least one event type if scoped to event types.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('profiles')
      .update({ reminder_also: cleaned })
      .eq('id', user.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 md:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Coworker roster</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Save people who can receive reminder copies. By default they are <strong className="font-semibold text-slate-700 dark:text-slate-300">only</strong> notified on meetings you pick in Calendar — not every booking.
          </p>
        </div>
      </div>

      {people.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">Nobody on your roster yet. Add someone below.</p>
      )}

      <div className="space-y-3">
        {people.map((p) => {
          const scope = p.scope ?? 'manual';
          const scopeMeta = ALSO_SCOPE_OPTIONS.find((o) => o.id === scope);
          return (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-3"
            >
              <div className="flex items-start gap-2">
                <input
                  value={p.name}
                  onChange={(e) => {
                    setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)));
                    setSaved(false);
                  }}
                  placeholder="Name"
                  className="flex-1 min-h-11 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPeople((prev) => prev.filter((x) => x.id !== p.id));
                    setSaved(false);
                  }}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center text-slate-400 hover:text-red-500 rounded-lg"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input
                type="email"
                value={p.email}
                onChange={(e) => {
                  setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, email: e.target.value } : x)));
                  setSaved(false);
                }}
                placeholder="Email"
                className="w-full min-h-11 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base text-slate-900 dark:text-white"
              />
              <input
                type="tel"
                value={p.phone}
                onChange={(e) => {
                  setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, phone: e.target.value } : x)));
                  setSaved(false);
                }}
                onBlur={() => {
                  if (p.phone.trim()) {
                    setPeople((prev) =>
                      prev.map((x) => (x.id === p.id ? { ...x, phone: blurFormatPhone(x.phone) } : x)),
                    );
                  }
                }}
                placeholder={PHONE_PLACEHOLDER}
                className="w-full min-h-11 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base text-slate-900 dark:text-white"
              />

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">When to copy them</p>
                <div className="space-y-1.5">
                  {ALSO_SCOPE_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${
                        scope === opt.id
                          ? 'border-brand-400 bg-brand-50/50 dark:border-brand-500/40 dark:bg-brand-500/10'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`scope-${p.id}`}
                        checked={scope === opt.id}
                        onChange={() => setScope(p.id, opt.id)}
                        className="mt-1 h-4 w-4 text-brand-600"
                      />
                      <span>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">{opt.label}</span>
                        <span className="text-xs text-slate-400">{opt.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {scope === 'services' ? (
                <div className="flex flex-wrap gap-1.5">
                  {services.length === 0 ? (
                    <p className="text-xs text-slate-400">Create an event type first under Services.</p>
                  ) : (
                    services.map((svc) => {
                      const on = (p.service_ids ?? []).includes(svc.id);
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => toggleService(p.id, svc.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                            on
                              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-500'
                          }`}
                        >
                          {svc.name}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {ALSO_CHANNEL_OPTIONS.map((ch) => {
                  const on = p.channels.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChannel(p.id, ch.id)}
                      className={`min-h-10 px-3 rounded-lg text-sm font-medium border ${
                        on
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      {ch.label}
                    </button>
                  );
                })}
              </div>
              {scopeMeta ? (
                <p className="text-[11px] text-slate-400">{scopeMeta.hint}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={people.length >= 8}
          onClick={() => {
            setPeople((prev) => [...prev, newAlsoPerson()]);
            setSaved(false);
          }}
          className="min-h-11 inline-flex items-center gap-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add person
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="min-h-11 inline-flex items-center gap-2 px-4 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#5864C6' }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saved ? 'Saved' : 'Save roster'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
