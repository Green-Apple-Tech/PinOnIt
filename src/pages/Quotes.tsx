import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Clock, Copy, DollarSign, Eye, FileText, Plus, XCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { quotesNewPath } from '../lib/documentActions';
import { documentViewUrl, markQuotePaid, sendDocumentLink } from '../lib/documents';
import { quoteHostStatus } from '../lib/quoteSms';
import { quoteTotals } from '../lib/quoteMath';
import type { SmbDocument } from '../lib/types';

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function money(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

const STATUS_STYLE: Record<string, { className: string; icon: typeof Clock }> = {
  sent: { className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', icon: Clock },
  viewed: { className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300', icon: Eye },
  approved: { className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', icon: CheckCircle },
  paid: { className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200', icon: DollarSign },
  declined: { className: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300', icon: XCircle },
  expired: { className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: Clock },
};

export function QuotesPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<SmbDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [paidBusyId, setPaidBusyId] = useState<string | null>(null);
  const [paidError, setPaidError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('sender_id', user.id)
      .eq('document_type', 'quote')
      .order('created_at', { ascending: false })
      .limit(200);
    setDocs((data as SmbDocument[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async (token: string, id: string) => {
    await navigator.clipboard.writeText(documentViewUrl(token));
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const onMarkPaid = async (doc: SmbDocument) => {
    setPaidError('');
    setPaidBusyId(doc.id);
    const marked = await markQuotePaid(doc.token);
    if (!marked.ok) {
      setPaidBusyId(null);
      setPaidError(marked.error);
      return;
    }
    const sms = await sendDocumentLink(doc.token, documentViewUrl(doc.token), 'receipt');
    setPaidBusyId(null);
    if (!sms.ok) {
      setPaidError(sms.error || 'Marked paid, but the receipt text did not send.');
    }
    void load();
  };

  const stats = {
    sent: docs.filter((d) => d.status === 'pending').length,
    viewed: docs.filter((d) => d.status === 'viewed').length,
    approved: docs.filter((d) => d.status === 'signed').length,
    paid: docs.filter((d) => d.status === 'paid').length,
  };

  return (
    <main className="p-4 md:p-8 max-w-5xl pb-28 md:pb-8">
      <div className="mb-5 md:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Quote-by-Text</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
            Sent means the text went out. Viewed means they opened it. Approve is Sign-by-Text. Mark paid texts the receipt.
          </p>
        </div>
        <Link
          to={quotesNewPath()}
          className="inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold"
        >
          <Plus className="h-4 w-4" />
          SEND QUOTE
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          ['Sent', stats.sent],
          ['Viewed', stats.viewed],
          ['Approved', stats.approved],
          ['Paid', stats.paid],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {paidError && <p className="mb-3 text-sm text-red-600">{paidError}</p>}

      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="animate-spin h-7 w-7 border-4 border-brand-600 border-t-transparent rounded-full" />
          </div>
        ) : docs.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="h-8 w-8 mx-auto text-gray-300 dark:text-slate-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">No quotes yet. Send one in under a minute.</p>
            <Link to={quotesNewPath()} className="mt-4 inline-block text-sm font-semibold text-brand-600">
              Send your first quote
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {docs.map((doc) => {
              const status = quoteHostStatus(doc);
              const style = STATUS_STYLE[status.key] ?? STATUS_STYLE.sent;
              const Icon = style.icon;
              const total = quoteTotals(doc.line_items ?? [], Number(doc.tax_percent) || 0).total;
              return (
                <li key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {doc.recipient_name}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${style.className}`}>
                        <Icon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-300 truncate">
                      {doc.topic} · {money(total)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatWhen(doc.created_at)}
                      {doc.recipient_phone ? ` · ${doc.recipient_phone}` : ''}
                      {status.key === 'sent' ? ' · not opened yet' : ''}
                      {status.key === 'viewed' ? ' · opened, still thinking' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {doc.status === 'signed' && (
                      <button
                        type="button"
                        onClick={() => void onMarkPaid(doc)}
                        disabled={paidBusyId === doc.id}
                        className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
                      >
                        <DollarSign className="h-4 w-4" />
                        {paidBusyId === doc.id ? 'Sending receipt…' : 'Mark paid'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyLink(doc.token, doc.id)}
                      className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-slate-300"
                    >
                      <Copy className="h-4 w-4" />
                      {copiedId === doc.id ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
