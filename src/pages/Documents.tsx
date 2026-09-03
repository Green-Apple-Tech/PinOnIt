import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Clock, Copy, Eye, FileText, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { documentsNewPath } from '../lib/documentActions';
import {
  HOLD_UP_COPY,
  SIGN_BY_TEXT_SCOPE_SUMMARY,
  documentTypeLabel,
  documentViewUrl,
} from '../lib/documents';
import type { SmbDocument, SmbDocumentStatus } from '../lib/types';

const STATUS: Record<SmbDocumentStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', icon: Clock },
  viewed: { label: 'Viewed', className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300', icon: Eye },
  signed: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', icon: CheckCircle },
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function DocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<SmbDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('sender_id', user.id)
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

  const stats = {
    total: docs.length,
    pending: docs.filter((d) => d.status === 'pending').length,
    viewed: docs.filter((d) => d.status === 'viewed').length,
    signed: docs.filter((d) => d.status === 'signed').length,
  };

  return (
    <main className="p-4 md:p-8 max-w-5xl pb-28 md:pb-8">
      <div className="mb-5 md:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Documents</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
            <span className="font-sign-by-text text-base text-brand-700 dark:text-brand-300">Sign-by-Text</span>
            {' '}and Send Docs — one place. No login for the recipient.
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300 max-w-2xl">{HOLD_UP_COPY}</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            {SIGN_BY_TEXT_SCOPE_SUMMARY}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={documentsNewPath('sign')}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span className="font-sign-by-text text-base">Sign-by-Text</span>
          </Link>
          <Link
            to={documentsNewPath('send')}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-gray-800 dark:text-slate-100"
          >
            Send Docs
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { to: documentsNewPath('sign', 'upload'), label: 'Upload PDF to sign' },
          { to: documentsNewPath('sign', 'quick_addendum'), label: 'Quick Addendum' },
          { to: documentsNewPath('sign', 'nda'), label: 'Send NDA' },
          { to: documentsNewPath('sign', 'waiver'), label: 'Send Waiver' },
          { to: documentsNewPath('send', 'invoice'), label: 'Send Invoice' },
          { to: documentsNewPath('send', 'quote'), label: 'Send Quote' },
          { to: documentsNewPath('send', 'receipt'), label: 'Send Receipt' },
        ].map((btn) => (
          <Link
            key={btn.to}
            to={btn.to}
            className="inline-flex items-center justify-center min-h-11 px-3.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            {btn.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          ['Sent', stats.total],
          ['Pending', stats.pending],
          ['Viewed', stats.viewed],
          ['Confirmed', stats.signed],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="animate-spin h-7 w-7 border-4 border-brand-600 border-t-transparent rounded-full" />
          </div>
        ) : docs.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="h-8 w-8 mx-auto text-gray-300 dark:text-slate-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">No documents yet. Send your first one.</p>
            <Link to={documentsNewPath('sign')} className="mt-4 inline-block text-sm font-semibold text-brand-600">
              Start with Sign-by-Text
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {docs.map((doc) => {
              const meta = STATUS[doc.status];
              const Icon = meta.icon;
              return (
                <li key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {doc.recipient_name}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-gray-400">
                        {documentTypeLabel(doc.document_type, doc.document_type_custom)}
                        {doc.file_name ? ` · ${doc.file_name}` : ''}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.className}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-300 truncate">{doc.topic}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatWhen(doc.created_at)}
                      {doc.recipient_phone ? ` · ${doc.recipient_phone}` : ''}
                      {doc.recipient_email ? ` · ${doc.recipient_email}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyLink(doc.token, doc.id)}
                    className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-slate-300"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedId === doc.id ? 'Copied' : 'Copy link'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
