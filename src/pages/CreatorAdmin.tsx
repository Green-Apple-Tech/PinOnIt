import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { isStaffEmail } from '../lib/staff';
import { PROPOSED_CREATOR_SETTINGS, creatorPayoutCsv } from '../lib/creatorProgram';

type Application = {
  id: string;
  name: string;
  email: string;
  profile_url: string;
  topics: string;
  audience: string;
  status: string;
  created_at: string;
};

export function CreatorAdminPage() {
  const { user } = useAuth();
  const staff = isStaffEmail(user?.email);
  const [rows, setRows] = useState<Application[]>([]);
  const [note, setNote] = useState('');

  const load = async () => {
    const { data, error } = await supabase
      .from('creator_applications')
      .select('id, name, email, profile_url, topics, audience, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setNote('Applications are not available until the creator migration is applied.');
      return;
    }
    setRows((data ?? []) as Application[]);
    setNote('');
  };

  useEffect(() => {
    if (staff) void load();
  }, [staff]);

  const approve = async (id: string) => {
    const { error } = await supabase.rpc('approve_creator_application', { p_application_id: id });
    setNote(error ? error.message : 'Approved. No complimentary access and no commission eligibility were granted.');
    await load();
  };

  const reject = async (id: string) => {
    const { error } = await supabase.from('creator_applications').update({ status: 'rejected' }).eq('id', id);
    setNote(error ? error.message : 'Rejected.');
    await load();
  };

  const exportPayouts = async () => {
    const { data, error } = await supabase.from('creators').select('id, code, email');
    if (error || !data) {
      setNote('Payout export is not available yet.');
      return;
    }
    const lines: { code: string; email: string; payableCents: number }[] = [];
    for (const creator of data) {
      const { data: entries } = await supabase
        .from('creator_commission_entries')
        .select('amount_cents, status')
        .eq('creator_id', creator.id)
        .eq('status', 'payable');
      const payable = (entries ?? []).reduce((sum, entry) => sum + entry.amount_cents, 0);
      lines.push({ code: creator.code, email: creator.email, payableCents: payable });
    }
    const csv = creatorPayoutCsv(lines);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'creator-payouts-draft.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!staff) {
    return (
      <div className="max-w-lg mx-auto p-8">
        <h1 className="text-xl font-bold">Creator admin</h1>
        <p className="mt-2 text-sm text-slate-500">This screen is only available on a PinOnIt staff login.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Not activated</p>
        <h1 className="text-2xl font-bold mt-1">Creator applications</h1>
        <p className="text-sm text-slate-600 mt-2">
          Approved settings, program still draft: {PROPOSED_CREATOR_SETTINGS.commissionBps / 100}% commission, {PROPOSED_CREATOR_SETTINGS.holdDays}-day hold, {PROPOSED_CREATOR_SETTINGS.attributionDays}-day first touch, {PROPOSED_CREATOR_SETTINGS.proposedGrantDurationDays}-day grant, {PROPOSED_CREATOR_SETTINGS.proposedOutboundMessageLimit} outbound messages total. Heepsy is not connected. Commissions stay off until a creator accepts the published terms.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled className="px-3 py-2 rounded-lg bg-slate-200 text-slate-500 text-sm">Grant access (off while the program is draft)</button>
        <button type="button" disabled className="px-3 py-2 rounded-lg bg-slate-200 text-slate-500 text-sm">Record payout (off while the program is draft)</button>
        <button type="button" onClick={exportPayouts} className="px-3 py-2 rounded-lg border border-slate-300 text-sm">Download payout report</button>
      </div>
      <p className="text-sm text-slate-500">The payout CSV is a report only. Downloading it does not mark earnings paid.</p>
      {note && <p className="text-sm">{note}</p>}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="font-semibold">{row.name} · {row.status}</p>
            <p className="text-sm">{row.email}</p>
            <p className="text-sm break-all">{row.profile_url}</p>
            <p className="text-sm mt-1">{row.topics}</p>
            <p className="text-sm text-slate-600">{row.audience}</p>
            {row.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => approve(row.id)} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ backgroundColor: '#5864C6' }}>Approve</button>
                <button type="button" onClick={() => reject(row.id)} className="px-3 py-1.5 rounded-lg border text-sm">Reject</button>
              </div>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-slate-500">No applications.</li>}
      </ul>
    </div>
  );
}
