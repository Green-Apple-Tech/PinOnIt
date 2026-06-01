import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Trophy, Users, ArrowRight, Medal } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  full_name: string | null;
  slug: string | null;
  avatar_url: string | null;
  converted_count: number;
  signup_count: number;
}

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('referral_leaderboard')
      .select('*')
      .order('converted_count', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoading(false);
      });
  }, []);

  const medalColor = (rank: number) => {
    if (rank === 0) return 'text-amber-400';
    if (rank === 1) return 'text-slate-400';
    if (rank === 2) return 'text-amber-600';
    return 'text-slate-300 dark:text-slate-600';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/Screenshot_2026-04-29_at_2.49.32_PM.png" alt="Pin on It" className="h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity" />
          </Link>
          <Link
            to="/signup"
            className="px-4 py-1.5 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
          >
            Get started free <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full mb-4">
            <Trophy className="h-3.5 w-3.5" />
            Referral Leaderboard
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Top referrers
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Every Pro referral earns $1 off your monthly bill. Refer 6 and your plan is free. Refer 7+ and we pay <em>you</em>.
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: '1 referral', value: '$1 off/mo' },
            { label: '6 referrals', value: 'Free forever' },
            { label: '7+ referrals', value: 'We pay you' },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{s.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-sm">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="py-20 text-center">
              <Users className="h-10 w-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No referrals yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Be the first on the leaderboard!</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-12">Rank</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Active referrals</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Monthly credit</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-slate-50 dark:border-slate-800/50 last:border-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 ${
                      i === 0 ? 'bg-amber-50/50 dark:bg-amber-900/5' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <Medal className={`h-5 w-5 ${medalColor(i)}`} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 overflow-hidden">
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                              {(entry.full_name ?? '?').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {entry.full_name ?? 'Anonymous'}
                          </p>
                          {entry.slug && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">@{entry.slug}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{entry.converted_count}</span>
                      <span className="text-xs text-slate-400 ml-1">Pro</span>
                    </td>
                    <td className="px-6 py-4 text-right hidden sm:table-cell">
                      <span className={`text-sm font-bold ${entry.converted_count >= 7 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {entry.converted_count >= 7
                          ? `+$${entry.converted_count - 6}/mo`
                          : entry.converted_count >= 6
                          ? 'Free'
                          : `-$${entry.converted_count}/mo`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Want to climb the leaderboard?</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-all shadow-sm hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
          >
            Start referring — it's free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
