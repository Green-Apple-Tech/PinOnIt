import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { MeetingPoll, MeetingPollSlot } from '../lib/types';
import {
  Loader2, Check, Users, Clock, MapPin, AlertCircle, CheckCircle2,
} from 'lucide-react';

const BRAND = '#5864C6';

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2,'0')}${suffix}`;
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${mo}-${d}`;
}

interface SlotWithVotes extends MeetingPollSlot {
  yesCount: number;
  maybeCount: number;
  totalVotes: number;
}

interface PollData extends MeetingPoll {
  slots: SlotWithVotes[];
  totalResponses: number;
  hostName: string | null;
}

const LOCATION_LABEL: Record<string, string> = {
  video: 'Video call', phone: 'Phone', in_person: 'In person', custom: 'Custom',
};

// ─────────────────────────────────────────────────────────────
// Guest voting grid
// ─────────────────────────────────────────────────────────────
function GuestVoteGrid({
  slots,
  selected,
  onToggle,
  totalResponses,
}: {
  slots: SlotWithVotes[];
  selected: Set<string>;
  onToggle: (slotId: string) => void;
  totalResponses: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select'|'deselect'>('select');
  const draggedRef = useRef<Set<string>>(new Set());

  const handleCellDown = (id: string) => {
    const mode = selected.has(id) ? 'deselect' : 'select';
    setDragMode(mode);
    setDragging(true);
    draggedRef.current = new Set([id]);
    onToggle(id);
  };

  const handleCellEnter = (id: string) => {
    if (!dragging || draggedRef.current.has(id)) return;
    draggedRef.current.add(id);
    if (dragMode === 'select' && !selected.has(id)) onToggle(id);
    if (dragMode === 'deselect' && selected.has(id)) onToggle(id);
  };

  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // Group by date
  const byDate: Record<string, SlotWithVotes[]> = {};
  for (const s of slots) {
    const key = toYMD(new Date(s.start_time));
    (byDate[key] ??= []).push(s);
  }
  const dates = Object.keys(byDate).sort();
  const allTimes = Array.from(new Set(slots.map(s => {
    const d = new Date(s.start_time);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }))).sort();

  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Click or drag to mark times that work for you.
        {totalResponses > 0 && <span className="ml-1">Numbers show how many others voted yes.</span>}
      </p>
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="inline-grid gap-px bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 select-none"
          style={{ gridTemplateColumns: `52px repeat(${dates.length}, minmax(60px, 1fr))` }}
          onMouseLeave={() => setDragging(false)}
        >
          {/* Header */}
          <div className="bg-white dark:bg-slate-800/50 py-2" />
          {dates.map(ymd => {
            const d = new Date(ymd + 'T00:00:00');
            return (
              <div key={ymd} className="bg-white dark:bg-slate-800/50 px-1 py-2 text-center">
                <p className="text-[9px] font-semibold text-slate-400 uppercase">{d.toLocaleDateString('en-US', { weekday:'short' })}</p>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{d.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</p>
              </div>
            );
          })}

          {/* Rows */}
          {allTimes.map(time => (
            <>
              <div key={`lbl-${time}`} className="bg-white dark:bg-slate-800/50 flex items-center justify-end pr-2 py-0">
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatTime(time)}</span>
              </div>
              {dates.map(ymd => {
                const slot = byDate[ymd]?.find(s => {
                  const d = new Date(s.start_time);
                  const t = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                  return t === time;
                });
                if (!slot) return <div key={`${ymd}-${time}`} className="bg-slate-50 dark:bg-slate-900/40 h-9" />;

                const isSel = selected.has(slot.id);
                const hasVotes = slot.yesCount > 0;

                return (
                  <div
                    key={slot.id}
                    className="relative h-9 flex items-center justify-center cursor-pointer transition-all duration-75"
                    style={isSel ? { backgroundColor: BRAND } : hasVotes ? { backgroundColor: `${BRAND}18` } : { backgroundColor: '#fff' }}
                    onMouseDown={() => handleCellDown(slot.id)}
                    onMouseEnter={() => handleCellEnter(slot.id)}
                  >
                    {isSel && <Check className="h-3 w-3 text-white opacity-80" />}
                    {!isSel && hasVotes && (
                      <span className="text-[10px] font-semibold" style={{ color: BRAND }}>{slot.yesCount}</span>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2 text-center">{selected.size} time{selected.size !== 1 ? 's' : ''} selected</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Confirmation screen
// ─────────────────────────────────────────────────────────────
function ThankYou({ poll, name }: { poll: PollData; name: string }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${BRAND}15` }}>
        <Check className="h-8 w-8" style={{ color: BRAND }} />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">You're all set, {name}!</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
        Your availability has been recorded for <span className="font-semibold text-slate-700 dark:text-slate-300">{poll.title}</span>.
        The host will confirm the best time and you'll be notified.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main PollVotePage
// ─────────────────────────────────────────────────────────────
export function PollVotePage() {
  const { pollId } = useParams<{ pollId: string }>();
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Guest info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Selections
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const toggleSlot = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!pollId) return;
    (async () => {
      const { data: pollRow, error: e } = await supabase
        .from('meeting_polls')
        .select('*, profiles(full_name)')
        .eq('id', pollId)
        .maybeSingle();

      if (e || !pollRow) { setError('Poll not found.'); setLoading(false); return; }

      const { data: slotRows } = await supabase
        .from('meeting_poll_slots')
        .select('*')
        .eq('poll_id', pollId)
        .order('start_time');

      const { data: votes } = slotRows && slotRows.length > 0
        ? await supabase.from('meeting_poll_votes').select('*').in('slot_id', slotRows.map(s => s.id))
        : { data: [] };

      const { data: responses } = await supabase
        .from('meeting_poll_responses')
        .select('id')
        .eq('poll_id', pollId);

      const slots: SlotWithVotes[] = (slotRows ?? []).map(s => ({
        ...s,
        yesCount: (votes ?? []).filter(v => v.slot_id === s.id && v.availability === 'yes').length,
        maybeCount: (votes ?? []).filter(v => v.slot_id === s.id && v.availability === 'maybe').length,
        totalVotes: (votes ?? []).filter(v => v.slot_id === s.id).length,
      }));

      setPoll({
        ...pollRow,
        slots,
        totalResponses: (responses ?? []).length,
        hostName: pollRow.profiles?.full_name ?? null,
      });
      setLoading(false);
    })();
  }, [pollId]);

  const handleSubmit = async () => {
    if (!poll) return;
    if (!name.trim()) { setSubmitError('Please enter your name.'); return; }
    if (!email.trim() || !email.includes('@')) { setSubmitError('Please enter a valid email.'); return; }
    if (selected.size === 0) { setSubmitError('Please select at least one time slot.'); return; }

    setSubmitting(true);
    setSubmitError('');

    const { data: response, error: rErr } = await supabase
      .from('meeting_poll_responses')
      .insert({ poll_id: poll.id, invitee_name: name.trim(), invitee_email: email.trim(), token: crypto.randomUUID() })
      .select()
      .maybeSingle();

    if (rErr || !response) { setSubmitError(rErr?.message ?? 'Failed to submit.'); setSubmitting(false); return; }

    const votes = Array.from(selected).map(slotId => ({
      response_id: response.id,
      slot_id: slotId,
      availability: 'yes' as const,
    }));
    await supabase.from('meeting_poll_votes').insert(votes);

    setDone(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center gap-3">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold text-slate-900 dark:text-white">Poll not found</p>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  const isClosed = poll.status === 'closed';
  const isConfirmed = poll.status === 'confirmed';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND}15` }}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} style={{ color: BRAND }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                {poll.hostName && <p className="text-xs text-slate-400">Invited by {poll.hostName}</p>}
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{poll.title}</h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{poll.duration_minutes} minutes</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{LOCATION_LABEL[poll.location_type]}</span>
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{poll.totalResponses} response{poll.totalResponses !== 1 ? 's' : ''} so far</span>
            </div>

            {poll.description && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{poll.description}</p>
            )}
          </div>

          {/* Confirmed banner */}
          {isConfirmed && poll.confirmed_slot_start && (
            <div className="mx-6 mt-5 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl text-sm text-blue-700 dark:text-blue-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Meeting confirmed!</p>
                <p className="text-xs mt-0.5">
                  {new Date(poll.confirmed_slot_start).toLocaleString('en-US', { weekday:'long', month:'long', day:'numeric', hour:'numeric', minute:'2-digit' })}
                </p>
              </div>
            </div>
          )}

          {/* Closed banner */}
          {isClosed && (
            <div className="mx-6 mt-5 px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 text-center">
              This poll is closed. No more votes are being accepted.
            </div>
          )}

          {/* Body */}
          <div className="p-6">
            {done ? (
              <ThankYou poll={poll} name={name} />
            ) : isConfirmed || isClosed ? (
              /* Read-only heatmap for closed/confirmed */
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                  {isConfirmed ? 'Final vote results' : 'Vote results'}
                </p>
                <ReadOnlyGrid slots={poll.slots} />
              </div>
            ) : (
              /* Active voting */
              <div className="space-y-6">
                {/* Guest info */}
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Your info</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition"
                        style={{ '--tw-ring-color': BRAND } as React.CSSProperties}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition"
                        style={{ '--tw-ring-color': BRAND } as React.CSSProperties}
                      />
                    </div>
                  </div>
                </div>

                {/* Vote grid */}
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Which times work for you?</p>
                  <GuestVoteGrid
                    slots={poll.slots}
                    selected={selected}
                    onToggle={toggleSlot}
                    totalResponses={poll.totalResponses}
                  />
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {submitError}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? 'Submitting…' : 'Submit my availability'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by <span className="font-semibold text-slate-500">Pin on It</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Read-only heatmap grid (for closed/confirmed polls)
// ─────────────────────────────────────────────────────────────
function ReadOnlyGrid({ slots }: { slots: SlotWithVotes[] }) {
  if (slots.length === 0) return <p className="text-sm text-slate-400 py-4 text-center">No slots.</p>;

  const maxVotes = Math.max(...slots.map(s => s.yesCount), 1);

  const byDate: Record<string, SlotWithVotes[]> = {};
  for (const s of slots) {
    const key = toYMD(new Date(s.start_time));
    (byDate[key] ??= []).push(s);
  }
  const dates = Object.keys(byDate).sort();
  const allTimes = Array.from(new Set(slots.map(s => {
    const d = new Date(s.start_time);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }))).sort();

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div
        className="inline-grid gap-px bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
        style={{ gridTemplateColumns: `52px repeat(${dates.length}, minmax(60px, 1fr))` }}
      >
        <div className="bg-white dark:bg-slate-800/50 py-2" />
        {dates.map(ymd => {
          const d = new Date(ymd + 'T00:00:00');
          return (
            <div key={ymd} className="bg-white dark:bg-slate-800/50 px-1 py-2 text-center">
              <p className="text-[9px] font-semibold text-slate-400 uppercase">{d.toLocaleDateString('en-US', { weekday:'short' })}</p>
              <p className="text-xs font-bold text-slate-800 dark:text-white">{d.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</p>
            </div>
          );
        })}
        {allTimes.map(time => (
          <>
            <div key={`lbl-${time}`} className="bg-white dark:bg-slate-800/50 flex items-center justify-end pr-2">
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatTime(time)}</span>
            </div>
            {dates.map(ymd => {
              const slot = byDate[ymd]?.find(s => {
                const d = new Date(s.start_time);
                return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` === time;
              });
              if (!slot) return <div key={`${ymd}-${time}`} className="bg-slate-50 dark:bg-slate-900/40 h-9" />;
              const ratio = slot.yesCount / maxVotes;
              const alpha = Math.round(ratio * 200).toString(16).padStart(2,'0');
              return (
                <div
                  key={slot.id}
                  className="h-9 flex items-center justify-center"
                  style={{ backgroundColor: slot.yesCount > 0 ? `${BRAND}${alpha}` : '#f8fafc' }}
                >
                  {slot.yesCount > 0 && (
                    <span className="text-[10px] font-bold" style={{ color: ratio > 0.5 ? '#fff' : BRAND }}>
                      {slot.yesCount}✓
                    </span>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
