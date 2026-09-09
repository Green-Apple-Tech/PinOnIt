import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Loader2, MapPin } from 'lucide-react';
import {
  coordinationContextLabel,
  formatCoordinationSlot,
  getCoordinationByToken,
  submitCoordinationSlotVotes,
  type CoordinationPublicPayload,
} from '../lib/coordination';

const BRAND = '#5864C6';

export function CoordinationVotePage() {
  const { token } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<CoordinationPublicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justVoted, setJustVoted] = useState(false);

  useEffect(() => {
    if (!token) {
      setMissing(true);
      setLoading(false);
      return;
    }
    void (async () => {
      const { data } = await getCoordinationByToken(token);
      if (!data) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setPayload(data);
      setJustVoted(data.participant.response_status === 'responded' || data.participant.response_status === 'confirmed');
      setLoading(false);
    })();
  }, [token]);

  const kind = coordinationContextLabel(payload?.meeting.context_type);
  const slots = useMemo(
    () => [...(payload?.slots ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.start_time.localeCompare(b.start_time)),
    [payload],
  );
  const locked = payload?.meeting.status === 'confirmed' || payload?.meeting.status === 'cancelled';
  const confirmedLabel = payload?.meeting.confirmed_time
    ? formatCoordinationSlot(payload.meeting.confirmed_time)
    : null;

  async function pickSlot(slotId: string) {
    if (!token || busy || locked) return;
    setBusy(true);
    setError('');
    const { data, error: err } = await submitCoordinationSlotVotes(token, [slotId]);
    if (err || !data?.ok) {
      setError(err?.message ?? data?.error ?? 'Could not save that time.');
      setBusy(false);
      return;
    }
    setJustVoted(true);
    const refreshed = await getCoordinationByToken(token);
    if (refreshed.data) setPayload(refreshed.data);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    void fetch(`${supabaseUrl}/functions/v1/coordinate-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ type: 'after_vote', token }),
    }).catch(() => {});
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (missing || !payload) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm text-slate-500">This scheduling link could not be found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <span className="font-bold tracking-tight">PinOnIt</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-widest text-slate-400">{kind}</p>
          <h1 className="mt-1 text-xl font-bold">{payload.meeting.title || kind}</h1>
          <p className="mt-2 text-sm text-slate-500">Hi {payload.participant.name} — which times work?</p>
          {payload.meeting.location ? (
            <p className="mt-3 inline-flex items-start gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
              {payload.meeting.location}
            </p>
          ) : null}
        </div>

        {payload.meeting.status === 'confirmed' && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-5 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-emerald-500" />
            <p className="mt-3 font-bold">This {kind.toLowerCase()} is confirmed</p>
            {confirmedLabel ? <p className="mt-1 text-sm text-slate-600">{confirmedLabel}</p> : null}
          </div>
        )}

        {payload.meeting.status === 'cancelled' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center text-sm text-slate-600">
            This {kind.toLowerCase()} was cancelled.
          </div>
        )}

        {!locked && justVoted && (
          <div className="bg-white rounded-2xl border border-indigo-100 p-5 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-indigo-500" />
            <p className="mt-3 font-bold text-slate-900">Got it — we&apos;ll text you once everyone&apos;s responded</p>
          </div>
        )}

        {!locked && (
          <div className="space-y-2">
            {slots.map((slot, i) => {
              const n = i + 1;
              const selected = slot.you_said_yes;
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void pickSlot(slot.id)}
                  className={`w-full min-h-14 px-4 py-3 rounded-2xl border-2 text-left font-semibold disabled:opacity-50 ${
                    selected
                      ? 'border-transparent text-white'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                  style={selected ? { background: BRAND, borderColor: BRAND } : undefined}
                >
                  <span className="text-xs font-bold uppercase tracking-wide opacity-70">Option {n}</span>
                  <span className="block text-base">{formatCoordinationSlot(slot.start_time, slot.end_time)}</span>
                </button>
              );
            })}
          </div>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </main>
    </div>
  );
}
