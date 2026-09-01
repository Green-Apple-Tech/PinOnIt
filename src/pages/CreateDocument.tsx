import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Copy, Loader2, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { PHONE_HINT, PHONE_PLACEHOLDER, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { revealTool } from '../lib/progressiveDisclosure';
import { quoteTotals } from '../lib/quoteMath';
import {
  HOLD_UP_COPY,
  CONTRACT_HOST_HINT,
  WAIVER_HOST_HINT,
  SMB_DOCUMENT_TYPES,
  defaultDocumentBody,
  defaultVerificationRequired,
  defaultWaiverText,
  documentBodyIsEditable,
  documentTypeLabel,
  documentViewUrl,
  fillDocumentPlaceholders,
  businessNameOptions,
  isMoneyDocumentType,
  isSmbDocumentType,
  newDocumentToken,
  sendDocumentLink,
} from '../lib/documents';
import type { DocumentTemplate, HostQuoteLineItem, SmbDocumentType } from '../lib/types';

const fieldClass =
  'mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base';

type SmsStatus = 'idle' | 'sending' | 'sent' | 'failed';

function money(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
}

export function CreateDocumentPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const typeFromQuery = typeParam && isSmbDocumentType(typeParam) ? typeParam : null;
  const initialType: SmbDocumentType = typeFromQuery ?? 'nda';

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [documentType, setDocumentType] = useState<SmbDocumentType>(initialType);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [activityOptions, setActivityOptions] = useState<string[]>([]);
  const businessNameHydrated = useRef(false);
  const [customText, setCustomText] = useState(() => defaultWaiverText());
  const [verificationRequired, setVerificationRequired] = useState(() =>
    defaultVerificationRequired(initialType),
  );
  const [items, setItems] = useState<HostQuoteLineItem[]>([{ description: '', amount: 0 }]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [payLabel, setPayLabel] = useState('PayPal');
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
  const [showTypePicker, setShowTypePicker] = useState(!typeFromQuery);

  useEffect(() => {
    if (typeParam && isSmbDocumentType(typeParam)) {
      setDocumentType(typeParam);
      setVerificationRequired(defaultVerificationRequired(typeParam));
      setShowTypePicker(false);
    } else {
      setShowTypePicker(true);
    }
  }, [typeParam]);

  useEffect(() => {
    void supabase
      .from('document_templates')
      .select('*')
      .then(({ data }) => setTemplates((data as DocumentTemplate[]) ?? []));
  }, []);

  const selectedTemplate = templates.find((t) => t.document_type === documentType) ?? null;
  const isWaiver = documentType === 'waiver';
  const isMoney = isMoneyDocumentType(documentType);
  const bodyEditable = documentBodyIsEditable(documentType);
  const knownBusinessNames = useMemo(
    () => businessNameOptions([
      profile?.paid_booking_settings?.display_name,
      profile?.full_name,
    ]),
    [profile?.paid_booking_settings?.display_name, profile?.full_name],
  );

  useEffect(() => {
    if (businessNameHydrated.current) return;
    if (!knownBusinessNames[0]) return;
    setBusinessName(knownBusinessNames[0]);
    businessNameHydrated.current = true;
  }, [knownBusinessNames]);

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
    if (isWaiver) {
      setCustomText(defaultWaiverText(profile?.waiver_template));
      return;
    }
    if (bodyEditable) {
      setCustomText(selectedTemplate?.full_text?.trim() || defaultDocumentBody(documentType));
    }
  }, [documentType, isWaiver, bodyEditable, profile?.waiver_template, selectedTemplate?.full_text]);

  useEffect(() => {
    if (defaultsApplied || !profile || !isMoney) return;
    setDefaultsApplied(true);
    if (profile.quote_line_defaults?.length) {
      setItems(profile.quote_line_defaults.map((i) => ({
        description: i.description,
        amount: Number(i.amount) || 0,
      })));
    }
    setTaxPercent(Number(profile.default_tax_percent) || 0);
  }, [profile, defaultsApplied, isMoney]);

  const { subtotal, taxAmount, total } = useMemo(
    () => quoteTotals(items, taxPercent),
    [items, taxPercent],
  );

  const filledBody = useMemo(
    () => fillDocumentPlaceholders(customText || selectedTemplate?.full_text || defaultDocumentBody(documentType), {
      topic,
      recipientName,
      businessName,
      activityDescription: topic,
    }),
    [customText, selectedTemplate?.full_text, documentType, topic, recipientName, businessName],
  );

  const handleTypeChange = (next: SmbDocumentType) => {
    setDocumentType(next);
    setVerificationRequired(defaultVerificationRequired(next));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedTemplate) return;
    const topicText = topic.trim() || (isMoney ? documentTypeLabel(documentType) : '');
    const phone = recipientPhone.trim() ? normalizePhoneE164(recipientPhone) : null;
    if (!topicText) {
      setError(isWaiver
        ? 'Add the activity or service this waiver covers.'
        : 'Add a short topic describing what this document covers.');
      return;
    }
    if (isWaiver && !businessName.trim()) {
      setError('Add the business name that appears on this waiver.');
      return;
    }
    if (verificationRequired && !phone) {
      setError('Add a valid phone number so the recipient can verify.');
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
    setError('');
    setSubmitting(true);

    const token = newDocumentToken();
    const lineItems = isMoney
      ? items.filter((i) => i.description.trim() || i.amount)
      : [];
    const { error: err } = await supabase.from('documents').insert({
      token,
      sender_id: user.id,
      recipient_name: recipientName.trim(),
      recipient_phone: phone,
      recipient_email: recipientEmail.trim() || null,
      document_type: selectedTemplate.document_type,
      template_id: selectedTemplate.id,
      topic: topicText,
      custom_text: bodyEditable
        ? fillDocumentPlaceholders(customText.trim(), {
            topic: topicText,
            recipientName: recipientName.trim(),
            businessName: businessName.trim(),
            activityDescription: topicText,
          })
        : null,
      status: 'pending',
      verification_required: verificationRequired,
      line_items: lineItems,
      tax_percent: isMoney ? Number(taxPercent) || 0 : 0,
      notes: isMoney ? notes.trim() || null : null,
      pay_elsewhere_url: isMoney && documentType !== 'receipt' ? payUrl.trim() || null : null,
      pay_elsewhere_label: isMoney && documentType !== 'receipt' ? payLabel.trim() || null : null,
      currency: 'USD',
    });

    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    const link = documentViewUrl(token);
    setSuccess({ token, smsStatus: phone ? 'sending' : 'idle', phone: recipientPhone || undefined });
    setSubmitting(false);

    if (isMoney) {
      await revealTool(user.id, 'quotes', profile?.revealed_tools);
      await refreshProfile();
    }

    if (!phone) return;
    const sms = await sendDocumentLink(token, link);
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
        Doc Center
      </Link>
      <h1 className="mt-3 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">New document</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{HOLD_UP_COPY}</p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5">
        {showTypePicker ? (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-3">Type</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SMB_DOCUMENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
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
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">Sending</p>
                <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{documentTypeLabel(documentType)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTypePicker(true)}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Change type
              </button>
            </div>
            {(documentType === 'invoice' || documentType === 'quote') && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['invoice', 'quote'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleTypeChange(id)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold min-h-11 ${
                      documentType === id
                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'
                        : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                    }`}
                  >
                    {documentTypeLabel(id)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
            <p className="mt-1 text-xs text-gray-400">
              Fills [Recipient Name] in the document below as you type.
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
              Phone {verificationRequired ? '' : '(optional)'}
            </span>
            <input
              type="tel"
              inputMode="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              onBlur={() => setRecipientPhone(blurFormatPhone(recipientPhone))}
              required={verificationRequired}
              className={fieldClass}
              placeholder={PHONE_PLACEHOLDER}
              autoComplete="tel"
            />
            <p className="mt-1 text-xs text-gray-400">
              {verificationRequired ? PHONE_HINT : 'Needed only if you want us to text the link, or if verification is on.'}
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
              {isWaiver ? 'Activity / service description' : 'Topic'}
            </span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 150))}
              required={!isMoney}
              maxLength={150}
              list="document-activity-options"
              className={fieldClass}
              placeholder={isWaiver ? 'e.g. kitchen remodel, zip-line tour' : isMoney ? 'Kitchen remodel' : 'Kitchen remodel deposit'}
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
                : ' — shown on the confirmation page'}
              {isMoney ? '. Defaults to the document type if you leave it blank.' : ''}
            </p>
          </label>
          {isWaiver && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Business name</span>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value.slice(0, 120))}
                required
                maxLength={120}
                className={fieldClass}
                placeholder="Your business name"
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
                Auto-filled from your account. Type a DBA or tap another name if you send as a different business.
              </p>
            </label>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={verificationRequired}
              onChange={(e) => setVerificationRequired(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                Require phone verification
              </span>
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-400">
                {verificationRequired
                  ? 'They enter an SMS code, then sign or confirm. Default on for NDAs, contracts, and waivers.'
                  : documentType === 'quote'
                    ? 'They can view this quote with no OTP and no signature.'
                    : 'They confirm with one tap — no OTP, no signature canvas.'}
              </span>
            </span>
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
                <div key={i} className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={item.description}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, idx) => (idx === i ? { ...row, description: e.target.value } : row)))
                    }
                    className={`${fieldClass} sm:flex-1`}
                    placeholder="Lawn cleanup"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={item.amount || ''}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, idx) => (idx === i ? { ...row, amount: Number(e.target.value) || 0 } : row)),
                        )
                      }
                      className={`${fieldClass} sm:w-32 sm:mt-0`}
                      placeholder="0.00"
                      aria-label="Amount"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                        className="min-w-11 min-h-12 text-gray-400 hover:text-red-500"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-5 w-5 mx-auto" />
                      </button>
                    )}
                  </div>
                </div>
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
            {documentType !== 'receipt' && (
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Pay somewhere else (optional)</span>
                  <input
                    value={payUrl}
                    onChange={(e) => setPayUrl(e.target.value)}
                    className={fieldClass}
                    placeholder="https://paypal.me/yourname"
                    inputMode="url"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Button label</span>
                  <input
                    value={payLabel}
                    onChange={(e) => setPayLabel(e.target.value)}
                    className={fieldClass}
                    placeholder="PayPal"
                  />
                </label>
              </div>
            )}
          </div>
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
        ) : selectedTemplate ? (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
              Full text they will see
            </p>
            <p className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {fillDocumentPlaceholders(selectedTemplate.full_text || defaultDocumentBody(documentType), {
                topic,
                recipientName,
                businessName,
                activityDescription: topic,
              })}
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
          {submitting ? 'Creating…' : recipientPhone.trim() ? 'Create & send SMS' : 'Create & copy link'}
        </button>
      </form>
    </main>
  );
}
