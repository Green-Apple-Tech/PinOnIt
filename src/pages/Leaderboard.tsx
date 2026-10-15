import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/pageMeta';

export function LeaderboardPage() {
  usePageMeta({
    title: 'Customer referrals ended | PinOnIt',
    description: 'The $1 PinOnIt customer referral program ended on October 15, 2026.',
    url: 'https://pinonit.com/leaderboard',
    image: 'https://pinonit.com/og-why-pinonit.png',
    robots: 'noindex, nofollow',
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-6 py-16">
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ended October 15, 2026</p>
        <h1 className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">The $1 customer referral program has ended</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          No new credits are issued. An old referral link still opens ordinary signup.
        </p>
        <Link to="/signup" className="inline-block mt-6 text-sm font-semibold text-indigo-600">Create an account</Link>
      </div>
    </div>
  );
}
