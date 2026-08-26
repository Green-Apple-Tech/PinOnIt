import { Link } from 'react-router-dom';
import { AlertTriangle, Zap } from 'lucide-react';
import { effectivePlan, isActivePlan } from '../lib/plan';
import type { Profile, Subscription } from '../lib/types';

type Props = {
  profile: Profile | null;
  subscription: Subscription | null;
};

export function ExpiredBanner({ profile, subscription }: Props) {
  const plan = effectivePlan(subscription, profile);
  if (isActivePlan(plan)) return null;

  return (
    <div className="mx-4 md:mx-6 mt-4 flex items-start gap-3 p-4 rounded-2xl border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Your trial has ended — reactivate to keep booking and reminders running
        </p>
        <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1">
          You can still log in, view your calendar, and export contacts. New bookings and all outbound reminders are paused until you subscribe.
        </p>
      </div>
      <Link
        to="/dashboard/settings?tab=billing"
        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
        style={{ backgroundColor: '#5864C6' }}
      >
        <Zap className="h-4 w-4" />
        Reactivate Pro
      </Link>
    </div>
  );
}
