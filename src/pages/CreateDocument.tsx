import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Copy, Loader2, MessageSquare, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ContactAutocomplete } from '../components/ContactAutocomplete';
import type { ContactPickerSelection } from '../lib/contactPicker';
import { supabase } from '../lib/supabase';
import { PHONE_HINT, PHONE_PLACEHOLDER, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { revealTool } from '../lib/progressiveDisclosure';
import { quoteTotals } from '../lib/quoteMath';
import {
  validUntilFromDays,
  type QuotePayMode,
} from '../lib/quoteSms';
import { documentShowsPayLink, normalizeExternalUrl } from '../lib/paymentLink';
import { PaymentLinkFields } from '../components/PaymentLinkFields';
import {
  resolveDocsEntryMode,
  type DocsEntryMode,
} from '../lib/documentActions';
import {
  CONTRACT_HOST_HINT,
  WAIVER_HOST_HINT,
  SMB_DOCUMENT_TYPES,
  DOCUMENT_UPLOAD_BUCKET,
  DOCUMENT_UPLOAD_MAX_BYTES,
  DOCUMENT_UPLOAD_READABILITY_HINT,
  defaultDocumentBody,
  defaultWaiverText,
  defaultVerificationRequired,
  documentBodyIsEditable,
  documentUploadMaxLabel,
  documentViewUrl,
  fillDocumentPlaceholders,
  businessNameOptions,
  resolveHostBusinessName,
  isMoneyDocumentType,
  isSmbDocumentType,
  isUploadDocumentType,
  newDocumentToken,
  sendDocumentLink,
  signByTextAckLabel,
  signByTextScopeDetail,
  requiresSignByTextScopeCheckbox,
  summarizeDocumentTemplate,
} from '../lib/documents';
import {
  normalizePlainLanguageBullets,
} from '../lib/plainLanguageSummary';
import type { HostDocumentFile, HostDocumentTemplate } from '../lib/hostDocuments';
import { resolveRequireOtp } from '../lib/documentTypes';
import { QuoteLineItemRow } from '../components/QuoteLineItemRow';
import type { DocumentTemplate, HostQuoteLineItem, SmbDocumentType } from '../lib/types';

const LIBRARY_FILE_PREFIX = 'file:';

const fieldClass =
  'mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base';

type SmsStatus = 'idle' | 'sending' | 'sent' | 'failed';

function money(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateDocumentPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const actionParam = searchParams.get('action');
  const modeParam = searchParams.get('mode');
  const entryMode: DocsEntryMode = resolveDocsEntryMode(modeParam, actionParam);
  const initialType: SmbDocumentType =
    typeParam && isSmbDocumentType(typeParam) ? typeParam : 'nda';

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [hostOverrides, setHostOverrides] = useState<HostDocumentTemplate[]>([]);
  const [libraryFiles, setLibraryFiles] = useState<HostDocumentFile[]>([]);
  const [documentType, setDocumentType] = useState<SmbDocumentType>(initialType);
  const [libraryFileId, setLibraryFileId] = useState<string | null>(null);
  const [customTypeLabel, setCustomTypeLabel] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [recipientFirstName, setRecipientFirstName] = useState('');
  const [recipientLastName, setRecipientLastName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [phonePrompt, setPhonePrompt] = useState('');
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [activityOptions, setActivityOptions] = useState<string[]>([]);
  const businessNameHydrated = useRef(false);
  const [customText, setCustomText] = useState(() => defaultWaiverText());
  /** Default from ?mode= when present; otherwise from document type. */
  const [verificationRequired, setVerificationRequired] = useState(() =>
    modeParam === 'sign' || modeParam === 'send' || actionParam === 'sign' || actionParam === 'send'
      ? entryMode === 'sign'
      : defaultVerificationRequired(initialType),
  );
  const [items, setItems] = useState<HostQuoteLineItem[]>([{ description: '', amount: 0 }]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [payLabel, setPayLabel] = useState('Pay');
  const [validDays, setValidDays] = useState(30);
  const [payMode, setPayMode] = useState<QuotePayMode>('off');
  const [depositAmount, setDepositAmount] = useState('');
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    token: string;
    smsStatus: SmsStatus;
    smsError?: string;
    phone?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [scopeAcked, setScopeAcked] = useState(false);
  /** Cached for the recipient signing page only — not shown on this sender form. */
  const [plainSummary, setPlainSummary] = useState('');
  const [plainSummaryHash, setPlainSummaryHash] = useState('');
  const [plainSummaryTruncated, setPlainSummaryTruncated] = useState(false);
  const plainSummaryTimer = useRef<number | null>(null);
  const plainSummaryGen = useRef(0);
  const uploadMaxLabel = documentUploadMaxLabel();

  // Sync type from URL; verification follows type unless ?mode= forces sign/send.
  useEffect(() => {
    if (typeParam && isSmbDocumentType(typeParam)) {
      setDocumentType(typeParam);
      if (modeParam !== 'sign' && modeParam !== 'send' && actionParam !== 'sign' && actionParam !== 'send') {
        setVerificationRequired(resolveRequireOtp(typeParam, undefined, undefined));
      }
    } else if (!typeParam) {
      setDocumentType('nda');
    }
  }, [typeParam, actionParam, modeParam]);

  useEffect(() => {
    if (modeParam === 'sign' || modeParam === 'send') {
      setVerificationRequired(modeParam === 'sign');
    } else if (actionParam === 'sign' || actionParam === 'send') {
      setVerificationRequired(actionParam === 'sign');
    }
  }, [modeParam, actionParam]);

  useEffect(() => {
    void supabase
      .from('document_templates')
      .select('*')
      .then(({ data }) => setTemplates((data as DocumentTemplate[]) ?? []));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void Promise.all([
      supabase.from('host_document_templates').select('*').eq('host_id', user.id),
      supabase.from('host_document_files').select('*').eq('host_id', user.id).order('created_at', { ascending: false }),
    ]).then(([overridesRes, filesRes]) => {
      setHostOverrides((overridesRes.data as HostDocumentTemplate[]) ?? []);
      setLibraryFiles((filesRes.data as HostDocumentFile[]) ?? []);
    });
  }, [user?.id]);

  const selectedLibraryFile = libraryFileId
    ? libraryFiles.find((f) => f.id === libraryFileId) ?? null
    : null;
  const selectedTemplate = templates.find((t) => t.document_type === documentType) ?? null;
  const hostOverride = hostOverrides.find((o) => o.document_type === documentType) ?? null;
  const hostOverrideText = hostOverride?.full_text?.trim() || null;
  const isWaiver = documentType === 'waiver';
  const isUpload = isUploadDocumentType(documentType);
  const isLibraryPdf = Boolean(selectedLibraryFile);
  const isMoney = isMoneyDocumentType(documentType);
  const isQuote = documentType === 'quote';
  const showPayLink = documentShowsPayLink(documentType);
  const phoneRequired = verificationRequired || isQuote;
  const bodyEditable = documentBodyIsEditable(documentType) && !isLibraryPdf;
  const typeSelectValue = libraryFileId ? `${LIBRARY_FILE_PREFIX}${libraryFileId}` : documentType;
  const recipientName = `${recipientFirstName.trim()} ${recipientLastName.trim()}`.trim();
  const scopeAlreadyAccepted = Boolean(profile?.sign_by_text_scope_accepted_at);
  const needsScopeCheckbox = requiresSignByTextScopeCheckbox({
    isUpload,
    scopeAlreadyAccepted,
  });
  const knownBusinessNames = useMemo(
    () => businessNameOptions([
      profile?.business_name,
      profile?.paid_booking_settings?.display_name,
      profile?.full_name,
    ]),
    [profile?.business_name, profile?.paid_booking_settings?.display_name, profile?.full_name],
  );

  useEffect(() => {
    if (isUpload) setScopeAcked(false);
  }, [isUpload, libraryFileId]);

  useEffect(() => {
    if (businessNameHydrated.current) return;
    const resolved = resolveHostBusinessName(profile);
    if (!resolved) return;
    setBusinessName(resolved);
    businessNameHydrated.current = true;
  }, [profile, knownBusinessNames]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from('services')
      .select('name')
      .eq('host_id', user.id)
      .eq('is_active', true)
      .then(({ data }) => {
        const names = (data ?? [])
          .map((row) => String((row as { name?: string }).name ?? '').trim())
          .filter(Boolean);
        setActivityOptions([...new Set(names)]);
      });
  }, [user?.id]);

  useEffect(() => {
    if (isLibraryPdf) return;
    if (isWaiver) {
      setCustomText(defaultWaiverText(hostOverrideText || profile?.waiver_template));
      return;
    }
    if (bodyEditable) {
      setCustomText(hostOverrideText || selectedTemplate?.full_text?.trim() || defaultDocumentBody(documentType));
    }
  }, [
    documentType,
    isWaiver,
    isLibraryPdf,
    bodyEditable,
    hostOverrideText,
    profile?.waiver_template,
    selectedTemplate?.full_text,
  ]);

  // Seed / refresh summary cache for the recipient (not shown on this page).
  useEffect(() => {
    if (isUpload || isLibraryPdf) {
      setPlainSummary('');
      setPlainSummaryHash('');
      setPlainSummaryTruncated(false);
      return;
    }
    const src = hostOverride ?? selectedTemplate;
    setPlainSummary(src?.plain_language_summary?.trim() || '');
    setPlainSummaryHash(src?.plain_language_source_hash?.trim() || '');
    setPlainSummaryTruncated(Boolean(src?.plain_language_truncated));
  }, [documentType, isUpload, isLibraryPdf, hostOverride, selectedTemplate]);

  // Debounced generate in the background for any template text (never uploads).
  useEffect(() => {
    if (isUpload || isLibraryPdf) return;
    const text = (
      bodyEditable
        ? customText
        : hostOverrideText || selectedTemplate?.full_text || defaultDocumentBody(documentType)
    ).trim();
    if (!text) return;

    if (plainSummaryTimer.current) window.clearTimeout(plainSummaryTimer.current);
    plainSummaryTimer.current = window.setTimeout(() => {
      const gen = ++plainSummaryGen.current;
      void summarizeDocumentTemplate({
        fullText: text,
        existingHash: plainSummaryHash,
        existingSummary: plainSummary,
      }).then(({ data, error }) => {
        if (gen !== plainSummaryGen.current) return;
        if (error || !data?.ok) return;
        setPlainSummary(data.summary_text || normalizePlainLanguageBullets(data.summary ?? []));
        if (data.hash) setPlainSummaryHash(data.hash);
        setPlainSummaryTruncated(Boolean(data.truncated));
      });
    }, 900);

    return () => {
      if (plainSummaryTimer.current) window.clearTimeout(plainSummaryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customText,
    documentType,
    isUpload,
    isLibraryPdf,
    bodyEditable,
    hostOverrideText,
    selectedTemplate?.full_text,
  ]);

  useEffect(() => {
    if (defaultsApplied || !profile) return;
    if (!isMoney && !showPayLink) return;
    setDefaultsApplied(true);
    if (isMoney && profile.quote_line_defaults?.length) {
      setItems(profile.quote_line_defaults.map((i) => ({
        description: i.description,
        amount: Number(i.amount) || 0,
      })));
    }
    if (isMoney) setTaxPercent(Number(profile.default_tax_percent) || 0);
    if (isQuote) {
      setValidDays(Math.max(1, Number(profile.default_quote_valid_days) || 30));
      if (profile.default_pay_url) setPayMode('full');
      if (profile.default_pay_label) setPayLabel(profile.default_pay_label);
      else setPayLabel('Pay Now');
    }
    if (showPayLink) {
      if (profile.default_pay_url) setPayUrl(profile.default_pay_url);
      if (profile.default_pay_label && !isQuote) setPayLabel(profile.default_pay_label);
    }
  }, [profile, defaultsApplied, isMoney, isQuote, showPayLink]);

  const { subtotal, taxAmount, total } = useMemo(
    () => quoteTotals(items, taxPercent),
    [items, taxPercent],
  );

  const filledBody = useMemo(
    () => fillDocumentPlaceholders(
      customText || hostOverrideText || selectedTemplate?.full_text || defaultDocumentBody(documentType),
      {
        topic,
        recipientName,
        businessName,
        activityDescription: topic,
      },
    ),
    [customText, hostOverrideText, selectedTemplate?.full_text, documentType, topic, recipientName, businessName],
  );

  const handleTypeChange = (next: SmbDocumentType) => {
    setLibraryFileId(null);
    setDocumentType(next);
    setVerificationRequired(resolveRequireOtp(next, hostOverrides.find((o) => o.document_type === next), templates.find((t) => t.document_type === next)));
    if (next !== 'upload') setUploadFile(null);
    if (next !== 'other') setCustomTypeLabel('');
    const q = new URLSearchParams({ type: next });
    navigate(`/dashboard/documents/new?${q.toString()}`, { replace: true });
  };

  const handleTypeSelect = (value: string) => {
    if (value.startsWith(LIBRARY_FILE_PREFIX)) {
      const id = value.slice(LIBRARY_FILE_PREFIX.length);
      setLibraryFileId(id);
      setDocumentType('upload');
      setVerificationRequired(resolveRequireOtp('upload', hostOverrides.find((o) => o.document_type === 'upload'), templates.find((t) => t.document_type === 'upload')));
      setUploadFile(null);
      setCustomTypeLabel('');
      const q = new URLSearchParams({ type: 'upload' });
      navigate(`/dashboard/documents/new?${q.toString()}`, { replace: true });
      return;
    }
    handleTypeChange(value as SmbDocumentType);
  };

  const handleUploadPick = (file: File | null) => {
    setError('');
    if (!file) {
      setUploadFile(null);
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Upload a PDF only (export Word to PDF first).');
      setUploadFile(null);
      return;
    }
    if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
      setError(`PDF must be ${formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)} or smaller.`);
      setUploadFile(null);
      return;
    }
    setUploadFile(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedTemplate) return;
    const libraryName = selectedLibraryFile?.name?.trim();
    const topicText = topic.trim();
    const phone = recipientPhone.trim() ? normalizePhoneE164(recipientPhone) : null;
    const resolvedName = recipientName.trim() || (isQuote ? 'Customer' : '');
    if (documentType === 'other' && !customTypeLabel.trim()) {
      setError('Enter a custom document type.');
      return;
    }
    if (isUpload && !isLibraryPdf && !uploadFile) {
      setError('Choose a PDF to send for signature.');
      return;
    }
    if (!isQuote && !recipientFirstName.trim()) {
      setError('Add the recipient’s first name.');
      return;
    }
    if (needsScopeCheckbox && !scopeAcked) {
      setError('Confirm you understand Sign-by-Text scope before sending.');
      return;
    }
    if (!topicText && !isQuote) {
      setError(isWaiver
        ? 'Add the activity or service this waiver covers.'
        : 'Add a short topic describing what this document covers.');
      return;
    }
    if (!businessName.trim()) {
      setError('Add your business name — it appears as “from …” on the document. You can also save it in Settings → Profile.');
      return;
    }
    if (isQuote && !phone) {
      setError('Customer phone is required so we can text the quote.');
      phoneInputRef.current?.focus();
      return;
    }
    if (verificationRequired && !phone) {
      setError('Add a valid phone number so the recipient can verify.');
      phoneInputRef.current?.focus();
      return;
    }
    if (recipientPhone.trim() && !phone) {
      setError('Add a valid phone number, or leave it blank.');
      return;
    }
    const waiverText = customText.trim();
    if (isWaiver && !waiverText) {
      setError('Paste or type the liability waiver language for this send.');
      return;
    }
    if (bodyEditable && !customText.trim()) {
      setError('Add the document text for this send.');
      return;
    }
    const lineItems = isMoney
      ? items.filter((i) => i.description.trim() || i.amount)
      : [];
    if (isQuote && !lineItems.length) {
      setError('Add at least one line.');
      return;
    }
    if (isQuote && payMode !== 'off' && !normalizeExternalUrl(payUrl)) {
      setError('Paste your Zelle, Cash App, Venmo, or PayPal link for Pay Now.');
      return;
    }
    const depositCents = Math.round((Number(depositAmount) || 0) * 100);
    if (isQuote && payMode === 'deposit' && depositCents <= 0) {
      setError('Enter a deposit amount.');
      return;
    }
    setError('');
    setSubmitting(true);

    const token = newDocumentToken();
    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    if (isLibraryPdf && selectedLibraryFile) {
      filePath = `${user.id}/${token}.pdf`;
      fileName = selectedLibraryFile.file_name.slice(0, 200);
      fileSize = selectedLibraryFile.file_size_bytes;
      const { data: blob, error: dlErr } = await supabase.storage
        .from(DOCUMENT_UPLOAD_BUCKET)
        .download(selectedLibraryFile.file_path);
      if (dlErr || !blob) {
        setError(dlErr?.message || 'Could not load your saved PDF. Try again or re-upload it in Settings → Docs.');
        setSubmitting(false);
        return;
      }
      const { error: upErr } = await supabase.storage
        .from(DOCUMENT_UPLOAD_BUCKET)
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (upErr) {
        setError(upErr.message || 'Could not prepare the PDF for this send. Try again.');
        setSubmitting(false);
        return;
      }
    } else if (isUpload && uploadFile) {
      filePath = `${user.id}/${token}.pdf`;
      fileName = uploadFile.name.slice(0, 200);
      fileSize = uploadFile.size;
      const { error: upErr } = await supabase.storage
        .from(DOCUMENT_UPLOAD_BUCKET)
        .upload(filePath, uploadFile, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (upErr) {
        setError(upErr.message || 'Could not upload the PDF. Try again.');
        setSubmitting(false);
        return;
      }
    }

    const resolvedTopic = topicText || (isQuote ? (lineItems[0]?.description.trim() || 'Quote') : topicText);
    const bodySource = bodyEditable
      ? customText.trim()
      : (hostOverrideText || selectedTemplate.full_text?.trim() || defaultDocumentBody(documentType));
    const bodyForSave = fillDocumentPlaceholders(bodySource || '', {
      topic: resolvedTopic,
      recipientName: resolvedName,
      businessName: businessName.trim(),
      activityDescription: resolvedTopic,
    });

    // Display-only for the recipient signing page (never for uploads; never in the audit/certificate).
    const copyPlainSummary = !isUpload && Boolean(plainSummary.trim());
    const moneyTotals = quoteTotals(lineItems, taxPercent);
    const payAmountCents = isQuote
      ? (payMode === 'deposit' ? depositCents : payMode === 'full' ? Math.round(moneyTotals.total * 100) : null)
      : null;
    const quotePayUrl = isQuote
      ? (payMode === 'off' ? null : normalizeExternalUrl(payUrl))
      : (showPayLink ? normalizeExternalUrl(payUrl) : null);
    const quotePayLabel = isQuote
      ? (payMode === 'off' ? null : (payLabel.trim() || 'Pay Now'))
      : (showPayLink ? (payLabel.trim() || 'Pay') : null);

    const { error: err } = await supabase.from('documents').insert({
      token,
      sender_id: user.id,
      recipient_name: resolvedName,
      recipient_phone: phone,
      recipient_email: recipientEmail.trim() || null,
      document_type: selectedTemplate.document_type,
      document_type_custom: documentType === 'other'
        ? customTypeLabel.trim()
        : (isLibraryPdf ? (libraryName || null) : null),
      template_id: selectedTemplate.id,
      topic: resolvedTopic,
      custom_text: isUpload ? null : (bodyForSave || null),
      status: 'pending',
      verification_required: verificationRequired,
      line_items: lineItems,
      tax_percent: isMoney ? Number(taxPercent) || 0 : 0,
      notes: isMoney ? notes.trim() || null : null,
      pay_elsewhere_url: quotePayUrl,
      pay_elsewhere_label: quotePayLabel,
      ...(isQuote ? {
        pay_mode: payMode,
        pay_amount_cents: payAmountCents,
        valid_until: validUntilFromDays(validDays),
      } : {}),
      currency: 'USD',
      file_path: filePath,
      file_name: fileName,
      file_size_bytes: fileSize,
      plain_language_summary: copyPlainSummary ? normalizePlainLanguageBullets(plainSummary) : null,
      plain_language_truncated: copyPlainSummary ? plainSummaryTruncated : false,
    });

    if (err) {
      if (filePath) {
        await supabase.storage.from(DOCUMENT_UPLOAD_BUCKET).remove([filePath]);
      }
      setError(err.message);
      setSubmitting(false);
      return;
    }

    // Persist business name on the profile when the host hasn't set one yet.
    if (user.id && businessName.trim() && !profile?.business_name?.trim()) {
      await supabase.from('profiles').update({ business_name: businessName.trim() }).eq('id', user.id);
      await refreshProfile();
    }

    if (user.id && needsScopeCheckbox && scopeAcked && !scopeAlreadyAccepted) {
      await supabase
        .from('profiles')
        .update({ sign_by_text_scope_accepted_at: new Date().toISOString() })
        .eq('id', user.id);
      await refreshProfile();
    }

    const link = documentViewUrl(token);
    setSuccess({ token, smsStatus: phone ? 'sending' : 'idle', phone: recipientPhone || undefined });
    setSubmitting(false);

    if (isMoney) {
      await revealTool(user.id, 'quotes', profile?.revealed_tools);
      await refreshProfile();
    }

    if (!phone) return;
    const sms = await sendDocumentLink(token, link, documentType === 'quote' ? 'quote' : 'link');
    if (!sms.ok) {
      setSuccess({ token, smsStatus: 'failed', smsError: sms.error, phone: recipientPhone });
      return;
    }
    setSuccess({ token, smsStatus: 'sent', phone: recipientPhone });
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
          {success.smsStatus !== 'idle' && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-left text-sm ${
              success.smsStatus === 'sent'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                : success.smsStatus === 'failed'
                ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              <span className="inline-flex items-start gap-2">
                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                {success.smsStatus === 'sending' && `Sending SMS to ${success.phone}…`}
                {success.smsStatus === 'sent' && `SMS sent to ${success.phone}.`}
                {success.smsStatus === 'failed' && (success.smsError || 'SMS failed. Copy the link and share it manually.')}
              </span>
            </div>
          )}
          {success.smsStatus === 'idle' && (
            <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">
              No phone on this send — copy the link and share it by email or text.
            </p>
          )}
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
            Back to Doc Center
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 max-w-2xl pb-28 md:pb-8">
      <Link to="/dashboard/documents" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        All documents
      </Link>
      <h1 className="mt-3 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
        {isQuote ? 'New quote' : 'New document'}
      </h1>
      {isQuote && (
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Price it, text it, they approve. Pay with their Zelle / Cash App / Venmo / PayPal.
        </p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Document Type</span>
            <select
              value={typeSelectValue}
              onChange={(e) => handleTypeSelect(e.target.value)}
              className={fieldClass}
            >
              {SMB_DOCUMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              {libraryFiles.length > 0 && (
                <optgroup label="Saved PDFs">
                  {libraryFiles.map((f) => (
                    <option key={f.id} value={`${LIBRARY_FILE_PREFIX}${f.id}`}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Built-in types use your Settings → Docs defaults when saved. Named PDFs come from your library there.
            </p>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-950/20 px-3 py-3">
            <input
              type="checkbox"
              checked={verificationRequired}
              onChange={(e) => setVerificationRequired(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                Require SMS verification code
              </span>
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-400">
                {verificationRequired
                  ? 'They enter a 6-digit code we text to the same number, then sign. Default on for waivers, NDAs, and contracts — you can change this per template in Settings → Docs.'
                  : 'No extra code. They already got the link by text. They still sign and check ESIGN consent. Default for quotes and invoices.'}
              </span>
            </span>
          </label>
          {documentType === 'other' && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Custom document type</span>
              <input
                value={customTypeLabel}
                onChange={(e) => setCustomTypeLabel(e.target.value)}
                required
                maxLength={80}
                className={fieldClass}
                placeholder="e.g. Equipment checkout form"
                autoComplete="off"
              />
            </label>
          )}
          {isUpload && isLibraryPdf && selectedLibraryFile && (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 px-3 py-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedLibraryFile.name}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                Saved PDF · {selectedLibraryFile.file_name} · {formatBytes(selectedLibraryFile.file_size_bytes)}
              </p>
            </div>
          )}
          {isUpload && !isLibraryPdf && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">PDF to sign</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => handleUploadPick(e.target.files?.[0] ?? null)}
                className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700`}
              />
              <p className="mt-1 text-xs text-gray-400">
                PDF only, up to {formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)}. Word docs: export as PDF first.
                {uploadFile ? ` Selected: ${uploadFile.name} (${formatBytes(uploadFile.size)}).` : ''}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {DOCUMENT_UPLOAD_READABILITY_HINT}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                They get a text, enter a 2FA code, then sign with their finger — same simple flow as NDA/waiver.
                Save reusable PDFs under Settings → Docs.
              </p>
            </label>
          )}
          {isUpload && needsScopeCheckbox && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1.5">
                Sign-by-Text scope
              </p>
              <textarea
                readOnly
                value={signByTextScopeDetail(uploadMaxLabel)}
                rows={4}
                className="w-full resize-none rounded-lg border border-amber-200/70 dark:border-amber-700/60 bg-white/80 dark:bg-slate-900 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200 leading-relaxed"
              />
            </div>
          )}
          {needsScopeCheckbox ? (
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-3">
              <input
                type="checkbox"
                checked={scopeAcked}
                onChange={(e) => setScopeAcked(e.target.checked)}
                className="mt-1"
                required
              />
              <span className="text-sm text-gray-800 dark:text-slate-100 leading-relaxed">
                {signByTextAckLabel(uploadMaxLabel)}
              </span>
            </label>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 space-y-4">
          <ContactAutocomplete
            hostId={user?.id}
            onSelect={(c: ContactPickerSelection) => {
              setRecipientFirstName(c.firstName);
              setRecipientLastName(c.lastName);
              setRecipientEmail(c.email);
              setRecipientPhone(c.phone);
              if (!c.phone) {
                setPhonePrompt('This contact has no mobile number. Enter one so we can send by text.');
                window.requestAnimationFrame(() => phoneInputRef.current?.focus());
              } else {
                setPhonePrompt('');
              }
            }}
            onClear={() => {
              setRecipientFirstName('');
              setRecipientLastName('');
              setRecipientEmail('');
              setRecipientPhone('');
              setPhonePrompt('');
            }}
          />
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
              Recipient name {isQuote ? '(optional)' : <span className="text-red-500">*</span>}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <input
                value={recipientFirstName}
                onChange={(e) => setRecipientFirstName(e.target.value)}
                required={!isQuote}
                className={fieldClass.replace('mt-1 ', '')}
                placeholder="Jane"
                autoComplete="given-name"
                aria-label="Recipient first name"
              />
              <input
                value={recipientLastName}
                onChange={(e) => setRecipientLastName(e.target.value)}
                className={fieldClass.replace('mt-1 ', '')}
                placeholder="Smith"
                autoComplete="family-name"
                aria-label="Recipient last name"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {isQuote
                ? 'Optional. Fills the quote greeting; we use “Customer” if you skip it.'
                : 'Fills [Recipient Name] in the document below as you type. Last name is optional.'}
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Email (optional)</span>
            <input
              type="email"
              inputMode="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className={fieldClass}
              placeholder="jane@email.com"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
              Phone {phoneRequired ? <span className="text-red-500">*</span> : '(optional)'}
            </span>
            <input
              ref={phoneInputRef}
              id="document-recipient-phone"
              type="tel"
              inputMode="tel"
              value={recipientPhone}
              onChange={(e) => {
                setRecipientPhone(e.target.value);
                if (e.target.value.trim()) setPhonePrompt('');
              }}
              onBlur={() => setRecipientPhone(blurFormatPhone(recipientPhone))}
              required={phoneRequired}
              className={`${fieldClass} ${phonePrompt ? 'border-amber-400 focus:ring-amber-500' : ''}`}
              placeholder={PHONE_PLACEHOLDER}
              autoComplete="tel"
            />
            {phonePrompt ? (
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">{phonePrompt}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                {isQuote
                  ? PHONE_HINT
                  : verificationRequired
                    ? PHONE_HINT
                    : 'Needed only if you want us to text the link, or if signature & 2FA is on.'}
              </p>
            )}
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
              {isWaiver ? 'Activity / service description' : 'Topic'}{' '}
              {isQuote ? '(optional)' : <span className="text-red-500">*</span>}
            </span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 150))}
              required={!isQuote}
              maxLength={150}
              list="document-activity-options"
              className={fieldClass}
              placeholder={isWaiver ? 'e.g. kitchen remodel, zip-line tour' : isMoney ? 'Kitchen remodel' : isUpload ? 'e.g. Kitchen remodel PDF' : 'Kitchen remodel deposit'}
            />
            <datalist id="document-activity-options">
              {activityOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-400">
              {topic.trim().length}/150
              {isWaiver
                ? ' — fills [Activity/Service Description] in the waiver'
                : isUpload
                ? ' — shown above the PDF'
                : ' — shown on the confirmation page'}
              
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
              {documentType === 'nda'
                ? 'Disclosing Party (sender name or company)'
                : documentType === 'contract'
                  ? 'Provider name (sender or company)'
                  : 'Business / sender name'}
            </span>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value.slice(0, 120))}
              required
              maxLength={120}
              className={fieldClass}
              placeholder="Your company, DBA, or sender name"
            />
            {knownBusinessNames.filter((name) => name !== businessName).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {knownBusinessNames.filter((name) => name !== businessName).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setBusinessName(name)}
                    className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-slate-300"
                  >
                    Use {name}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Required. This fills sender/disclosing-party fields (like NDA) and shows as “from …” on the document.
            </p>
          </label>
        </div>

        {isMoney && (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">Line items</span>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { description: '', amount: 0 }])}
                className="min-h-10 px-3 text-sm font-semibold text-brand-600 inline-flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <QuoteLineItemRow
                  key={i}
                  item={item}
                  canRemove={items.length > 1}
                  onChange={(next) => setItems((prev) => prev.map((row, idx) => (idx === i ? next : row)))}
                  onRemove={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Tax %</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={taxPercent || ''}
                  onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
                  className={fieldClass}
                  placeholder="0"
                />
              </label>
              <div className="flex flex-col justify-end rounded-xl bg-gray-50 dark:bg-slate-800 px-3 py-3 text-sm">
                <span className="text-xs text-gray-500">Tax amount</span>
                <span className="font-semibold text-gray-900 dark:text-white">{money(taxAmount)}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-slate-300">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              {taxPercent > 0 && (
                <div className="flex justify-between"><span>Tax ({taxPercent}%)</span><span>{money(taxAmount)}</span></div>
              )}
              <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-white pt-1">
                <span>Total</span><span>{money(total)}</span>
              </div>
            </div>
            <label className="block mt-5">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Note (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={fieldClass}
                placeholder="Due Friday. Cash, check, or PayPal."
              />
            </label>
          </div>
        )}

        {isQuote && (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Valid for (days)</span>
              <input
                type="number"
                min="1"
                max="365"
                value={validDays}
                onChange={(e) => setValidDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
                className={`${fieldClass} w-32`}
              />
              <p className="mt-1 text-xs text-gray-400">Default 30. After that they see expired — contact you — instead of Approve.</p>
            </label>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Pay after they approve</p>
              <p className="mt-1 text-xs text-gray-500">Your Zelle / Cash App / Venmo / PayPal. We never take the payment.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([
                  ['off', 'Off'],
                  ['full', 'Full'],
                  ['deposit', 'Deposit'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPayMode(id)}
                    className={`min-h-11 rounded-xl text-sm font-semibold border ${
                      payMode === id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {payMode === 'deposit' && (
                <label className="block mt-3">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Deposit amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className={fieldClass}
                    placeholder="150"
                  />
                </label>
              )}
              {payMode !== 'off' && (
                <div className="mt-3">
                  <PaymentLinkFields url={payUrl} label={payLabel} onUrlChange={setPayUrl} onLabelChange={setPayLabel} />
                </div>
              )}
            </div>
          </div>
        )}

        {showPayLink && !isQuote && (
          <PaymentLinkFields
            url={payUrl}
            label={payLabel}
            onUrlChange={setPayUrl}
            onLabelChange={setPayLabel}
          />
        )}

        {bodyEditable ? (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
                {isWaiver ? 'Waiver language' : 'Full document text'}
              </span>
              {isWaiver ? (
                <p className="mt-2 mb-3 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                  {WAIVER_HOST_HINT} Recipient name, activity, and business name above fill the brackets. You can still edit this send, or save a default in{' '}
                  <Link to="/dashboard/settings?tab=docs" className="font-semibold text-brand-600 hover:text-brand-700">
                    Settings → Docs
                  </Link>
                  .
                </p>
              ) : documentType === 'contract' ? (
                <>
                  <div className="mt-2 mb-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">Warning</p>
                    <p className="mt-1">{CONTRACT_HOST_HINT}</p>
                  </div>
                  <p className="mt-1 mb-3 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                    This is what they see and sign. Topic and recipient name fill in from the fields above.
                  </p>
                </>
              ) : (
                <p className="mt-2 mb-3 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                  This is what they see and sign. Topic and recipient name fill in from the fields above.
                </p>
              )}

              <p className="mt-1 mb-3 text-sm text-gray-800 dark:text-slate-100 whitespace-pre-line leading-relaxed rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-3">
                {filledBody}
              </p>
              <span className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Edit full text</span>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                required
                rows={8}
                className={`${fieldClass} min-h-[10rem] font-mono text-sm leading-relaxed`}
              />
            </label>
          </div>
        ) : !isUpload && selectedTemplate ? (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
              Full text they will see
            </p>
            <p className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {fillDocumentPlaceholders(
                hostOverrideText || selectedTemplate.full_text || defaultDocumentBody(documentType),
                {
                  topic,
                  recipientName,
                  businessName,
                  activityDescription: topic,
                },
              )}
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
          {submitting ? 'Creating…' : isQuote || recipientPhone.trim() ? 'Create & send SMS' : 'Create & copy link'}
        </button>
      </form>
    </main>
  );
}
