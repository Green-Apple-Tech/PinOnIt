import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { SUPPORT_EMAIL } from '../lib/contactEmail';

type Row = { path: string; utm_source: string; visits: number };

export function MarketingTrafficPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void supabase.rpc('marketing_visit_report').then(({ data, error: err }) => {
      if (err) {
        setError(err.message);
        return;
      }
      setRows((data as Row[]) ?? []);
    });
  }, []);

  const bySource = new Map<string, number>();
  const byPath = new Map<string, number>();
  for (const row of rows) {
    bySource.set(row.utm_source, (bySource.get(row.utm_source) || 0) + Number(row.visits));
    byPath.set(row.path, (byPath.get(row.path) || 0) + Number(row.visits));
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Marketing traffic</h1>
      <p className="text-sm text-slate-500">
        First-party pageviews on public marketing URLs (90 days). ChatGPT search often shows as{' '}
        <code className="text-xs">utm_source=chatgpt.com</code> or referrer host chatgpt.com. Signed in as{' '}
        {user?.email || 'unknown'}. Report RPC allows {SUPPORT_EMAIL}.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">By source</h2>
        <Table rows={[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v])} />
      </section>
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">By landing page</h2>
        <Table rows={[...byPath.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v])} />
      </section>
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">Source × page</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="text-left px-3 py-2">Path</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-right px-3 py-2">Visits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.path}-${r.utm_source}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{r.path}</td>
                  <td className="px-3 py-2">{r.utm_source}</td>
                  <td className="px-3 py-2 text-right">{r.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Table({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No rows yet (or this login cannot read the report).</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
      {rows.map(([k, v]) => (
        <li key={k} className="flex justify-between px-3 py-2 text-sm">
          <span>{k}</span>
          <span className="font-semibold">{v}</span>
        </li>
      ))}
    </ul>
  );
}
