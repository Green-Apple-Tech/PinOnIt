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
  bookingId: string;
  serviceId?: string | null;
  alsoRemindIds: string[];
  onSaved?: (ids: string[]) => void;
};

export function BookingAlsoRemindPicker({ bookingId, serviceId, alsoRemindIds, onSaved }: Props) {
  const { profile } = useAuth();
  const roster = useMemo(() => normalizeAlsoPeople(profile?.reminder_also), [profile?.reminder_also]);
  const [selected, setSelected] = useState<string[]>(() => parseAlsoRemindIds(alsoRemindIds));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSelected(parseAlsoRemindIds(alsoRemindIds));
  }, [alsoRemindIds, bookingId]);

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
    const { error } = await supabase
      .from('bookings')
      .update({ also_remind_ids: selected })
      .eq('id', bookingId);
    setSaving(false);
    if (error) return;
    onSaved?.(selected);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (roster.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 py-3 text-xs text-slate-500">
        <Users className="h-4 w-4 inline mr-1.5 text-slate-400" />
        Add coworkers in{' '}
        <Link to="/dashboard/reminders" className="font-semibold text-brand-600 hover:underline">
          Smart Reminders → Coworker roster
        </Link>
        , then pick them here.
      </div>
    );
  }

  const dirty =
    JSON.stringify([...selected].sort()) !== JSON.stringify([...parseAlsoRemindIds(alsoRemindIds)].sort());

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
      <div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
          Also remind on this meeting
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Copies of guest reminders go to the people you check. Automatic rules from your roster still apply.
        </p>
      </div>

      {autoIncluded.length > 0 ? (
        <div className="text-xs text-slate-500 bg-brand-50/50 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/20 rounded-lg px-2.5 py-2">
          Always copied (from roster):{' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {autoIncluded.map((p) => p.name).join(', ')}
          </span>
        </div>
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
                  ? 'border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
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
                  {isAuto ? 'Automatic from roster' : 'Add for this meeting only'}
                </span>
              </span>
              {on ? <Check className="h-4 w-4 text-brand-600 shrink-0" /> : null}
            </label>
          );
        })}
      </div>

      {dirty ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="w-full min-h-10 inline-flex items-center justify-center gap-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#5864C6' }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saved ? 'Saved' : 'Save for this meeting'}
        </button>
      ) : null}
    </div>
  );
}
