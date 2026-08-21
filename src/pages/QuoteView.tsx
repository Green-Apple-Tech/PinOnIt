import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { HostQuoteKind, HostQuoteLineItem } from '../lib/types';

type PublicQuote = {
  kind: HostQuoteKind;
  client_name: string | null;
  line_items: HostQuoteLineItem[];
  notes: string | null;
  pay_elsewhere_url: string | null;
  pay_elsewhere_label: string | null;
  currency: string;
  created_at: string;
  host_name: string;
};

function money(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
}

export function QuoteViewPage() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!token) {
      setMissing(true);
      return;
    }
    void (async () => {
      const { data, error } = await supabase.rpc('get_host_quote', { p_token: token });
      if (error || !data) {
        setMissing(true);
        return;
      }
      setQuote(data as PublicQuote);
    })();
  }, [token]);

  if (missing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-500">This quote or invoice could not be found.</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const items = Array.isArray(quote.line_items) ? quote.line_items : [];
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const title = quote.kind === 'invoice' ? 'Invoice' : quote.kind === 'receipt' ? 'Receipt' : 'Quote';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <p className="text-xs uppercase tracking-widest text-slate-400">{title}</p>
          <h1 className="mt-1 text-2xl font-bold">{quote.host_name}</h1>
          {quote.client_name && (
            <p className="mt-1 text-sm text-slate-500">For {quote.client_name}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {new Date(quote.created_at).toLocaleDateString()}
          </p>

          <table className="w-full mt-8 text-sm">
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-3 pr-4">{item.description || 'Item'}</td>
                  <td className="py-3 text-right whitespace-nowrap">{money(item.amount, quote.currency)}</td>
                </tr>
              ))}
              <tr>
                <td className="pt-4 font-semibold">Total</td>
                <td className="pt-4 text-right font-semibold">{money(total, quote.currency)}</td>
              </tr>
            </tbody>
          </table>

          {quote.notes && (
            <p className="mt-6 text-sm text-slate-600 whitespace-pre-wrap">{quote.notes}</p>
          )}

          {quote.pay_elsewhere_url && (
            <a
              href={quote.pay_elsewhere_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3"
            >
              Pay {quote.pay_elsewhere_label || 'now'}
            </a>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Sent with PinOnIt — not a payment processor</p>
      </div>
    </div>
  );
}
