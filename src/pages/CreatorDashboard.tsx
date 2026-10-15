import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { creatorBalances, type LedgerEntry } from '../lib/creatorProgram';

type CreatorRow = { id: string; code: string; email: string; commission_eligible: boolean; status: string };
type EntryRow = LedgerEntry;
type PayoutRow = { id: string; amount_cents: number; created_at: string; paid_on: string | null; reference: string | null; note: string | null };

export function CreatorDashboardPage() {
  const { user } = useAuth();
  const [creator, setCreator] = useState<CreatorRow | null>(null);
  const [signups, setSignups] = useState(0);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [note, setNote] = useState('Loading…');

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from('creators')
        .select('id, code, email, commission_eligible, status')
        .or(`user_id.eq.${user.id},email.eq.${user.email ?? ''}`)
        .maybeSingle();
      if (cancel) return;
      if (error) {
        setNote('Creator records are not available yet.');
        return;
      }
      if (!data) {
        setNote('No approved creator profile is linked to this login.');
        setCreator(null);
        return;
      }
      setCreator(data as CreatorRow);
      const [attr, ledger, paid] = await Promise.all([
        supabase.from('creator_attributions').select('id', { count: 'exact', head: true }).eq('creator_id', data.id),
        supabase.from('creator_commission_entries').select('stripe_event_id, stripe_invoice_id, stripe_refund_id, kind, basis_cents, amount_cents, rate_bps, status, available_at').eq('creator_id', data.id),
        supabase.from('creator_payouts').select('id, amount_cents, created_at, paid_on, reference, note').eq('creator_id', data.id),
      ]);
      if (cancel) return;
      setSignups(attr.count ?? 0);
      setEntries(((ledger.data ?? []) as {
        stripe_event_id: string;
        stripe_invoice_id: string;
        stripe_refund_id: string | null;
        kind: EntryRow['kind'];
        basis_cents: number;
        amount_cents: number;
        rate_bps: number;
        status: EntryRow['status'];
        available_at: string;
      }[]).flatMap((entry) => (
        entry.status === 'pending' || entry.status === 'payable'
          ? [{
            eventId: entry.stripe_event_id,
            invoiceId: entry.stripe_invoice_id,
            refundId: entry.stripe_refund_id,
            kind: entry.kind,
            basisCents: entry.basis_cents,
            amountCents: entry.amount_cents,
            rateBps: entry.rate_bps,
            status: entry.status,
            availableAt: entry.available_at,
          }]
          : []
      )));
      setPayouts((paid.data ?? []) as PayoutRow[]);
      setNote('');
    })();
    return () => { cancel = true; };
  }, [user]);

  const paidSubscribers = new Set(entries.filter((entry) => entry.kind === 'earn').map((entry) => entry.invoiceId)).size;
  const balances = creatorBalances(entries);
  const link = creator ? `${window.location.origin}/signup?creator=${creator.code}` : '';

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Creator partner · draft program</p>
        <h1 className="text-2xl font-bold mt-1">Your creator dashboard</h1>
        <p className="text-sm text-slate-500 mt-2">Creator commissions stay off while this program is a draft.</p>
      </div>
      {note && <p className="text-sm">{note} <Link className="underline" to="/creators">Apply</Link></p>}
      {creator && (
        <>
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-sm text-slate-500">Link and code</p>
            <p className="font-mono text-sm mt-2 break-all">{link}</p>
            <p className="mt-2 text-sm">Code <span className="font-mono font-semibold">{creator.code}</span></p>
            <p className="mt-2 text-sm">Commission eligibility: {creator.commission_eligible ? 'yes' : 'no — not turned on'}</p>
            <p className="mt-2 text-sm">Commissions stay off until you accept the published terms. No terms version is published.</p>
          </section>
          <section className="grid grid-cols-2 gap-3">
            {[
              ['Attributed signups', signups],
              ['Paid invoices', paidSubscribers],
              ['Pending', `$${(balances.pendingCents / 100).toFixed(2)}`],
              ['Payable', `$${(balances.payableCents / 100).toFixed(2)}`],
              ['Recoverable', `$${(balances.recoverableCents / 100).toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            ))}
          </section>
          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="font-semibold">Payout history</h2>
            {payouts.length === 0 ? <p className="text-sm text-slate-500 mt-2">No payouts. Nothing is transferred automatically.</p> : (
              <ul className="mt-2 text-sm space-y-1">
                {payouts.map((payout) => (
                  <li key={payout.id}>
                    ${(payout.amount_cents / 100).toFixed(2)} · {payout.paid_on ?? payout.created_at.slice(0, 10)} · {payout.reference ?? payout.note ?? ''}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
