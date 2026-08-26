import { useCallback, useEffect, useState } from 'react';
import { Mic, Square, Loader2, Check, Mail, MessageSquare, PhoneCall } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { parsePersonalReminder } from '../lib/parsePersonalReminder';
import {
  PERSONAL_TIMING_LABELS,
  expandPersonalJobs,
  normalizePersonalDefaults,
  type PersonalChannel,
  type PersonalReminderDefaults,
  type PersonalTiming,
} from '../lib/personalReminders';

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: Array<Array<{ transcript: string }> | undefined> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const CHANNELS: { id: PersonalChannel; label: string; icon: typeof Mail }[] = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'voice', label: 'Voice', icon: PhoneCall },
];

const TIMINGS: PersonalTiming[] = ['day_before', 'hour_before', 'ten_min'];

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function VoicePersonalReminder() {
  const { user, profile } = useAuth();
  const defaults = normalizePersonalDefaults(profile?.personal_reminder_defaults);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [title, setTitle] = useState('');
  const [dueLocal, setDueLocal] = useState('');
  const [plan, setPlan] = useState<PersonalReminderDefaults>(defaults);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [upcoming, setUpcoming] = useState<{ id: string; title: string; due_at: string }[]>([]);

  const loadUpcoming = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('personal_reminders')
      .select('id, title, due_at')
      .eq('host_id', user.id)
      .eq('status', 'active')
      .gte('due_at', new Date().toISOString())
      .order('due_at')
      .limit(8);
    setUpcoming(data ?? []);
  }, [user?.id]);

  useEffect(() => {
    void loadUpcoming();
  }, [loadUpcoming]);

  useEffect(() => {
    setPlan(defaults);
  }, [profile?.personal_reminder_defaults]);

  const applySpeech = (spoken: string) => {
    const parsed = parsePersonalReminder(spoken);
    setTranscript(spoken);
    setTitle(parsed.title);
    setDueLocal(parsed.dueAt ? toLocalInput(parsed.dueAt) : '');
    setPlan(defaults);
    setConfirming(true);
    setError(parsed.dueAt ? '' : 'Pick a day and time — I heard the task but not when.');
  };

  const startListening = () => {
    setError('');
    const SR = (window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!SR) {
      setConfirming(true);
      setTranscript('');
      setTitle('');
      setDueLocal('');
      setError('Voice is not available in this browser. Type it below instead.');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const spoken = ev.results[0]?.[0]?.transcript ?? '';
      if (spoken) applySpeech(spoken);
    };
    rec.onerror = () => {
      setListening(false);
      setError('Could not hear that. Try again or type it.');
      setConfirming(true);
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const toggleChannel = (timing: PersonalTiming, channel: PersonalChannel) => {
    setPlan((prev) => {
      const has = prev[timing].includes(channel);
      const next = has ? prev[timing].filter((c) => c !== channel) : [...prev[timing], channel];
      return { ...prev, [timing]: next };
    });
  };

  const save = async (useDefaults: boolean) => {
    if (!user?.id) return;
    const chosen = useDefaults ? defaults : plan;
    if (!title.trim()) {
      setError('What should we remind you about?');
      return;
    }
    if (!dueLocal) {
      setError('Pick a day and time.');
      return;
    }
    const dueAt = new Date(dueLocal);
    if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() < Date.now() - 60_000) {
      setError('Pick a time in the future.');
      return;
    }
    const jobs = expandPersonalJobs(dueAt, chosen);
    if (jobs.length === 0) {
      setError('Choose at least one reminder (or skip to use the defaults).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data: reminder, error: remErr } = await supabase
        .from('personal_reminders')
        .insert({
          host_id: user.id,
          title: title.trim(),
          transcript: transcript || null,
          due_at: dueAt.toISOString(),
          status: 'active',
        })
        .select('id')
        .single();
      if (remErr || !reminder) throw remErr ?? new Error('Could not save reminder');
      const { error: jobErr } = await supabase.from('personal_reminder_jobs').insert(
        jobs.map((j) => ({
          reminder_id: reminder.id,
          host_id: user.id,
          fire_at: j.fireAt.toISOString(),
          channel: j.channel,
        })),
      );
      if (jobErr) throw jobErr;
      setConfirming(false);
      setTranscript('');
      setTitle('');
      setDueLocal('');
      await loadUpcoming();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save reminder');
    }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 md:p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Remind me…</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tap record and say something like “remind me to call Jennifer Smith next Tuesday.” Skip uses email the day before and hour before, and SMS 10 minutes before.
        </p>
      </div>

      <button
        type="button"
        onClick={startListening}
        disabled={listening}
        className={`w-full min-h-14 inline-flex items-center justify-center gap-2 rounded-2xl text-white text-base font-semibold ${
          listening ? 'bg-red-500' : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        {listening ? 'Listening…' : 'Record'}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(true);
          setError('');
        }}
        className="w-full min-h-11 text-sm font-semibold text-brand-600"
      >
        Or type it instead
      </button>

      {confirming && (
        <div className="space-y-3 pt-1">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">What</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base"
              placeholder="Call Jennifer Smith"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">When</span>
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base"
            />
          </label>

          <p className="text-xs font-medium text-slate-500 pt-1">When to ping you (skip = defaults)</p>
          <div className="space-y-2">
            {TIMINGS.map((timing) => (
              <div key={timing} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  {PERSONAL_TIMING_LABELS[timing]}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CHANNELS.map((ch) => {
                    const on = plan[timing].includes(ch.id);
                    const Icon = ch.icon || Mail;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => toggleChannel(timing, ch.id)}
                        className={`min-h-11 rounded-xl border text-xs font-semibold px-2 py-2 inline-flex items-center justify-center gap-1 ${
                          on
                            ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10 text-brand-700'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={saving}
              className="flex-1 min-h-12 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
            >
              Skip — use defaults
            </button>
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={saving}
              className="flex-1 min-h-12 rounded-xl bg-brand-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save reminders
            </button>
          </div>
        </div>
      )}

      {!confirming && error && <p className="text-sm text-red-600">{error}</p>}

      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Coming up</p>
          <ul className="space-y-1.5">
            {upcoming.map((r) => (
              <li key={r.id} className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">{r.title}</span>
                <span className="text-slate-400"> · {new Date(r.due_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PersonalReminderDefaultsEditor() {
  const { profile, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<PersonalReminderDefaults>(
    normalizePersonalDefaults(profile?.personal_reminder_defaults),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPlan(normalizePersonalDefaults(profile?.personal_reminder_defaults));
  }, [profile?.personal_reminder_defaults]);

  const toggle = (timing: PersonalTiming, channel: PersonalChannel) => {
    setPlan((prev) => {
      const has = prev[timing].includes(channel);
      const next = has ? prev[timing].filter((c) => c !== channel) : [...prev[timing], channel];
      return { ...prev, [timing]: next.length ? next : prev[timing] };
    });
  };

  const save = async () => {
    if (!profile?.id) return;
    setSaving(true);
    await supabase.from('profiles').update({ personal_reminder_defaults: plan }).eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Used when you skip the checkboxes after recording. Default: email day before, email hour before, SMS 10 minutes before.
      </p>
      {TIMINGS.map((timing) => (
        <div key={timing}>
          <p className="text-sm font-semibold mb-1.5">{PERSONAL_TIMING_LABELS[timing]}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CHANNELS.map((ch) => {
              const on = plan[timing].includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => toggle(timing, ch.id)}
                  className={`min-h-11 rounded-xl border text-xs font-semibold ${
                    on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="min-h-11 px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold"
      >
        {saved ? 'Saved' : saving ? 'Saving…' : 'Save voice-reminder defaults'}
      </button>
    </div>
  );
}
