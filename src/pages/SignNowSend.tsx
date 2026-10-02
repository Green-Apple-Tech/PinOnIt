import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  DOCUMENT_UPLOAD_BUCKET,
  documentUploadMaxLabel,
} from '../lib/documentTypes';
import {
  documentViewUrl,
  fillDocumentPlaceholders,
  newDocumentToken,
  sendDocumentLink,
} from '../lib/documents';
import { signByTextAckLabel } from '../lib/documentCopy';
import { saveHostPdfTemplate } from '../lib/hostDocumentFiles';
import { normalizePhoneE164 } from '../shared/phone';
import {
  SIGN_NOW_TEXT_MAX,
  countPdfFilePages,
  signNowTopic,
} from '../lib/signNow';

const fieldClass =
  'mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base text-gray-900 dark:text-white';

type Mode = 'paste' | 'pdf';

export function SignNowSendPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [theirName, setTheirName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [seededBusiness, setSeededBusiness] = useState(false);
  const [mode, setMode] = useState<Mode>('paste');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [scopeAcked, setScopeAcked] = useState(false);
  const [templateIds, setTemplateIds] = useState<{ paste: string | null; pdf: string | null }>({ paste: null, pdf: null });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ link: string; sms: 'sent' | 'failed'; smsError?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const scopeAlreadyAccepted = Boolean(profile?.sign_by_text_scope_accepted_at);

  useEffect(() => {
    if (seededBusiness || !profile) return;
    setBusinessName(profile.business_name?.trim() || profile.full_name?.trim() || '');
    setSeededBusiness(true);
  }, [profile, seededBusiness]);

  useEffect(() => {
    void supabase
      .from('document_templates')
      .select('id, document_type')
      .in('document_type', ['quick_addendum', 'upload'])
      .then(({ data }) => {
        const rows = (data ?? []) as { id: string; document_type: string }[];
        setTemplateIds({
          paste: rows.find((row) => row.document_type === 'quick_addendum')?.id ?? null,
          pdf: rows.find((row) => row.document_type === 'upload')?.id ?? null,
        });
      });
  }, []);

  const onPickFile = async (next: File | null) => {
    setError('');
    setPageCount(null);
    if (!next) {
      setFile(null);
      return;
    }
    const rejectFile = (message: string, count: number | null = null) => {
      setFile(null);
      setPageCount(count);
      setError(message);
      if (fileRef.current) fileRef.current.value = '';
    };
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      rejectFile('Upload a PDF. Export Word to PDF first.');
      return;
    }
    const count = await countPdfFilePages(next);
    if (count == null) {
      rejectFile('This PDF’s page count could not be read. Export it again as a one-page PDF.');
      return;
    }
    if (count !== 1) {
      rejectFile(`This PDF has ${count} pages. This screen sends one page. Longer files go in Documents.`, count);
      return;
    }
    setFile(next);
    setPageCount(1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setError('');
    const name = theirName.trim();
    const normalized = normalizePhoneE164(phone);
    const business = businessName.trim();
    const pasted = body.trim();
    if (!name) {
      setError('Add their name.');
      return;
    }
    if (!/^\+[1-9]\d{9,14}$/.test(normalized)) {
      setError('Add a mobile number so we can text the link.');
      return;
    }
    if (!business) {
      setError('Add your business name. It shows on the document.');
      return;
    }
    if (!scopeAlreadyAccepted && !scopeAcked) {
      setError('Confirm what Sign-by-Text is for before sending.');
      return;
    }
    if (mode === 'paste' && !pasted) {
      setError('Paste the one-page document.');
      return;
    }
    if (mode === 'paste' && pasted.length > SIGN_NOW_TEXT_MAX) {
      setError(`Keep the text to one page (${SIGN_NOW_TEXT_MAX.toLocaleString()} characters).`);
      return;
    }
    if (mode === 'pdf' && !file) {
      setError('Choose a one-page PDF.');
      return;
    }
    const templateId = mode === 'paste' ? templateIds.paste : templateIds.pdf;
    if (!templateId) {
      setError('This document type is not ready yet. Reload the page and try again.');
      return;
    }

    setSubmitting(true);
    const token = newDocumentToken();
    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    if (mode === 'pdf' && file) {
      const saved = await saveHostPdfTemplate({ hostId: user.id, file, name: signNowTopic('', file.name) });
      if (saved.error || !saved.data) {
        setError(saved.error?.message || 'Could not save this PDF.');
        setSubmitting(false);
        return;
      }
      filePath = `${user.id}/${token}.pdf`;
      fileName = file.name.slice(0, 200);
      fileSize = file.size;
      const { error: upErr } = await supabase.storage.from(DOCUMENT_UPLOAD_BUCKET).upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (upErr) {
        setError(upErr.message || 'Could not prepare the PDF. Try again.');
        setSubmitting(false);
        return;
      }
    }

    const topic = signNowTopic(mode === 'paste' ? pasted : '', file?.name);
    const customText = mode === 'paste'
      ? fillDocumentPlaceholders(pasted, { topic, recipientName: name, businessName: business, activityDescription: topic })
      : null;

    const { error: insertError } = await supabase.from('documents').insert({
      token,
      sender_id: user.id,
      recipient_name: name,
      recipient_phone: normalized,
      recipient_email: null,
      document_type: mode === 'paste' ? 'quick_addendum' : 'upload',
      document_type_custom: null,
      template_id: templateId,
      topic,
      custom_text: customText,
      status: 'pending',
      verification_required: true,
      line_items: [],
      tax_percent: 0,
      notes: null,
      pay_elsewhere_url: null,
      pay_elsewhere_label: null,
      currency: 'USD',
      file_path: filePath,
      file_name: fileName,
      file_size_bytes: fileSize,
      plain_language_summary: null,
      plain_language_truncated: false,
    });

    if (insertError) {
      if (filePath) await supabase.storage.from(DOCUMENT_UPLOAD_BUCKET).remove([filePath]);
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    if (!profile?.business_name?.trim()) {
      await supabase.from('profiles').update({ business_name: business }).eq('id', user.id);
      await refreshProfile();
    }
    if (!scopeAlreadyAccepted) {
      await supabase.from('profiles').update({ sign_by_text_scope_accepted_at: new Date().toISOString() }).eq('id', user.id);
      await refreshProfile();
    }

    const link = documentViewUrl(token);
    const sms = await sendDocumentLink(token, link, 'link');
    setSuccess({ link, sms: sms.ok ? 'sent' : 'failed', smsError: sms.ok ? undefined : sms.error });
    setSubmitting(false);
  };

  return (
    <>
      {success && (
        <main className="p-4 md:p-8 max-w-2xl pb-28 md:pb-8">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {success.sms === 'sent' ? 'Text sent' : 'Link is ready'}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              {success.sms === 'sent'
                ? 'They can sign from the link in that text. No app and no account on their end.'
                : success.smsError || 'The text did not send. Copy the link and send it yourself.'}
            </p>
            <p className="mt-4 text-xs font-mono break-all text-brand-600">{success.link}</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(success.link);
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
              Back to Documents
            </Link>
          </div>
        </main>
      )}
      <div hidden={success != null}>
        <main className="p-4 md:p-8 max-w-2xl pb-28 md:pb-8">
          <Link to="/sign-now" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Sign one page by text
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Sign a document now</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            One page. One signer. They get a text, enter a code, and sign. No app and no account for them.
          </p>
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
              Their name
              <input value={theirName} onChange={(e) => setTheirName(e.target.value)} required autoComplete="name" className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
              Their mobile number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" inputMode="tel" autoComplete="tel" placeholder="(305) 555-0100" className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
              Your business name
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value.slice(0, 120))} required maxLength={120} className={fieldClass} />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode('paste'); setError(''); }}
                className={`min-h-11 px-4 rounded-full text-sm font-semibold border ${mode === 'paste' ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200'}`}
              >
                Paste the page
              </button>
              <button
                type="button"
                onClick={() => { setMode('pdf'); setError(''); }}
                className={`min-h-11 px-4 rounded-full text-sm font-semibold border ${mode === 'pdf' ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200'}`}
              >
                Upload a one-page PDF
              </button>
            </div>
            {mode === 'paste' ? (
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                Document
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, SIGN_NOW_TEXT_MAX + 200))}
                  rows={10}
                  className={fieldClass}
                  placeholder="Paste the agreement, waiver, or approval."
                />
                <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
                  {body.trim().length.toLocaleString()} / {SIGN_NOW_TEXT_MAX.toLocaleString()} characters. One page.
                </span>
              </label>
            ) : (
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                One-page PDF
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700`}
                  onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                />
                <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
                  PDF only, one page, up to {documentUploadMaxLabel()}.
                  {pageCount === 1 && file ? ` ${file.name} is one page.` : ''}
                </span>
              </label>
            )}
            {!scopeAlreadyAccepted && (
              <label className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-slate-300">
                <input type="checkbox" checked={scopeAcked} onChange={(e) => setScopeAcked(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300" />
                <span>{signByTextAckLabel(documentUploadMaxLabel())}</span>
              </label>
            )}
            {error && <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-12 rounded-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-bold inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Text them the link
            </button>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Need more than one page?{' '}
              <Link to="/dashboard/documents/new" className="underline underline-offset-2">Use Documents</Link>
              . After this, share your booking link so they can pick a time.
            </p>
          </form>
        </main>
      </div>
    </>
  );
}
