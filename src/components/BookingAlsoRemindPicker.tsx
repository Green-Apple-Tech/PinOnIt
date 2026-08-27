import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  normalizeAlsoPeople,
  parseAlsoRemindIds,
  resolveAlsoPeople,
} from '../lib/reminderAlso';

type Props = {
  /** PinOnIt booking — use bookingId OR calendarEventId, not both. */
  bookingId?: string;
  /** Synced Google/Outlook event on Calendar. */
  calendarEventId?: string;
  serviceId?: string | null;
  alsoRemindIds: string[];
  onSaved?: (ids: string[]) => void;
};

export function BookingAlsoRemindPicker({
  bookingId,
  calendarEventId,
  serviceId,
  alsoRemindIds,
  onSaved,
}: Props) {
  const { profile } = useAuth();
  const roster = useMemo(() => normalizeAlsoPeople(profile?.reminder_also), [profile?.reminder_also]);
  const [selected, setSelected] = useState<string[]>(() => parseAlsoRemindIds(alsoRemindIds));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSelected(parseAlsoRemindIds(alsoRemindIds));
  }, [alsoRemindIds, bookingId, calendarEventId]);

  const autoIncluded = useMemo(
    () => resolveAlsoPeople(roster, { serviceId, bookingAlsoIds: [] }),
    [roster, serviceId],
  );

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    const payload = { also_remind_ids: selected };
    const { error } = bookingId
      ? await supabase.from('bookings').update(payload).eq('id', bookingId)
      : calendarEventId
        ? await supabase.from('calendar_events').update(payload).eq('id', calendarEventId)
        : { error: new Error('missing target') };
    setSaving(false);
    if (error) return;
    onSaved?.(selected);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (roster.length === 0) {
    return (
      <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/40 dark:bg-brand-500/5 px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
        <Users className="h-4 w-4 inline mr-1.5 text-brand-600" />
        <span className="font-semibold text-slate-800 dark:text-slate-100">Remind a coworker?</span>{' '}
        Add them in{' '}
        <Link to="/dashboard/settings?tab=coworkers" className="font-semibold text-brand-600 hover:underline">
          Settings → Coworkers
        </Link>
        , then come back and check their name here.
      </div>
    );
  }

  const dirty =
    JSON.stringify([...selected].sort()) !== JSON.stringify([...parseAlsoRemindIds(alsoRemindIds)].sort());

  const manualRoster = roster.filter((p) => (p.scope ?? 'manual') === 'manual');

  return (
    <div className="rounded-xl border-2 border-brand-200 dark:border-brand-500/30 bg-brand-50/30 dark:bg-brand-500/5 p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <Users className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Remind coworkers</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Check who gets a copy of reminders for <strong className="font-semibold">this event</strong>. They receive the same email/SMS/WhatsApp as your guest reminders.
          </p>
        </div>
      </div>

      {autoIncluded.length > 0 ? (
        <div className="text-xs text-slate-600 bg-white/70 dark:bg-slate-900/40 border border-brand-100 dark:border-brand-500/20 rounded-lg px-2.5 py-2">
          Already included from roster:{' '}
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {autoIncluded.map((p) => p.name).join(', ')}
          </span>
        </div>
      ) : manualRoster.length > 0 && selected.length === 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg px-2.5 py-2">
          Nobody selected yet — check a name below, then tap <strong>Save for this event</strong>.
        </p>
      ) : null}

      <div className="space-y-1.5">
        {roster.map((p) => {
          const isAuto = autoIncluded.some((a) => a.id === p.id);
          const on = isAuto || selected.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                on
                  ? 'border-brand-400 bg-white dark:bg-slate-900/60 dark:border-brand-500/40'
                  : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/50'
              } ${isAuto ? 'opacity-90' : ''}`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={isAuto}
                onChange={() => !isAuto && toggle(p.id)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block truncate">{p.name}</span>
                <span className="text-[10px] text-slate-400">
                  {isAuto ? 'Automatic from roster' : 'Add for this event'}
                </span>
              </span>
              {on ? <Check className="h-4 w-4 text-brand-600 shrink-0" /> : null}
            </label>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !dirty}
        className="w-full min-h-10 inline-flex items-center justify-center gap-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
        style={{ backgroundColor: '#5864C6' }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saved ? 'Saved' : dirty ? 'Save for this event' : 'Saved for this event'}
      </button>
    </div>
  );
}
