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

export function expandPersonalJobs(dueAt: Date, plan: PersonalReminderDefaults) {
  const dueMs = dueAt.getTime();
  const now = Date.now();
  const jobs: { fireAt: Date; channel: PersonalChannel }[] = [];
  (Object.keys(PERSONAL_TIMING_OFFSETS) as PersonalTiming[]).forEach((timing) => {
    const offsetMin = PERSONAL_TIMING_OFFSETS[timing];
    const fireAt = new Date(dueMs + offsetMin * 60 * 1000);
    if (fireAt.getTime() < now - 2 * 60 * 1000) return;
    for (const channel of plan[timing]) {
      jobs.push({ fireAt, channel });
    }
  });
  return jobs;
}
