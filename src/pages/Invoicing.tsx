import { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Trash2, Download, Copy, Check,
  Mail, MessageSquare, Phone, Clock, X,
} from 'lucide-react';
import { openEmailComposer, openSmsComposer, openWhatsAppComposer } from '../lib/bookingShare';

type DocType = 'invoice' | 'quote' | 'receipt';
type LineItem = { id: string; description: string; qty: number; unitCents: number };

type Invoice = {
  id: string;
  docType: DocType;
  number: string;
  status: 'draft' | 'sent' | 'paid';
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  currency: string;
  lineItems: LineItem[];
  taxPct: number;
  notes: string;
  dueDate: string;
  createdAt: string;
};

const STORAGE_KEY = 'pinonit_invoices';
const CURRENCIES: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', NGN: '₦', INR: '₹',
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function nextNumber(docs: Invoice[], type: DocType) {
  const prefix = type === 'invoice' ? 'INV' : type === 'quote' ? 'QTE' : 'RCP';
  const count = docs.filter((d) => d.docType === type).length + 1;
  return `${prefix}-${String(count).padStart(4, '0')}`;
}

function blankDoc(type: DocType, docs: Invoice[]): Invoice {
  return {
    id: uid(),
    docType: type,
    number: nextNumber(docs, type),
    status: 'draft',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    currency: 'USD',
    lineItems: [{ id: uid(), description: '', qty: 1, unitCents: 0 }],
    taxPct: 0,
    notes: '',
    dueDate: '',
    createdAt: new Date().toISOString(),
  };
}

function loadDocs(): Invoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Invoice[]) : [];
  } catch {
    return [];
  }
}

function saveDocs(docs: Invoice[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch {
    /* ignore quota */
  }
}

function fmt(cents: number, currency: string) {
  const sym = CURRENCIES[currency] ?? '$';
  return `${sym}${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const DOC_LABELS: Record<DocType, string> = {
  invoice: 'Invoice',
  quote: 'Quote',
  receipt: 'Receipt',
};

export function InvoicingPage() {
  const [docs, setDocs] = useState<Invoice[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sentToast, setSentToast] = useState('');

  useEffect(() => {
    const loaded = loadDocs();
    setDocs(loaded);
    if (loaded.length > 0) {
      setActiveId(loaded[0].id);
    }
  }, []);

  useEffect(() => {
    saveDocs(docs);
  }, [docs]);

  const active = useMemo(() => docs.find((d) => d.id === activeId) ?? null, [docs, activeId]);

  const update = (patch: Partial<Invoice>) => {
    if (!active) return;
    setDocs((prev) => prev.map((d) => (d.id === active.id ? { ...d, ...patch } : d)));
  };

  const createDoc = (type: DocType) => {
    const doc = blankDoc(type, docs);
    setDocs((prev) => [doc, ...prev]);
    setActiveId(doc.id);
  };

  const deleteDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (activeId === id) {
      setActiveId(docs.find((d) => d.id !== id)?.id ?? null);
    }
  };

  const addLine = () => {
    if (!active) return;
    update({ lineItems: [...active.lineItems, { id: uid(), description: '', qty: 1, unitCents: 0 }] });
  };

  const updateLine = (lineId: string, patch: Partial<LineItem>) => {
    if (!active) return;
    update({ lineItems: active.lineItems.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) });
  };

  const removeLine = (lineId: string) => {
    if (!active) return;
    update({ lineItems: active.lineItems.filter((l) => l.id !== lineId) });
  };

  const subtotal = useMemo(() => {
    if (!active) return 0;
    return active.lineItems.reduce((sum, l) => sum + l.qty * l.unitCents, 0);
  }, [active]);

  const taxCents = useMemo(() => {
    if (!active) return 0;
    return Math.round(subtotal * (active.taxPct / 100));
  }, [active, subtotal]);

  const total = subtotal + taxCents;

  const buildMessage = (doc: Invoice, totalCents: number) => {
    const sym = CURRENCIES[doc.currency] ?? '$';
    const totalStr = `${sym}${(totalCents / 100).toFixed(2)}`;
    const lines = [
      `${DOC_LABELS[doc.docType]} ${doc.number}`,
      `From: Pin On It`,
      `To: ${doc.clientName || 'Client'}`,
      `Amount: ${totalStr}`,
    ];
    if (doc.dueDate) lines.push(`Due: ${doc.dueDate}`);
    if (doc.notes) lines.push('', doc.notes);
    lines.push('', 'Sent via Pin On It — pinonit.com');
    return lines.join('\n');
  };

  const markSent = (channel: string) => {
    if (!active) return;
    update({ status: 'sent' });
    setSentToast(`Sent via ${channel}`);
    setTimeout(() => setSentToast(''), 3000);
  };

  const sendEmail = () => {
    if (!active) return;
    const subject = `${DOC_LABELS[active.docType]} ${active.number} from Pin On It`;
    const body = buildMessage(active, total);
    openEmailComposer('default', subject, body, active.clientEmail || undefined);
    markSent('email');
  };

  const sendSms = () => {
    if (!active) return;
    openSmsComposer(buildMessage(active, total), active.clientPhone || undefined);
    markSent('SMS');
  };

  const sendWhatsapp = () => {
    if (!active) return;
    openWhatsAppComposer(buildMessage(active, total), active.clientPhone || undefined);
    markSent('WhatsApp');
  };

  const downloadText = () => {
    if (!active) return;
    const text = buildMessage(active, total);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active.number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMessage = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(buildMessage(active, total));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-5xl w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice & Quote Sender</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-400 max-w-lg">
          Create invoices, quotes, and receipts in seconds. Send them to clients via email, SMS, or WhatsApp — no extra software needed.
        </p>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* ── Sidebar list ── */}
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['invoice', 'quote', 'receipt'] as DocType[]).map((t) => (
              <button
                key={t}
                onClick={() => createDoc(t)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {DOC_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {docs.length === 0 && (
              <div className="text-center py-8 px-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                <FileText className="h-8 w-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400 dark:text-slate-500">No documents yet.<br />Create one above.</p>
              </div>
            )}
            {docs.map((doc) => {
              const docTotal = doc.lineItems.reduce((s, l) => s + l.qty * l.unitCents, 0);
              return (
                <button
                  key={doc.id}
                  onClick={() => setActiveId(doc.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    activeId === doc.id
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{doc.number}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                      doc.status === 'paid'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : doc.status === 'sent'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>{doc.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                    {doc.clientName || 'Untitled client'}
                  </p>
                  <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mt-0.5">
                    {fmt(docTotal, doc.currency)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Editor ── */}
        {!active ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700">
            <FileText className="h-12 w-12 text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-gray-400 dark:text-slate-500">
              Create an invoice, quote, or receipt to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold rounded-full uppercase tracking-wide">
                  {DOC_LABELS[active.docType]}
                </span>
                <input
                  value={active.number}
                  onChange={(e) => update({ number: e.target.value })}
                  className="bg-transparent text-lg font-bold text-gray-900 dark:text-white border-b border-transparent hover:border-gray-300 focus:border-brand-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={active.status}
                  onChange={(e) => update({ status: e.target.value as Invoice['status'] })}
                  className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                </select>
                <button
                  onClick={() => deleteDoc(active.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Client info */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Client name</label>
                <input
                  value={active.clientName}
                  onChange={(e) => update({ clientName: e.target.value })}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={active.clientEmail}
                  onChange={(e) => update({ clientEmail: e.target.value })}
                  placeholder="jane@email.com"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Phone (SMS/WhatsApp)</label>
                <input
                  type="tel"
                  value={active.clientPhone}
                  onChange={(e) => update({ clientPhone: e.target.value })}
                  placeholder="+1 555 123 4567"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Line items */}
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="grid grid-cols-[1fr_70px_110px_36px] gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-800/50 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                <span>Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Unit price</span>
                <span />
              </div>
              {active.lineItems.map((line) => (
                <div key={line.id} className="grid grid-cols-[1fr_70px_110px_36px] gap-2 px-3 py-2 border-t border-gray-100 dark:border-slate-800 items-center">
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(line.id, { description: e.target.value })}
                    placeholder="Service or item description"
                    className="bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none border-b border-transparent focus:border-brand-500 transition-colors"
                  />
                  <input
                    type="number"
                    min="1"
                    value={line.qty}
                    onChange={(e) => updateLine(line.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full text-center bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none border-b border-transparent focus:border-brand-500 transition-colors"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCents / 100}
                    onChange={(e) => updateLine(line.id, { unitCents: Math.round((Number(e.target.value) || 0) * 100) })}
                    className="w-full text-right bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none border-b border-transparent focus:border-brand-500 transition-colors"
                  />
                  <button
                    onClick={() => removeLine(line.id)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    disabled={active.lineItems.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addLine}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors border-t border-gray-100 dark:border-slate-800"
              >
                <Plus className="h-3.5 w-3.5" /> Add line item
              </button>
            </div>

            {/* Totals + settings */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Currency</label>
                    <select
                      value={active.currency}
                      onChange={(e) => update({ currency: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {Object.keys(CURRENCIES).map((c) => (
                        <option key={c} value={c}>{c} {CURRENCIES[c]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Tax %</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={active.taxPct}
                      onChange={(e) => update({ taxPct: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    {active.docType === 'receipt' ? 'Date' : 'Due date'}
                  </label>
                  <input
                    type="date"
                    value={active.dueDate}
                    onChange={(e) => update({ dueDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Notes</label>
                  <textarea
                    value={active.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                    placeholder="Payment terms, thank-you note, etc."
                    rows={2}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-slate-800/40 p-5 space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-semibold">{fmt(subtotal, active.currency)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                  <span>Tax ({active.taxPct}%)</span>
                  <span className="font-semibold">{fmt(taxCents, active.currency)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-slate-700 pt-2 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Total</span>
                  <span className="text-xl font-extrabold text-brand-600 dark:text-brand-400">{fmt(total, active.currency)}</span>
                </div>
              </div>
            </div>

            {/* Send actions */}
            <div className="border-t border-gray-100 dark:border-slate-800 pt-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Send to client</p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={sendEmail}
                  className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button
                  onClick={sendSms}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <MessageSquare className="h-4 w-4" /> SMS
                </button>
                <button
                  onClick={sendWhatsapp}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Phone className="h-4 w-4" /> WhatsApp
                </button>
                <button
                  onClick={copyMessage}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={downloadText}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
              </div>
              {sentToast && (
                <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400">
                  <Clock className="h-3.5 w-3.5" /> {sentToast}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
