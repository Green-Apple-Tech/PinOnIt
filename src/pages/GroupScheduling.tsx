import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { MeetingPollSlot } from '../lib/types';
import { PollCard, type PollWithStats } from './MeetingPolls';
import {
  ArrowRight, ChevronRight, Clock, Loader2, MapPin, Users, CheckCircle2,
} from 'lucide-react';

const BRAND = '#5864C6';
const POLLS_CREATE_PATH = '/dashboard/group-scheduling/polls?new=1';
const COORDINATE_NEW_PATH = '/dashboard/group-scheduling/coordinate?new=1';

type CoordStatus = 'collecting_availability' | 'match_found' | 'confirmed' | 'cancelled';

interface CoordMeeting {
  id: string;
  title: string;
  location: string | null;
  duration_minutes: number;
  status: CoordStatus;
  confirmed_time: string | null;
  created_at: string;
}

const STATUS_META: Record<CoordStatus, { label: string; color: string; bg: string }> = {
  collecting_availability: { label: 'Collecting availability', color: '#d97706', bg: '#fef3c7' },
  match_found: { label: 'Match found', color: BRAND, bg: '#eef0fb' },
  confirmed: { label: 'Confirmed', color: '#4338CA', bg: '#d1fae5' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function PathCard({
  icon,
  title,
  subtitle,
  steps,
  hint,
  buttonLabel,
  onClick,
  accent = BRAND,
}: {
  icon: string;
  title: string;
  subtitle: string;
  steps: string[];
  hint?: string;
  buttonLabel: string;
  onClick: () => void;
  accent?: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow">
      <span className="text-3xl mb-3" aria-hidden>{icon}</span>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-2 text-base text-slate-600 dark:text-slate-300 leading-relaxed flex-1">{subtitle}</p>

      <div className="grid grid-cols-3 gap-2 my-5">
        {steps.map((step, i) => (
          <div key={step} className="relative flex flex-col items-center text-center">
            {i < steps.length - 1 && (
              <ArrowRight className="absolute -right-2 top-4 h-3.5 w-3.5 text-slate-300 dark:text-slate-600 z-10 hidden sm:block" />
            )}
            <div
              className="w-full px-2 py-3 rounded-xl border text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-snug min-h-[56px] flex items-center justify-center"
              style={{ borderColor: `${accent}30`, backgroundColor: `${accent}08` }}
            >
              {step}
            </div>
          </div>
        ))}
      </div>

      {hint && (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic text-center mt-3 mb-1 leading-relaxed">
          {hint}
        </p>
      )}

      <button
        type="button"
        onClick={onClick}
        className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 text-[15px] font-semibold text-white rounded-xl transition-all hover:opacity-90 shadow-sm"
        style={{ background: accent }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export function GroupSchedulingPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [polls, setPolls] = useState<PollWithStats[]>([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [meetings, setMeetings] = useState<CoordMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);

  const loadPolls = async () => {
    if (!profile) return;
    setPollsLoading(true);
    const { data: rawPolls } = await supabase
      .from('meeting_polls')
      .select('*, meeting_poll_slots(*), meeting_poll_responses(*)')
      .eq('host_id', profile.id)
      .order('created_at', { ascending: false });

    if (!rawPolls) {
      setPollsLoading(false);
      return;
    }

    const { data: votes } = rawPolls.length > 0
      ? await supabase.from('meeting_poll_votes').select('*').in(
          'slot_id',
          rawPolls.flatMap(p => (p.meeting_poll_slots ?? []).map((s: MeetingPollSlot) => s.id)),
        )
      : { data: [] };

    const enriched: PollWithStats[] = rawPolls.map(p => ({
      ...p,
      slots: (p.meeting_poll_slots ?? []).map((s: MeetingPollSlot) => ({
        ...s,
        yesCount: (votes ?? []).filter(v => v.slot_id === s.id && v.availability === 'yes').length,
        maybeCount: (votes ?? []).filter(v => v.slot_id === s.id && v.availability === 'maybe').length,
      })).sort((a: MeetingPollSlot, b: MeetingPollSlot) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
      totalResponses: (p.meeting_poll_responses ?? []).length,
    }));

    setPolls(enriched);
    setPollsLoading(false);
  };

  const loadMeetings = async () => {
    if (!profile?.id) return;
    setMeetingsLoading(true);
    const { data } = await supabase
      .from('coordinated_meetings')
      .select('id, title, location, duration_minutes, status, confirmed_time, created_at')
      .eq('host_id', profile.id)
      .order('created_at', { ascending: false });
    setMeetings((data ?? []) as CoordMeeting[]);
    setMeetingsLoading(false);
  };

  useEffect(() => {
    void loadPolls();
    void loadMeetings();
  }, [profile?.id]);

  const handleDeletePoll = async (id: string) => {
    await supabase.from('meeting_polls').delete().eq('id', id);
    setPolls(p => p.filter(x => x.id !== id));
  };

  const handleClosePoll = async (id: string) => {
    await supabase.from('meeting_polls').update({ status: 'closed' }).eq('id', id);
    setPolls(p => p.filter(x => x.id !== id));
  };

  const handleConfirmPoll = async (pollId: string, slotId: string) => {
    const poll = polls.find(p => p.id === pollId);
    const slot = poll?.slots.find(s => s.id === slotId);
    if (!slot) return;
    await supabase.from('meeting_polls').update({
      status: 'confirmed',
      confirmed_slot_start: slot.start_time,
      confirmed_slot_end: slot.end_time,
    }).eq('id', pollId);
    setPolls(p => p.filter(x => x.id !== pollId));
  };

  const activePolls = polls.filter(p => p.status === 'open');
  const activeMeetings = meetings.filter(m =>
    m.status === 'collecting_availability' || m.status === 'match_found'
  );

  return (
    <main className="flex-1 p-4 md:p-8 max-w-5xl w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Group Scheduling</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Schedule with a group — share a poll link for colleagues, or coordinate via SMS or WhatsApp when you only have phone numbers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <PathCard
          icon="📊"
          title="Meeting Poll"
          subtitle="Share a link — anyone with email or a browser votes on times. Best for teams, colleagues, or clients you email regularly."
          steps={['Propose times', 'Everyone votes', 'You confirm']}
          hint="💡 Best when everyone can click a link"
          buttonLabel="Create a Poll →"
          onClick={() => navigate(POLLS_CREATE_PATH)}
        />
        <PathCard
          icon="💬"
          title="Coordinate Unknown Availability"
          subtitle="When you need to find a time between two or more people and nobody knows each other's schedule — just phone numbers required."
          steps={['Set timeframe', 'SMS sent', 'You confirm']}
          hint="💡 Best for external parties with unknown schedules — real estate, referrals, interviews"
          buttonLabel="Coordinate Unknown Availability →"
          onClick={() => navigate(COORDINATE_NEW_PATH)}
          accent="#4338CA"
        />
      </div>

      <section className="mb-10">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
          Active Polls
        </h2>
        {pollsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : activePolls.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No active polls yet. Create a poll so the group can vote on a time.</p>
            <button
              type="button"
              onClick={() => navigate(POLLS_CREATE_PATH)}
              className="mt-3 text-sm font-semibold hover:underline"
              style={{ color: BRAND }}
            >
              Create your first poll →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activePolls.map(p => (
              <PollCard
                key={p.id}
                poll={p}
                onDelete={handleDeletePoll}
                onClose={handleClosePoll}
                onConfirm={handleConfirmPoll}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
          Active Coordinations
        </h2>
        {meetingsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : activeMeetings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No active coordinations yet. Start one to text a time to people who only have a phone.</p>
            <button
              type="button"
              onClick={() => navigate(COORDINATE_NEW_PATH)}
              className="mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-500 hover:underline"
            >
              Start a coordination →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeMeetings.map(m => {
              const meta = STATUS_META[m.status];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate(`/dashboard/group-scheduling/coordinate?meeting=${m.id}`)}
                  className="w-full text-left p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 hover:shadow-sm transition-all group min-h-[72px]"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#eef0fb' }}>
                      <Users className="h-5 w-5" style={{ color: BRAND }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{m.title}</p>
                        <span
                          className="shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                          style={{ color: meta.color, background: meta.bg }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {m.duration_minutes < 60 ? `${m.duration_minutes} min` : `${m.duration_minutes / 60}h`}
                        </span>
                        {m.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {m.location}
                          </span>
                        )}
                        {m.confirmed_time && (
                          <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-500">
                            <CheckCircle2 className="h-3 w-3" /> {fmtDateTime(m.confirmed_time)}
                          </span>
                        )}
                        <span>{fmtDate(m.created_at)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-brand-500 transition-colors shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
