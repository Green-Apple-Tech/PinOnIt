import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PHONE_PLACEHOLDER, blurFormatPhone } from '../lib/phone';
import {
  ALSO_CHANNEL_OPTIONS,
  alsoPersonIsReady,
  newAlsoPerson,
  normalizeAlsoPeople,
  type AlsoChannel,
  type AlsoPerson,
} from '../lib/reminderAlso';

export function AlsoRemindPeople() {
  const { user, profile, refreshProfile } = useAuth();
  const [people, setPeople] = useState<AlsoPerson[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPeople(normalizeAlsoPeople(profile?.reminder_also));
  }, [profile?.reminder_also]);

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

  const save = async () => {
    if (!user?.id) return;
    const cleaned = people
      .map((p) => ({
        ...p,
        name: p.name.trim(),
        email: p.email.trim(),
        phone: p.phone.trim(),
      }))
      .filter((p) => p.name || p.email || p.phone);
    const bad = cleaned.find((p) => !alsoPersonIsReady(p));
    if (bad) {
      setError('Each person needs a name, plus email for Email and a phone for SMS/WhatsApp.');
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
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Also remind coworkers</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Super Reminders can copy extra people — coworkers, an assistant, a spouse — by email, SMS, or WhatsApp. Not voice. Only add people who expect these messages.
          </p>
        </div>
      </div>

      {people.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">Nobody extra yet. Add someone below.</p>
      )}

      <div className="space-y-3">
        {people.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2"
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
            <div className="flex flex-wrap gap-2">
              {ALSO_CHANNEL_OPTIONS.map((ch) => {
                const on = p.channels.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(p.id, ch.id)}
                    className={`min-h-11 px-3 rounded-lg text-sm font-medium border ${
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
          </div>
        ))}
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
          {saved ? 'Saved' : 'Save list'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
