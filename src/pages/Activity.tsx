import { useEffect, useMemo, useState, type ElementType } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2, Mail, MessageSquare, PhoneCall, Smartphone } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { HostQuote, MessageLogEntry } from '../lib/types';

type Filter = 'all' | 'messages' | 'quotes';

function ChannelGlyph({ channel, className }: { channel: string; className?: string }) {
  const Icon: ElementType =
    channel === 'sms' ? Smartphone
      : channel === 'whatsapp' ? MessageSquare
      : channel === 'voice' ? PhoneCall
      : channel === 'quote' ? FileText
      : Mail;
  const style = channel === 'whatsapp' ? { color: '#5864C6' } : undefined;
  const colorClass =
    channel === 'email' ? 'text-blue-400'
      : channel === 'voice' ? 'text-violet-400'
      : channel === 'sms' ? 'text-amber-400'
      : channel === 'quote' ? 'text-brand-500'
      : '';
  return <Icon className={`${className ?? ''} ${colorClass}`} style={style} />;
}

function sourceLabel(entry: MessageLogEntry): string {
  const subj = (entry.subject ?? '').toLowerCase();
  const body = (entry.body ?? '').toLowerCase();
  if (subj.includes('test') || body.includes('pinonit test')) return 'Test';
  if (subj.includes('quote') || subj.includes('invoice') || subj.includes('receipt')) return 'Quotes';
  if (subj.includes('slack')) return 'Slack';
  return 'Reminders';
}

function statusClass(status: string) {
  if (status === 'sent' || status === 'delivered') return { backgroundColor: '#5864C620', color: '#5864C6' };
  if (status === 'failed') return undefined;
  return undefined;
}

export function ActivityPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageLogEntry[]>([]);
  const [quotes, setQuotes] = useState<HostQuote[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      const [msgRes, quoteRes] = await Promise.all([
        supabase.from('message_log').select('*').eq('host_id', profile.id).order('created_at', { ascending: false }).limit(300),
        supabase.from('host_quotes').select('*').eq('host_id', profile.id).order('created_at', { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      setMessages((msgRes.data ?? []) as MessageLogEntry[]);
      setQuotes((quoteRes.data ?? []) as HostQuote[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const rows = useMemo(() => {
    const msgRows = messages.map((entry) => ({
      id: `msg-${entry.id}`,
      kind: 'message' as const,
      at: entry.sent_at || entry.created_at,
      channel: entry.channel,
      title: entry.recipient,
      detail: entry.subject || entry.body,
      status: entry.status,
      source: sourceLabel(entry),
    }));
    const quoteRows = quotes.map((q) => ({
      id: `quote-${q.id}`,
      kind: 'quote' as const,
      at: q.updated_at || q.created_at,
      channel: 'quote',
      title: q.client_name || q.client_email || q.client_phone || 'No client name',
      detail: `${q.kind}${q.sent_via?.length ? ` · ${(q.sent_via).join(', ')}` : ''}`,
      status: q.status,
      source: 'Quotes',
    }));
    const merged = [...msgRows, ...quoteRows].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    if (filter === 'messages') return merged.filter((r) => r.kind === 'message');
    if (filter === 'quotes') return merged.filter((r) => r.kind === 'quote');
    return merged;
  }, [messages, quotes, filter]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activity</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          One place for reminder sends, tests, and quote/invoice deliveries from every tool.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { id: 'all' as const, label: 'All' },
          { id: 'messages' as const, label: 'Messages' },
          { id: 'quotes' as const, label: 'Quotes & invoices' },
        ]).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-11 px-3 rounded-full text-sm font-semibold border ${
              filter === f.id
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/50">
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[70vh] overflow-y-auto">
          {rows.map((row) => (
            <div key={row.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <ChannelGlyph channel={row.channel} className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-900 dark:text-white truncate">{row.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{row.detail}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{row.source}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${row.status === 'failed' ? 'bg-red-500/10 text-red-400' : row.status !== 'sent' && row.status !== 'delivered' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : ''}`}
                  style={statusClass(row.status)}
                >
                  {row.status}
                </span>
                <span className="text-[11px] text-slate-400">
                  {new Date(row.at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="px-5 py-10 text-center text-slate-400 text-sm">
              Nothing logged yet. Reminder tests and quote sends will show up here.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Open a quote to edit it on{' '}
        <Link to="/dashboard/quotes" className="font-semibold underline text-slate-600 dark:text-slate-300">Quote/Invoice</Link>
        . Reminder templates stay under{' '}
        <Link to="/dashboard/settings?tab=reminders" className="font-semibold underline text-slate-600 dark:text-slate-300">Reminders</Link>.
      </p>
    </div>
  );
}
