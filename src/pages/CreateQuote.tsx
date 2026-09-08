import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { PHONE_HINT, PHONE_PLACEHOLDER, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { revealTool } from '../lib/progressiveDisclosure';
import { quoteTotals } from '../lib/quoteMath';
import { normalizeExternalUrl } from '../lib/paymentLink';
import { PaymentLinkFields } from '../components/PaymentLinkFields';
import { ContactAutocomplete } from '../components/ContactAutocomplete';
import {
  defaultDocumentBody,
  documentViewUrl,
  fillDocumentPlaceholders,
  newDocumentToken,
  resolveHostBusinessName,
  sendDocumentLink,
} from '../lib/documents';
import { quotesPath } from '../lib/documentActions';
import {
  isQuotePayMode,
  validUntilFromDays,
  type QuotePayMode,
} from '../lib/quoteSms';
import type { DocumentTemplate, HostQuoteLineItem, SmbDocument } from '../lib/types';

const fieldClass =
  'mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base min-h-12';

type SmsStatus = 'idle' | 'sending' | 'sent' | 'failed';

function money(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function emptyLine(): HostQuoteLineItem {
  return { description: '', amount: 0 };
}

export function CreateQuotePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [items, setItems] = useState<HostQuoteLineItem[]>([emptyLine()]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [validDays, setValidDays] = useState(30);
  const [payMode, setPayMode] = useState<QuotePayMode>('off');
  const [payUrl, setPayUrl] = useState('');
  const [payLabel, setPayLabel] = useState('Pay Now');
  const [depositAmount, setDepositAmount] = useState('');
  const [presets, setPresets] = useState<HostQuoteLineItem[]>([]);
  const [lastQuote, setLastQuote] = useState<SmbDocument | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ token: string; smsStatus: SmsStatus; smsError?: string; phone?: string } | null>(null);

  useEffect(() => {
    void supabase
      .from('document_templates')
      .select('*')
      .eq('document_type', 'quote')
      .then(({ data }) => setTemplates((data as DocumentTemplate[]) ?? []));
  }, []);

  useEffect(() => {
    if (!profile) return;
    setTaxPercent(Number(profile.default_tax_percent) || 0);
    setValidDays(Math.max(1, Number(profile.default_quote_valid_days) || 30));
    if (profile.quote_line_defaults?.length) {
      setItems(profile.quote_line_defaults.map((i) => ({ description: i.description, amount: Number(i.amount) || 0 })));
    }
    if (profile.default_pay_url) {
      setPayUrl(profile.default_pay_url);
      setPayMode('full');
    }
    if (profile.default_pay_label) setPayLabel(profile.default_pay_label);
  }, [profile]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from('documents')
      .select('*')
      .eq('sender_id', user.id)
      .eq('document_type', 'quote')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const rows = (data as SmbDocument[]) ?? [];
        setLastQuote(rows[0] ?? null);
        const seen = new Set<string>();
        const chips: HostQuoteLineItem[] = [];
        for (const def of profile?.quote_line_defaults ?? []) {
          const key = def.description.trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          chips.push({ description: def.description, amount: Number(def.amount) || 0 });
        }
        for (const row of rows) {
          for (const line of row.line_items ?? []) {
            const key = (line.description || '').trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            chips.push({ description: line.description, amount: Number(line.amount) || 0 });
          }
        }
        setPresets(chips.slice(0, 12));
      });
  }, [user?.id, profile?.quote_line_defaults]);

  const totals = useMemo(() => quoteTotals(items, taxPercent), [items, taxPercent]);
  const quoteTemplate = templates.find((t) => t.document_type === 'quote') ?? templates[0] ?? null;

  function addPreset(line: HostQuoteLineItem) {
    setItems((prev) => {
      const blank = prev.length === 1 && !prev[0].description && !prev[0].amount;
      return blank ? [line] : [...prev, line];
    });
  }

  function duplicateLast() {
    if (!lastQuote) return;
    setItems(lastQuote.line_items?.length ? lastQuote.line_items.map((i) => ({ ...i })) : [emptyLine()]);
    setNotes(lastQuote.notes ?? '');
    setTaxPercent(Number(lastQuote.tax_percent) || 0);
    setPayUrl(lastQuote.pay_elsewhere_url ?? '');
    setPayLabel(lastQuote.pay_elsewhere_label || 'Pay Now');
    setPayMode(isQuotePayMode(lastQuote.pay_mode) ? lastQuote.pay_mode : lastQuote.pay_elsewhere_url ? 'full' : 'off');
    if (lastQuote.pay_amount_cents && lastQuote.pay_mode === 'deposit') {
      setDepositAmount((lastQuote.pay_amount_cents / 100).toFixed(2));
    }
    if (lastQuote.recipient_name && lastQuote.recipient_name !== 'Customer') {
      setRecipientName(lastQuote.recipient_name);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || submitting) return;
    setError('');
    const phone = normalizePhoneE164(recipientPhone);
    if (!phone) {
      setError('Customer phone is required so we can text the quote.');
      return;
    }
    const lineItems = items.filter((i) => i.description.trim() || i.amount);
    if (!lineItems.length) {
      setError('Add at least one line.');
      return;
    }
    if (!quoteTemplate) {
      setError('Quote template is missing. Refresh and try again.');
      return;
    }
    if (payMode !== 'off' && !normalizeExternalUrl(payUrl)) {
      setError('Paste your Zelle, Cash App, Venmo, or PayPal link for Pay Now.');
      return;
    }
    const depositCents = Math.round((Number(depositAmount) || 0) * 100);
    if (payMode === 'deposit' && depositCents <= 0) {
      setError('Enter a deposit amount.');
      return;
    }

    const name = recipientName.trim() || 'Customer';
    const topicText = lineItems[0].description.trim() || 'Quote';
    const businessName = resolveHostBusinessName(profile);
    const bodyForSave = fillDocumentPlaceholders(
      quoteTemplate.full_text?.trim() || defaultDocumentBody('quote'),
      { topic: topicText, recipientName: name, businessName, activityDescription: topicText },
    );
    const moneyTotals = quoteTotals(lineItems, taxPercent);
    const payAmountCents =
      payMode === 'deposit' ? depositCents : payMode === 'full' ? Math.round(moneyTotals.total * 100) : null;

    setSubmitting(true);
    const token = newDocumentToken();
    const { error: err } = await supabase.from('documents').insert({
      token,
      sender_id: user.id,
      recipient_name: name,
      recipient_phone: phone,
      document_type: 'quote',
      template_id: quoteTemplate.id,
      topic: topicText.slice(0, 150),
      custom_text: bodyForSave || null,
      status: 'pending',
      verification_required: true,
      line_items: lineItems,
      tax_percent: Number(taxPercent) || 0,
      notes: notes.trim() || null,
      pay_elsewhere_url: payMode === 'off' ? null : normalizeExternalUrl(payUrl),
      pay_elsewhere_label: payMode === 'off' ? null : (payLabel.trim() || 'Pay Now'),
      pay_mode: payMode,
      pay_amount_cents: payAmountCents,
      valid_until: validUntilFromDays(validDays),
      currency: 'USD',
    });

    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    await revealTool(user.id, 'quotes', profile?.revealed_tools);
    await refreshProfile();

    const link = documentViewUrl(token);
    setSuccess({ token, smsStatus: 'sending', phone: recipientPhone });
    setSubmitting(false);
    const sms = await sendDocumentLink(token, link, 'quote');
    if (!sms.ok) {
      setSuccess({ token, smsStatus: 'failed', smsError: sms.error, phone: recipientPhone });
      return;
    }
    setSuccess({ token, smsStatus: 'sent', phone: recipientPhone });
  }

  if (success) {
    const link = documentViewUrl(success.token);
    return (
      <main className="p-4 md:p-8 max-w-lg">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
          <CheckCircle className="h-10 w-10 mx-auto text-emerald-500" />
          <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Quote sent</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            They get a text with the total and a link to approve.
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
              {success.smsStatus === 'sending' && `Sending SMS to ${success.phone}…`}
              {success.smsStatus === 'sent' && `SMS sent to ${success.phone}.`}
              {success.smsStatus === 'failed' && (success.smsError || 'SMS could not be sent. Copy the link below.')}
            </span>
          </div>
          <p className="mt-4 text-xs break-all text-gray-400">{link}</p>
          <Link
            to={quotesPath()}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white"
          >
            Quotes list
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 max-w-lg pb-28">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quote-by-Text</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        Phone, lines, send. They approve with Sign-by-Text. PinOnIt never takes the money — paste your own pay link.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
        <ContactAutocomplete
          hostId={user?.id}
          onSelect={(c) => {
            setRecipientName(c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' '));
            if (c.phone) setRecipientPhone(c.phone);
          }}
        />
        <label className="block">
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Customer phone <span className="text-red-500">*</span></span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            onBlur={() => setRecipientPhone((v) => blurFormatPhone(v) || v)}
            className={fieldClass}
            placeholder={PHONE_PLACEHOLDER}
          />
          <p className="mt-1 text-xs text-gray-400">{PHONE_HINT}</p>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Name (optional)</span>
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className={fieldClass}
            placeholder="Maria"
            autoComplete="name"
          />
        </label>

        {lastQuote && (
          <button
            type="button"
            onClick={duplicateLast}
            className="min-h-11 w-full rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-200"
          >
            Duplicate last quote
          </button>
        )}

        {presets.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-2">One-tap lines</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.description}
                  type="button"
                  onClick={() => addPreset(p)}
                  className="min-h-10 px-3 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-medium text-gray-700 dark:text-slate-200"
                >
                  {p.description}{p.amount ? ` · ${money(p.amount)}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Line items</p>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={item.description}
                onChange={(e) => setItems((prev) => prev.map((row, j) => j === i ? { ...row, description: e.target.value } : row))}
                className={`${fieldClass} flex-1`}
                placeholder="Front yard cleanup"
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={item.amount || ''}
                onChange={(e) => setItems((prev) => prev.map((row, j) => j === i ? { ...row, amount: Number(e.target.value) || 0 } : row))}
                className={`${fieldClass} w-28`}
                placeholder="0"
              />
              {items.length > 1 && (
                <button type="button" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 text-gray-400" aria-label="Remove line">
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyLine()])}
            className="inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-brand-600"
          >
            <Plus className="h-4 w-4" /> add line
          </button>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Tax %</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxPercent || ''}
              onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
              className={`${fieldClass} w-32`}
            />
          </label>
          <div className="text-sm text-gray-600 dark:text-slate-300 space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            {taxPercent > 0 && <div className="flex justify-between"><span>Tax</span><span>{money(totals.taxAmount)}</span></div>}
            <div className="flex justify-between font-semibold text-gray-900 dark:text-white"><span>Total</span><span>{money(totals.total)}</span></div>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Note (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={fieldClass}
            placeholder="Includes haul-away. Start next week if you approve."
          />
        </label>

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

        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Pay after they approve</p>
          <p className="text-xs text-gray-500">Your Zelle / Cash App / Venmo / PayPal. We never take the payment.</p>
          <div className="grid grid-cols-3 gap-2">
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
            <label className="block">
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
            <PaymentLinkFields url={payUrl} label={payLabel} onUrlChange={setPayUrl} onLabelChange={setPayLabel} />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-14 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-base font-bold disabled:opacity-40"
        >
          {submitting ? 'Sending…' : 'SEND QUOTE'}
        </button>
      </form>
    </main>
  );
}
