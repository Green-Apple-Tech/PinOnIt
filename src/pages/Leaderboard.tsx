import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/pageMeta';

export function LeaderboardPage() {
  usePageMeta({
    title: 'Customer referrals end November 14, 2026 | PinOnIt',
    description: 'The $1 PinOnIt customer referral credit continues through November 14, 2026.',
    url: 'https://pinonit.com/leaderboard',
    image: 'https://pinonit.com/og-why-pinonit.png',
    robots: 'noindex, nofollow',
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-6 py-16">
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ends November 14, 2026</p>
        <h1 className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">The $1 customer referral credit continues through November 14, 2026</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          New $1 credits are issued through that date. After that, an old referral link still opens ordinary signup and no new credits are issued.
        </p>
        <Link to="/signup" className="inline-block mt-6 text-sm font-semibold text-indigo-600">Create an account</Link>
      </div>
    </div>
  );
}
