export type PersonalChannel = 'email' | 'sms' | 'whatsapp' | 'voice';
export type PersonalTiming = 'day_before' | 'hour_before' | 'ten_min';

export type PersonalReminderDefaults = Record<PersonalTiming, PersonalChannel[]>;

export const PERSONAL_TIMING_OFFSETS: Record<PersonalTiming, number> = {
  day_before: -1440,
  hour_before: -60,
  ten_min: -10,
};

export const PERSONAL_TIMING_LABELS: Record<PersonalTiming, string> = {
  day_before: 'Day before',
  hour_before: 'Hour before',
  ten_min: '10 min before',
};

export const DEFAULT_PERSONAL_REMINDER: PersonalReminderDefaults = {
  day_before: ['email'],
  hour_before: ['sms'],
  ten_min: ['sms'],
};

export function normalizePersonalDefaults(raw: unknown): PersonalReminderDefaults {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (key: PersonalTiming): PersonalChannel[] => {
    const arr = Array.isArray(src[key]) ? src[key] : DEFAULT_PERSONAL_REMINDER[key];
    return (arr as string[]).filter((c): c is PersonalChannel =>
      c === 'email' || c === 'sms' || c === 'whatsapp' || c === 'voice',
    );
  };
  return {
    day_before: pick('day_before'),
    hour_before: pick('hour_before'),
    ten_min: pick('ten_min'),
  };
}

/** Account defaults, plus any extra pings they asked for out loud. Never drops a default. */
export function mergePersonalPlans(
  base: PersonalReminderDefaults,
  extra?: Partial<PersonalReminderDefaults> | null,
): PersonalReminderDefaults {
  const out = normalizePersonalDefaults(base);
  if (!extra) return out;
  (Object.keys(PERSONAL_TIMING_OFFSETS) as PersonalTiming[]).forEach((timing) => {
    for (const channel of extra[timing] ?? []) {
      if (!out[timing].includes(channel)) out[timing].push(channel);
    }
  });
  return out;
}

export type PersonalJobKind = 'remind' | 'escalate';

export type PersonalJob = {
  fireAt: Date;
  channel: PersonalChannel;
  kind: PersonalJobKind;
};

export const ALL_PERSONAL_CHANNELS: PersonalChannel[] = ['email', 'sms', 'whatsapp', 'voice'];

const CHANNEL_LABEL: Record<PersonalChannel, string> = {
  email: 'email',
  sms: 'text',
  whatsapp: 'WhatsApp',
  voice: 'a call',
};

export function channelsInPlan(plan: PersonalReminderDefaults): PersonalChannel[] {
  const seen = new Set<PersonalChannel>();
  (Object.keys(PERSONAL_TIMING_OFFSETS) as PersonalTiming[]).forEach((timing) => {
    for (const channel of plan[timing]) seen.add(channel);
  });
  return ALL_PERSONAL_CHANNELS.filter((channel) => seen.has(channel));
}

export function formatChannelList(channels: PersonalChannel[]): string {
  const names = channels.map((channel) => CHANNEL_LABEL[channel]);
  if (names.length === 0) return 'a reminder';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function addJobs(
  jobs: PersonalJob[],
  seen: Set<string>,
  fireAt: Date,
  channels: PersonalChannel[],
  kind: PersonalJobKind,
  nowMs: number,
) {
  if (fireAt.getTime() < nowMs - 2 * 60 * 1000) return;
  for (const channel of channels) {
    const key = `${kind}|${channel}|${Math.round(fireAt.getTime() / 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push({ fireAt, channel, kind });
  }
}

export function expandPersonalJobs(
  dueAt: Date,
  plan: PersonalReminderDefaults,
  opts?: {
    now?: Date;
    /** Relative request ("in 20 minutes") also fires at the due time. */
    atTime?: boolean;
    /** No calendar event: send once at the due time. Defaults to text and a call. */
    atDueOnly?: boolean;
    explicitChannels?: PersonalChannel[];
    /** Channels for a reminder that is not added to the calendar. */
    soonChannels?: PersonalChannel[];
  },
): PersonalJob[] {
  const nowDate = opts?.now ?? new Date();
  const dueMs = dueAt.getTime();
  const nowMs = nowDate.getTime();
  const jobs: PersonalJob[] = [];
  const seen = new Set<string>();

  if (opts?.atDueOnly) {
    const named = opts.explicitChannels ?? [];
    const picked = (opts.soonChannels?.length ? opts.soonChannels : ['sms', 'voice' as PersonalChannel]).concat(named);
    const channels = ALL_PERSONAL_CHANNELS.filter((channel) => picked.includes(channel));
    addJobs(jobs, seen, dueAt, channels.length ? channels : ['sms', 'voice'], 'remind', nowMs);
    return jobs;
  }

  (Object.keys(PERSONAL_TIMING_OFFSETS) as PersonalTiming[]).forEach((timing) => {
    const offsetMin = PERSONAL_TIMING_OFFSETS[timing];
    addJobs(jobs, seen, new Date(dueMs + offsetMin * 60 * 1000), plan[timing], 'remind', nowMs);
  });

  if (opts?.atTime) {
    const named = (opts.explicitChannels ?? []).filter((channel) => ALL_PERSONAL_CHANNELS.includes(channel));
    const channels = named.length ? named : channelsInPlan(plan);
    addJobs(jobs, seen, dueAt, channels.length ? channels : ['sms'], 'remind', nowMs);
  }
  return jobs;
}

export function groupPersonalJobs(jobs: PersonalJob[]): { fireAt: Date; kind: PersonalJobKind; channels: PersonalChannel[] }[] {
  const map = new Map<string, { fireAt: Date; kind: PersonalJobKind; channels: PersonalChannel[] }>();
  for (const job of jobs) {
    const key = `${job.kind}|${job.fireAt.getTime()}`;
    const row = map.get(key) ?? { fireAt: job.fireAt, kind: job.kind, channels: [] };
    if (!row.channels.includes(job.channel)) row.channels.push(job.channel);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
