import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Copy, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { PHONE_HINT, PHONE_PLACEHOLDER, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import {
  HOLD_UP_COPY,
  SMB_DOCUMENT_TYPES,
  defaultWaiverText,
  documentViewUrl,
  newDocumentToken,
  sendDocumentLink,
  topicCoverLine,
} from '../lib/documents';
import type { DocumentTemplate, SmbDocumentType } from '../lib/types';

const fieldClass =
  'mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base';

type SmsStatus = 'sending' | 'sent' | 'failed';

export function CreateDocumentPage() {
  const { user, profile } = useAuth();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [documentType, setDocumentType] = useState<SmbDocumentType>('nda');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [customText, setCustomText] = useState(() => defaultWaiverText());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ token: string; smsStatus: SmsStatus; smsError?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void supabase
      .from('document_templates')
      .select('*')
      .then(({ data }) => setTemplates((data as DocumentTemplate[]) ?? []));
  }, []);

  const selectedTemplate = templates.find((t) => t.document_type === documentType) ?? null;
  const isWaiver = documentType === 'waiver';

  useEffect(() => {
    if (!isWaiver) return;
    setCustomText(defaultWaiverText(profile?.waiver_template));
  }, [isWaiver, profile?.waiver_template]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedTemplate) return;
    const topicText = topic.trim();
    const phone = normalizePhoneE164(recipientPhone);
    if (!topicText) {
      setError('Add a short topic describing what this document covers.');
      return;
    }
    if (!phone) {
      setError('Add a valid phone number.');
      return;
    }
    const waiverText = customText.trim();
    if (isWaiver && !waiverText) {
      setError('Paste or type the liability waiver language for this send.');
      return;
    }
    setError('');
    setSubmitting(true);

    const token = newDocumentToken();
    const { error: err } = await supabase.from('documents').insert({
      token,
      sender_id: user.id,
      recipient_name: recipientName.trim(),
      recipient_phone: phone,
      document_type: selectedTemplate.document_type,
      template_id: selectedTemplate.id,
      topic: topicText,
      custom_text: isWaiver ? waiverText : null,
      status: 'pending',
    });

    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    const link = documentViewUrl(token);
    setSuccess({ token, smsStatus: 'sending' });
    setSubmitting(false);

    const sms = await sendDocumentLink(token, link);
    if (!sms.ok) {
      setSuccess({ token, smsStatus: 'failed', smsError: sms.error });
      return;
    }
    setSuccess({ token, smsStatus: 'sent' });
  };

  if (success) {
    const link = documentViewUrl(success.token);
    return (
      <main className="p-4 md:p-8 max-w-lg">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
          <CheckCircle className="h-10 w-10 mx-auto text-emerald-500" />
          <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Document created</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            Share this link with <span className="font-medium text-gray-800 dark:text-slate-200">{recipientName}</span>.
          </p>
          <div className={`mt-4 rounded-xl px-4 py-3 text-left text-sm ${
            success.smsStatus === 'sent'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
              : success.smsStatus === 'failed'
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
              : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            <span className="inline-flex items-start gap-2">
              <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
              {success.smsStatus === 'sending' && `Sending SMS to ${recipientPhone}…`}
              {success.smsStatus === 'sent' && `SMS sent to ${recipientPhone}.`}
              {success.smsStatus === 'failed' && (success.smsError || 'SMS failed. Copy the link and share it manually.')}
            </span>
          </div>
          <p className="mt-4 text-xs font-mono break-all text-brand-600">{link}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-4 w-full min-h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <Link
            to="/dashboard/documents"
            className="mt-3 block w-full min-h-11 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-slate-300 leading-[2.75rem] text-center"
          >
            Back to documents
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 max-w-2xl pb-28 md:pb-8">
      <Link to="/dashboard/documents" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Documents
      </Link>
      <h1 className="mt-3 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">New document</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{HOLD_UP_COPY}</p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-3">Type</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SMB_DOCUMENT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDocumentType(t.id)}
                className={`rounded-xl border px-2 py-3 text-center min-h-14 ${
                  documentType === t.id
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                }`}
              >
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-[11px] mt-0.5 leading-snug hidden sm:block">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Recipient name</span>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              required
              className={fieldClass}
              placeholder="Jane Smith"
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Phone</span>
            <input
              type="tel"
              inputMode="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              onBlur={() => setRecipientPhone(blurFormatPhone(recipientPhone))}
              required
              className={fieldClass}
              placeholder={PHONE_PLACEHOLDER}
              autoComplete="tel"
            />
            <p className="mt-1 text-xs text-gray-400">{PHONE_HINT}</p>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Topic</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 150))}
              required
              maxLength={150}
              className={fieldClass}
              placeholder="Kitchen remodel deposit"
            />
            <p className="mt-1 text-xs text-gray-400">{topic.trim().length}/150 — shown on the confirmation page</p>
          </label>
        </div>

        {isWaiver ? (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Waiver language
              </span>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                required
                rows={12}
                className={`${fieldClass} min-h-[16rem] font-mono text-sm leading-relaxed`}
              />
            </label>
            <p className="mt-2 text-xs text-gray-400">
              Replace the starter text with language reviewed for your state and activity. This is what the recipient reads and signs — not the template default.
            </p>
          </div>
        ) : selectedTemplate ? (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
              Preview
            </p>
            <p className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-line">
              {topicCoverLine(topic) ? `${topicCoverLine(topic)}\n\n` : ''}
              {selectedTemplate.summary_text}
            </p>
          </div>
        ) : null}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !selectedTemplate}
          className="w-full min-h-12 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold inline-flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? 'Creating…' : 'Create & send SMS'}
        </button>
      </form>
    </main>
  );
}
