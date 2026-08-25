import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Trash2, Send, Copy, Check, Loader2, Mail, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { revealTool } from '../lib/progressiveDisclosure';
import { quoteTotals } from '../lib/quoteMath';
import type { HostQuote, HostQuoteKind, HostQuoteLineItem } from '../lib/types';

const KINDS: { id: HostQuoteKind; label: string; hint: string }[] = [
  { id: 'quote', label: 'Quote', hint: 'Before they say yes' },
  { id: 'invoice', label: 'Invoice', hint: 'What they owe' },
  { id: 'receipt', label: 'Receipt', hint: 'Cash / already paid' },
];

const fieldClass =
  'mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base';

function money(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
}

function newToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

function viewUrl(token: string) {
  return `${window.location.origin}/q/${token}`;
}

export function QuoteInvoicePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [kind, setKind] = useState<HostQuoteKind>('quote');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [items, setItems] = useState<HostQuoteLineItem[]>([{ description: '', amount: 0 }]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [notes, setNotes] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [payLabel, setPayLabel] = useState('PayPal');
  const [viaEmail, setViaEmail] = useState(true);
  const [viaSms, setViaSms] = useState(false);
  const [viaWhatsapp, setViaWhatsapp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastSentUrl, setLastSentUrl] = useState('');
  const [quotes, setQuotes] = useState<HostQuote[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { subtotal, taxAmount, total } = useMemo(
    () => quoteTotals(items, taxPercent),
    [items, taxPercent],
  );

  const loadQuotes = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('host_quotes')
      .select('*')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    setQuotes((data as HostQuote[]) ?? []);
  }, [user?.id]);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  const starterItems = (): HostQuoteLineItem[] =>
    profile?.quote_line_defaults?.length
      ? profile.quote_line_defaults.map((i) => ({ description: i.description, amount: Number(i.amount) || 0 }))
      : [{ description: '', amount: 0 }];

  useEffect(() => {
    if (defaultsApplied || !profile) return;
    setDefaultsApplied(true);
    if (!editingId) {
      setItems(starterItems());
      setTaxPercent(Number(profile.default_tax_percent) || 0);
    }
  }, [profile, defaultsApplied, editingId]);

  const resetForm = () => {
    setKind('quote');
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setItems(starterItems());
    setTaxPercent(Number(profile?.default_tax_percent) || 0);
    setNotes('');
    setPayUrl('');
    setPayLabel('PayPal');
    setViaEmail(true);
    setViaSms(false);
    setViaWhatsapp(false);
    setEditingId(null);
    setError('');
  };

  const loadIntoForm = (q: HostQuote) => {
    setKind(q.kind);
    setClientName(q.client_name ?? '');
    setClientEmail(q.client_email ?? '');
    setClientPhone(q.client_phone ?? '');
    setItems(q.line_items?.length ? q.line_items : [{ description: '', amount: 0 }]);
    setTaxPercent(Number(q.tax_percent) || 0);
    setNotes(q.notes ?? '');
    setPayUrl(q.pay_elsewhere_url ?? '');
    setPayLabel(q.pay_elsewhere_label ?? 'PayPal');
    setEditingId(q.id);
    setLastSentUrl(viewUrl(q.token));
    setError('');
  };

  const saveQuote = async (): Promise<HostQuote | null> => {
    if (!user?.id) return null;
    const payload = {
      host_id: user.id,
      kind,
      client_name: clientName.trim() || null,
      client_email: clientEmail.trim() || null,
      client_phone: clientPhone.trim() || null,
      line_items: items.filter((i) => i.description.trim() || i.amount),
      tax_percent: Number(taxPercent) || 0,
      notes: notes.trim() || null,
      pay_elsewhere_url: kind === 'receipt' ? null : payUrl.trim() || null,
      pay_elsewhere_label: kind === 'receipt' ? null : payLabel.trim() || null,
      currency: 'USD',
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      const { data, error: err } = await supabase
        .from('host_quotes')
        .update(payload)
        .eq('id', editingId)
        .eq('host_id', user.id)
        .select()
        .single();
      if (err) throw err;
      return data as HostQuote;
    }
    const { data, error: err } = await supabase
      .from('host_quotes')
      .insert({ ...payload, token: newToken(), status: 'draft' })
      .select()
      .single();
    if (err) throw err;
    return data as HostQuote;
  };

  const send = async () => {
    setError('');
    if (!viaEmail && !viaSms && !viaWhatsapp) {
      setError('Choose email, SMS, and/or WhatsApp.');
      return;
    }
    if (viaEmail && !clientEmail.trim()) {
      setError('Add an email address to send by email.');
      return;
    }
    if ((viaSms || viaWhatsapp) && !clientPhone.trim()) {
      setError('Add a phone number to send by SMS or WhatsApp.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveQuote();
      if (!saved) throw new Error('Could not save.');
      setEditingId(saved.id);
      const { data: sessionData } = await supabase.auth.getSession();
      const access = sessionData.session?.access_token;
      if (!access) throw new Error('Sign in again to send.');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          quote_id: saved.id,
          via: [
            viaEmail ? 'email' : null,
            viaSms ? 'sms' : null,
            viaWhatsapp ? 'whatsapp' : null,
          ].filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');
      setLastSentUrl(json.view_url as string);
      if (json.whatsapp_url) {
        window.open(json.whatsapp_url as string, '_blank');
      }
      if (user) {
        await revealTool(user.id, 'quotes', profile?.revealed_tools);
        await refreshProfile();
      }
      await loadQuotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    }
    setSaving(false);
  };

  const copyLink = async () => {
    if (!lastSentUrl) return;
    await navigator.clipboard.writeText(lastSentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const channelBtn = (on: boolean) =>
    `min-h-12 rounded-xl border text-sm font-semibold px-2 py-3 ${
      on
        ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'
        : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
    }`;

  return (
    <main className="p-4 md:p-8 max-w-5xl pb-28 md:pb-8">
      <div className="mb-5 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Quote / Invoice</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Send a quote, invoice, or cash receipt. PinOnIt does not take payment — add a PayPal or Venmo link if they should pay somewhere else.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-2 mb-5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`rounded-xl border px-2 py-3 text-center min-h-14 ${
                  kind === k.id
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                }`}
              >
                <div className="text-sm font-semibold">{k.label}</div>
                <div className="text-[11px] mt-0.5 leading-snug hidden sm:block">{k.hint}</div>
              </button>
            ))}
          </div>

          <div className="grid gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Client name</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={fieldClass}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Email</span>
              <input
                type="email"
                inputMode="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className={fieldClass}
                placeholder="jane@email.com"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Phone (SMS / WhatsApp)</span>
              <input
                type="tel"
                inputMode="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className={fieldClass}
                placeholder="+1 555 123 4567"
                autoComplete="tel"
              />
            </label>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Line items</span>
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
                <span className="block text-[11px] text-gray-400 mt-1">Starting rate from your state. Change it anytime.</span>
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

          {kind !== 'receipt' && (
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

          <p className="mt-6 text-xs font-medium text-gray-600 dark:text-slate-400">Send by</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setViaEmail((v) => !v)} className={channelBtn(viaEmail)}>
              <Mail className="h-4 w-4 mx-auto mb-1" />
              Email
            </button>
            <button type="button" onClick={() => setViaSms((v) => !v)} className={channelBtn(viaSms)}>
              <MessageSquare className="h-4 w-4 mx-auto mb-1" />
              SMS
            </button>
            <button type="button" onClick={() => setViaWhatsapp((v) => !v)} className={channelBtn(viaWhatsapp)}>
              <MessageSquare className="h-4 w-4 mx-auto mb-1" style={{ color: viaWhatsapp ? '#25D366' : undefined }} />
              WhatsApp
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-500">
            SMS is sent from PinOnIt. WhatsApp opens on your phone with the message ready. Only message people who gave you their number.
          </p>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {lastSentUrl && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-800 px-3 py-3 text-sm">
              <span className="truncate flex-1 text-gray-600 dark:text-slate-300">{lastSentUrl}</span>
              <button type="button" onClick={() => void copyLink()} className="text-brand-600 font-semibold inline-flex items-center gap-1 shrink-0 min-h-10">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy
              </button>
            </div>
          )}

          <div className="hidden md:flex mt-6 flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void send()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send {kind}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3 text-sm font-semibold text-gray-600 dark:text-slate-400"
            >
              New
            </button>
          </div>
        </div>

        <aside>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Saved</h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-3">
            Tap one to reopen it. Send history also lives in{' '}
            <Link to="/dashboard/settings?tab=activity" className="font-semibold underline">Settings → Activity</Link>.
          </p>
          <div className="space-y-2 max-h-80 lg:max-h-none overflow-auto">
            {quotes.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-slate-500">
                No quotes yet. Fill in the form and tap Send — your client gets it by email or text.
              </p>
            )}
            {quotes.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => loadIntoForm(q)}
                className={`w-full text-left rounded-xl border px-3 py-3 min-h-14 ${
                  editingId === q.id
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-600 shrink-0" />
                  <span className="text-sm font-medium capitalize">{q.kind}</span>
                  <span className="ml-auto text-[11px] uppercase tracking-wide text-gray-400">{q.status}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 truncate">
                  {q.client_name || q.client_email || 'No name'}
                  {' · '}
                  {money(quoteTotals(q.line_items ?? [], Number(q.tax_percent) || 0).total, q.currency)}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {new Date(q.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
        <button
          type="button"
          onClick={resetForm}
          className="min-h-12 px-4 text-sm font-semibold text-gray-600 dark:text-slate-300 rounded-xl border border-gray-200 dark:border-slate-700"
        >
          New
        </button>
        <button
          type="button"
          onClick={() => void send()}
          disabled={saving}
          className="flex-1 min-h-12 inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-base font-semibold rounded-xl"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send {kind} · {money(total)}
        </button>
      </div>
    </main>
  );
}
