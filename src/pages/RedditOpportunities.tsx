import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { isStaffEmail } from '../lib/staff';
import { redditPostUrl } from '../lib/redditFinder';

type Status = 'new' | 'review' | 'approved' | 'responded' | 'skip';
type Mention = 'yes' | 'maybe' | 'no';
type WindowKey = '24h' | '7d' | '30d' | 'all';

type Opportunity = {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  posted_at: string | null;
  search_query: string;
  industry: string | null;
  feature: string | null;
  problem: string;
  why_relevant: string;
  score: number;
  mention: Mention;
  mention_reason: string;
  suggested_response: string;
  high_seo_value: boolean;
  rules_note: string | null;
  status: Status;
  outcome_upvotes: number | null;
  outcome_replies: number | null;
  outcome_signups: number | null;
  outcome_notes: string | null;
};

const STATUS_LABEL: Record<Status, string> = {
  new: 'NEW',
  review: 'REVIEW',
  approved: 'APPROVED',
  responded: 'RESPONDED',
  skip: 'SKIP',
};

export function RedditOpportunitiesPage() {
  const { user } = useAuth();
  const staff = isStaffEmail(user?.email);
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [windowKey, setWindowKey] = useState<WindowKey>('30d');
  const [industry, setIndustry] = useState('all');
  const [feature, setFeature] = useState('all');
  const [subreddit, setSubreddit] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [learning, setLearning] = useState({ visits: 0, signups: 0 });

  const load = async () => {
    const { data, error: err } = await supabase
      .from('reddit_opportunities')
      .select('*')
      .order('score', { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    setRows((data as Opportunity[]) ?? []);
    const summary = await supabase.rpc('reddit_learning_summary');
    const first = Array.isArray(summary.data) ? summary.data[0] : null;
    if (first) {
      setLearning({
        visits: Number(first.reddit_visits ?? 0),
        signups: Number(first.reddit_signups ?? 0),
      });
    }
  };

  useEffect(() => {
    if (staff) void load();
  }, [staff]);

  const industries = useMemo(() => unique(rows.map((row) => row.industry)), [rows]);
  const features = useMemo(() => unique(rows.map((row) => row.feature)), [rows]);
  const subs = useMemo(() => unique(rows.map((row) => row.subreddit)), [rows]);

  const visible = rows.filter((row) => {
    if (!inWindow(row.posted_at, windowKey)) return false;
    if (industry !== 'all' && row.industry !== industry) return false;
    if (feature !== 'all' && row.feature !== feature) return false;
    if (subreddit !== 'all' && row.subreddit !== subreddit) return false;
    if (row.score < minScore) return false;
    return true;
  });

  const responded = rows.filter((row) => row.status === 'responded');

  const search = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    const { data, error: err } = await supabase.functions.invoke('reddit-opportunity-search', { body: {} });
    setLoading(false);
    if (err || data?.ok === false) {
      setError(data?.error || err?.message || 'Search failed');
      return;
    }
    setNotice(`Checked ${data.queries?.length ?? 0} searches. ${data.saved ?? 0} new threads saved. Nothing was posted.`);
    await load();
  };

  const patch = async (id: string, changes: Partial<Opportunity> & { responded_at?: string | null }) => {
    const { error: err } = await supabase.from('reddit_opportunities').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) {
      setError(err.message);
      return;
    }
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  };

  if (!staff) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reddit Opportunity Finder</h1>
        <p className="mt-2 text-sm text-slate-500">This tool is only available on the PinOnIt staff login.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reddit Opportunity Finder</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Finds public threads where PinOnIt fits. You review and post them yourself. This page never posts to Reddit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? 'Searching…' : 'Search Reddit'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Threads found" value={rows.length} />
        <Stat label="Responses marked" value={responded.length} />
        <Stat label="Reddit visits" value={learning.visits} />
        <Stat label="Reddit signups" value={learning.signups} />
      </section>
      <p className="text-xs text-slate-400">
        Visits and signups count people who arrived with utm_source=reddit. Record upvotes, replies, and signups on each thread after you post.
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        <Select label="When" value={windowKey} onChange={(value) => setWindowKey(value as WindowKey)} options={[['24h', 'Last 24 hours'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['all', 'Any time']]} />
        <Select label="Industry" value={industry} onChange={setIndustry} options={[['all', 'All industries'], ...industries.map((item) => [item, item] as [string, string])]} />
        <Select label="Feature" value={feature} onChange={setFeature} options={[['all', 'All features'], ...features.map((item) => [item, item] as [string, string])]} />
        <Select label="Subreddit" value={subreddit} onChange={setSubreddit} options={[['all', 'All subreddits'], ...subs.map((item) => [item, `r/${item}`] as [string, string])]} />
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500">Min score</span>
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value) || 0)}
            className="w-16 bg-transparent"
          />
        </label>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-slate-400">No threads yet. Search Reddit after the database migration and Reddit app credentials are in place.</p>
      )}

      <div className="space-y-4">
        {visible.map((row) => (
          <article key={row.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-950">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="px-2 py-1 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">{row.score}</span>
              <span className="text-slate-500">r/{row.subreddit}</span>
              <span className="text-slate-400">{row.posted_at ? new Date(row.posted_at).toLocaleDateString() : ''}</span>
              <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900">{STATUS_LABEL[row.status]}</span>
              <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900">MENTION {row.mention.toUpperCase()}</span>
              {row.high_seo_value && (
                <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900">HIGH AI/SEO VALUE</span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{row.title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-medium">Problem. </span>{row.problem}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-medium">Why PinOnIt. </span>{row.why_relevant}</p>
            <p className="text-sm text-slate-500"><span className="font-medium">Should we mention PinOnIt? </span>{row.mention.toUpperCase()}. {row.mention_reason}</p>
            {row.rules_note && <p className="text-xs text-slate-400">{row.rules_note}</p>}
            <textarea
              readOnly
              value={row.suggested_response}
              className="w-full min-h-28 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} onClick={() => void navigator.clipboard.writeText(row.suggested_response)}>Copy response</button>
              <a className={btn} href={redditPostUrl(row.permalink)} target="_blank" rel="noreferrer">Open Reddit</a>
              <button type="button" className={btn} onClick={() => void patch(row.id, { status: 'responded', responded_at: new Date().toISOString() })}>Mark responded</button>
              <button type="button" className={btn} onClick={() => void patch(row.id, { status: 'skip' })}>Skip</button>
              <select
                value={row.status}
                onChange={(event) => void patch(row.id, { status: event.target.value as Status })}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm bg-transparent"
              >
                {(Object.keys(STATUS_LABEL) as Status[]).map((status) => (
                  <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Outcome label="Upvotes" value={row.outcome_upvotes} onSave={(value) => void patch(row.id, { outcome_upvotes: value })} />
              <Outcome label="Replies" value={row.outcome_replies} onSave={(value) => void patch(row.id, { outcome_replies: value })} />
              <Outcome label="Signups" value={row.outcome_signups} onSave={(value) => void patch(row.id, { outcome_signups: value })} />
              <label className="col-span-2 sm:col-span-1 text-xs text-slate-500">
                Notes
                <input
                  defaultValue={row.outcome_notes ?? ''}
                  onBlur={(event) => void patch(row.id, { outcome_notes: event.target.value })}
                  className="mt-1 w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent"
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const btn = 'px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-900';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
      <span className="text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent">
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
    </label>
  );
}

function Outcome({ label, value, onSave }: { label: string; value: number | null; onSave: (value: number | null) => void }) {
  return (
    <label className="text-xs text-slate-500">
      {label}
      <input
        type="number"
        defaultValue={value ?? ''}
        onBlur={(event) => onSave(event.target.value === '' ? null : Number(event.target.value))}
        className="mt-1 w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent"
      />
    </label>
  );
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function inWindow(postedAt: string | null, windowKey: WindowKey): boolean {
  if (windowKey === 'all') return true;
  if (!postedAt) return false;
  const age = Date.now() - Date.parse(postedAt);
  const day = 24 * 60 * 60 * 1000;
  if (windowKey === '24h') return age <= day;
  if (windowKey === '7d') return age <= 7 * day;
  return age <= 30 * day;
}
