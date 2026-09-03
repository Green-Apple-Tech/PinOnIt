import { Bell, Settings, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { normalizeAlsoPeople } from '../lib/reminderAlso';

/** Compact guide on NeverMiss Reminders — roster editing lives in Settings → Coworkers. */
export function CoworkerReminderGuide() {
  const { profile } = useAuth();
  const roster = normalizeAlsoPeople(profile?.reminder_also);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 md:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Coworkers</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Save teammates in Settings, then choose who gets copied on each Calendar event.
          </p>
        </div>
      </div>

      {roster.length > 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">On your roster:</span>{' '}
          {roster.map((p) => p.name || 'Unnamed').join(', ')}
        </p>
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
          No coworkers saved yet — add them in Settings first.
        </p>
      )}

      <Link
        to="/dashboard/settings?tab=coworkers"
        className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <Settings className="h-4 w-4" />
        Manage coworkers in Settings
      </Link>

      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Copy a coworker on one specific event
        </p>
        <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 list-none">
          <li className="flex gap-2">
            <span className="font-bold text-brand-600 shrink-0">1.</span>
            <span>
              Add them under{' '}
              <Link to="/dashboard/settings?tab=coworkers" className="font-semibold text-brand-600 hover:underline">
                Settings → Coworkers
              </Link>{' '}
              (one time).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand-600 shrink-0">2.</span>
            <span>
              Open{' '}
              <Link to="/dashboard/appointments" className="font-semibold text-brand-600 hover:underline">
                Calendar
              </Link>{' '}
              and click the{' '}
              <Bell className="h-3.5 w-3.5 inline -mt-0.5 text-amber-500" />{' '}
              bell on that event.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand-600 shrink-0">3.</span>
            <span>
              Check their name under <strong className="font-semibold text-slate-700 dark:text-slate-300">Advanced → Remind coworkers</strong>, then tap{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Save for this event</strong>.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
