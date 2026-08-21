import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Trash2, Send, Copy, Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { HostQuote, HostQuoteKind, HostQuoteLineItem } from '../lib/types';

const KINDS: { id: HostQuoteKind; label: string; hint: string }[] = [
  { id: 'quote', label: 'Quote', hint: 'Price before they say yes' },
  { id: 'invoice', label: 'Invoice', hint: 'What they owe — pay elsewhere' },
  { id: 'receipt', label: 'Receipt', hint: 'Paid in cash or already settled' },
];

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
  const { user } = useAuth();
  const [kind, setKind] = useState<HostQuoteKind>('quote');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [items, setItems] = useState<HostQuoteLineItem[]>([{ description: '', amount: 0 }]);
  const [notes, setNotes] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [payLabel, setPayLabel] = useState('PayPal');
  const [viaEmail, setViaEmail] = useState(true);
  const [viaSms, setViaSms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastSentUrl, setLastSentUrl] = useState('');
  const [quotes, setQuotes] = useState<HostQuote[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [items],
  );

  const loadQuotes = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('host_quotes')
      .select('*')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setQuotes((data as HostQuote[]) ?? []);
  }, [user?.id]);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  const resetForm = () => {
    setKind('quote');
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setItems([{ description: '', amount: 0 }]);
    setNotes('');
    setPayUrl('');
    setPayLabel('PayPal');
    setViaEmail(true);
    setViaSms(false);
    setEditingId(null);
    setError('');
  };

  const loadIntoForm = (q: HostQuote) => {
    setKind(q.kind);
    setClientName(q.client_name ?? '');
    setClientEmail(q.client_email ?? '');
    setClientPhone(q.client_phone ?? '');
    setItems(q.line_items?.length ? q.line_items : [{ description: '', amount: 0 }]);
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
    if (!viaEmail && !viaSms) {
      setError('Choose email and/or text.');
      return;
    }
    if (viaEmail && !clientEmail.trim()) {
      setError('Add an email address to send by email.');
      return;
    }
    if (viaSms && !clientPhone.trim()) {
      setError('Add a phone number to send by text.');
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
          via: [viaEmail ? 'email' : null, viaSms ? 'sms' : null].filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');
      const url = json.view_url as string;
      setLastSentUrl(url);
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

  return (
    <main className="p-6 md:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quote / Invoice</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Send a quick quote, invoice, or cash receipt by email or text. PinOnIt does not take payment —
          add your PayPal, Venmo, or other link if they should pay somewhere else.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-2 mb-6">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  kind === k.id
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                }`}
              >
                <div className="text-sm font-semibold">{k.label}</div>
                <div className="text-[11px] mt-0.5 leading-snug">{k.hint}</div>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Client name</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                placeholder="Jane Smith"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Email</span>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                placeholder="jane@email.com"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Phone (for text)</span>
              <input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                placeholder="+1 555 123 4567"
              />
            </label>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Line items</span>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { description: '', amount: 0 }])}
                className="text-xs font-semibold text-brand-600 inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={item.description}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, idx) => (idx === i ? { ...row, description: e.target.value } : row)))
                    }
                    className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Lawn cleanup"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount || ''}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, amount: Number(e.target.value) || 0 } : row)),
                      )
                    }
                    className="w-28 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
              Total {money(total)}
            </p>
          </div>

          <label className="block mt-4">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Note (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
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
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  placeholder="https://paypal.me/yourname"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Button label</span>
                <input
                  value={payLabel}
                  onChange={(e) => setPayLabel(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  placeholder="PayPal"
                />
              </label>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={viaEmail} onChange={(e) => setViaEmail(e.target.checked)} />
              Email
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={viaSms} onChange={(e) => setViaSms(e.target.checked)} />
              Text
            </label>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-500">
            Only text people who gave you their number for this quote. Texts include a STOP opt-out.
          </p>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {lastSentUrl && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm">
              <span className="truncate flex-1 text-gray-600 dark:text-slate-300">{lastSentUrl}</span>
              <button type="button" onClick={() => void copyLink()} className="text-brand-600 font-semibold inline-flex items-center gap-1">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy link
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
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
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent</h2>
          <div className="space-y-2">
            {quotes.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-slate-500">Nothing sent yet.</p>
            )}
            {quotes.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => loadIntoForm(q)}
                className={`w-full text-left rounded-xl border px-3 py-3 ${
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
                <p className="mt-1 text-xs text-gray-500 truncate">{q.client_name || q.client_email || 'No name'}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
