import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Mic, Square, Loader2, Check, Mail, MessageSquare, PhoneCall, X, PenLine, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { syncPersonalReminderToExternalCalendars } from '../lib/writeCalendarEvent';
import { parsePersonalReminder } from '../lib/parsePersonalReminder';
import { refinePersonalReminder } from '../lib/refinePersonalReminder';
import {
  PERSONAL_TIMING_LABELS,
  expandPersonalJobs,
  formatChannelList,
  groupPersonalJobs,
  mergePersonalPlans,
  normalizePersonalDefaults,
  type PersonalChannel,
  type PersonalReminderDefaults,
  type PersonalTiming,
} from '../lib/personalReminders';

export type VoicePersonalReminderHandle = {
  openTypeModal: () => void;
};

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

export const VoicePersonalReminder = forwardRef<VoicePersonalReminderHandle>(function VoicePersonalReminder(_props, ref) {
  const { user, profile, refreshProfile } = useAuth();
  const defaults = normalizePersonalDefaults(profile?.personal_reminder_defaults);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [title, setTitle] = useState('');
  const [dueLocal, setDueLocal] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [parsing, setParsing] = useState(false);
  const recognizerRef = useRef<SpeechRec | null>(null);
  const heardRef = useRef('');
  const [plan, setPlan] = useState<PersonalReminderDefaults>(defaults);
  const [explicitChannels, setExplicitChannels] = useState<PersonalChannel[]>([]);
  const [soonChannels, setSoonChannels] = useState<PersonalChannel[]>(['sms', 'voice']);
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
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

  const openTypeModal = useCallback(() => {
    recognizerRef.current?.stop();
    setChooserOpen(false);
    setListening(false);
    setTranscript('');
    setTitle('');
    setNotes('');
    setLocation('');
    setDueLocal('');
    setPlan(defaults);
    setExplicitChannels([]);
    setSoonChannels(['sms', 'voice']);
    setAddToCalendar(true);
    setError('');
    setModalOpen(true);
  }, [defaults]);

  const openChooser = useCallback(() => {
    recognizerRef.current?.stop();
    setListening(false);
    setError('');
    setModalOpen(false);
    setChooserOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({ openTypeModal: openChooser }), [openChooser]);

  const fillFromParse = (spoken: string, parsed: ReturnType<typeof parsePersonalReminder>) => {
    setTranscript(spoken);
    setTitle(parsed.title);
    setLocation(parsed.location);
    setDueLocal(parsed.dueAt ? toLocalInput(parsed.dueAt) : '');
    setPlan(mergePersonalPlans(defaults, parsed.extras));
    setExplicitChannels(parsed.explicitChannels);
    const next: PersonalChannel[] = ['sms', 'voice'];
    for (const channel of parsed.explicitChannels) {
      if (!next.includes(channel)) next.push(channel);
    }
    setSoonChannels(next);
    setAddToCalendar(true);
    setError(parsed.dueAt ? '' : 'Pick a day and time — I heard the task but not when.');
    setChooserOpen(false);
    setModalOpen(true);
  };

  const parseTicket = useRef(0);
  const userEdited = useRef(false);

  const applySpeech = (spoken: string) => {
    const ticket = ++parseTicket.current;
    userEdited.current = false;
    const local = parsePersonalReminder(spoken);
    fillFromParse(spoken, local);
    setParsing(true);
    void refinePersonalReminder(spoken)
      .then((parsed) => {
        if (parseTicket.current !== ticket || userEdited.current) return;
        fillFromParse(spoken, parsed);
      })
      .finally(() => {
        if (parseTicket.current === ticket) setParsing(false);
      });
  };

  const startListening = () => {
    if (listening) {
      recognizerRef.current?.stop();
      return;
    }
    setError('');
    const SR = (window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!SR) {
      setTranscript('');
      setTitle('');
      setLocation('');
      setDueLocal('');
      setError('Voice is not available in this browser. Type it instead.');
      setChooserOpen(false);
      setModalOpen(true);
      return;
    }
    const rec = new SR();
    recognizerRef.current = rec;
    heardRef.current = '';
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    let interimHeld = '';
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setListening(false);
      const spoken = `${heardRef.current} ${interimHeld}`.trim();
      if (spoken) applySpeech(spoken);
      else {
        setError('Could not hear that. Try again or type it.');
        setChooserOpen(false);
        setModalOpen(true);
      }
    };
    rec.onresult = (ev) => {
      const results = ev.results as unknown as ArrayLike<{ isFinal?: boolean; 0?: { transcript?: string } }>;
      let finalText = '';
      let interim = '';
      for (let i = 0; i < results.length; i++) {
        const piece = results[i]?.[0]?.transcript ?? '';
        if (results[i]?.isFinal) finalText += `${piece} `;
        else interim += piece;
      }
      interimHeld = interim;
      if (finalText.trim()) heardRef.current = finalText.trim();
      const live = `${heardRef.current} ${interim}`.trim();
      if (live) setTranscript(live);
    };
    rec.onerror = () => finish();
    rec.onend = () => finish();
    setListening(true);
    setTranscript('');
    rec.start();
  };

  const closeModal = () => {
    setModalOpen(false);
    setListening(false);
    setError('');
  };

  const toggleChannel = (timing: PersonalTiming, channel: PersonalChannel) => {
    userEdited.current = true;
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
    const jobs = addToCalendar
      ? expandPersonalJobs(dueAt, chosen)
      : expandPersonalJobs(dueAt, { day_before: [], hour_before: [], ten_min: [] }, {
        atDueOnly: true,
        soonChannels: useDefaults ? ['sms', 'voice'] : soonChannels,
      });
    if (jobs.length === 0) {
      setError('Choose at least one reminder (or skip to use the defaults).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const subject = title.trim();
      const details = [transcript.trim(), notes.trim()].filter(Boolean).join('\n\n');
      const { data: reminder, error: remErr } = await supabase
        .from('personal_reminders')
        .insert({
          host_id: user.id,
          title: subject,
          transcript: details || null,
          location: location.trim() || null,
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
          kind: j.kind,
        })),
      );
      if (jobErr) throw jobErr;

      if (addToCalendar) {
        try {
          await syncPersonalReminderToExternalCalendars({
            reminderId: reminder.id,
            addToCalendar: true,
          });
        } catch {
          // Reminder saved; calendar sync is best-effort
        }
      }

      if (profile?.id) {
        await supabase
          .from('profiles')
          .update({ personal_reminder_add_to_calendar: true })
          .eq('id', profile.id);
        await refreshProfile();
      }

      setModalOpen(false);
      setTranscript('');
      setTitle('');
      setNotes('');
      setLocation('');
      setDueLocal('');
      await loadUpcoming();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save reminder');
    }
    setSaving(false);
  };

  const markDone = async (id: string) => {
    if (!user?.id) return;
    await supabase
      .from('personal_reminders')
      .update({ status: 'done', acknowledged_at: new Date().toISOString() })
      .eq('id', id)
      .eq('host_id', user.id);
    await loadUpcoming();
  };

  const previewDue = dueLocal ? new Date(dueLocal) : null;
  const previewGroups = previewDue && !Number.isNaN(previewDue.getTime())
    ? groupPersonalJobs(addToCalendar
      ? expandPersonalJobs(previewDue, plan)
      : expandPersonalJobs(previewDue, { day_before: [], hour_before: [], ten_min: [] }, {
        atDueOnly: true,
        soonChannels,
      }))
    : [];

  const closeChooser = () => {
    recognizerRef.current?.stop();
    setListening(false);
    setChooserOpen(false);
    setError('');
  };

  return (
    <>
      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Coming up</p>
          <ul className="space-y-1.5">
            {upcoming.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-300">
                <span>
                  <span className="font-medium">{r.title}</span>
                  <span className="text-slate-400"> · {new Date(r.due_at).toLocaleString()}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void markDone(r.id)}
                  className="shrink-0 text-xs font-semibold text-brand-700 hover:underline"
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chooserOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={closeChooser}
        >
          <div
            role="dialog"
            aria-labelledby="reminder-choice-title"
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="reminder-choice-title" className="text-base font-bold text-slate-900 dark:text-white">
                Add a reminder
              </h3>
              <button type="button" onClick={closeChooser} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {listening && transcript ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">“{transcript}”</p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="button"
              onClick={startListening}
              className={`w-full min-h-14 inline-flex items-center justify-center gap-2 rounded-2xl text-white text-base font-semibold ${
                listening ? 'bg-red-500' : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {listening ? 'Tap to finish' : 'Speak your AI Reminder'}
            </button>
            <button
              type="button"
              onClick={openTypeModal}
              className="w-full min-h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-base font-semibold"
            >
              <PenLine className="h-5 w-5" />
              Type Reminder
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-labelledby="personal-reminder-title"
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 pt-5 pb-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 id="personal-reminder-title" className="text-base font-bold text-slate-900 dark:text-white">
                  New reminder
                </h3>
              </div>
              <button type="button" onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {transcript ? (
                <p className="text-xs text-slate-400 italic">Heard: “{transcript}”</p>
              ) : null}
              {parsing ? (
                <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sorting subject, place, and time…
                </p>
              ) : null}

              {previewGroups.length > 0 && (
                <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/60 dark:bg-brand-500/10 p-3 space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Confirm: {title.trim() || 'this reminder'}
                    {previewDue ? ` · ${previewDue.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                  </p>
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                    {previewGroups.map((group) => (
                      <li key={`${group.kind}-${group.fireAt.toISOString()}`}>
                        {group.fireAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        {' · '}
                        {formatChannelList(group.channels)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Subject</span>
                <input
                  value={title}
                  onChange={(e) => {
                    userEdited.current = true;
                    setTitle(e.target.value);
                  }}
                  autoFocus
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base"
                  placeholder="Dentist reminder"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Place (optional)</span>
                <input
                  value={location}
                  onChange={(e) => {
                    userEdited.current = true;
                    setLocation(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base"
                  placeholder="Downtown office"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Date &amp; time</span>
                <input
                  type="datetime-local"
                  value={dueLocal}
                  onChange={(e) => {
                    userEdited.current = true;
                    setDueLocal(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Notes (optional)</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base"
                  placeholder="Bring contract / her number is…"
                />
              </label>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addToCalendar}
                    onChange={(e) => {
                      const on = e.target.checked;
                      userEdited.current = true;
                      setAddToCalendar(on);
                      if (on) {
                        setPlan(mergePersonalPlans(defaults));
                      } else {
                        const next: PersonalChannel[] = ['sms', 'voice'];
                        for (const channel of explicitChannels) {
                          if (!next.includes(channel)) next.push(channel);
                        }
                        setSoonChannels(next);
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <CalendarDays className="h-4 w-4 text-brand-600" />
                      Also add to Google / Outlook calendar
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Checked: starts with your saved reminders, and you can add channels. Unchecked: a text and a call at the time you set, and you can add the others.
                    </span>
                  </span>
                </label>
              </div>

              <p className="text-xs font-medium text-slate-500 pt-1">
                {addToCalendar
                  ? 'These are your saved reminders for this one. Turn on any other channel you want.'
                  : 'This stays off the calendar. It is a text and a call at that time. Turn on email or WhatsApp if you want those too.'}
              </p>
              {!addToCalendar ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">At that time</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CHANNELS.map((ch) => {
                      const on = soonChannels.includes(ch.id);
                      const Icon = ch.icon || Mail;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            userEdited.current = true;
                            setSoonChannels((prev) => (
                              prev.includes(ch.id) ? prev.filter((channel) => channel !== ch.id) : [...prev, ch.id]
                            ));
                          }}
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
              ) : (
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
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex flex-col sm:flex-row gap-2 pt-1 pb-1">
                <button
                  type="button"
                  onClick={() => void save(true)}
                  disabled={saving}
                  className="flex-1 min-h-12 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
                >
                  {addToCalendar ? 'Use saved defaults' : 'Text and call only'}
                </button>
                <button
                  type="button"
                  onClick={() => void save(false)}
                  disabled={saving}
                  className="flex-1 min-h-12 rounded-xl bg-brand-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Confirm and schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

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
        Used when you skip the checkboxes after adding a personal reminder. Default: email the day before, a text 1 hour before, and a text 10 minutes before.
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
