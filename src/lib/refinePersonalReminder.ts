import { supabase } from './supabase';
import {
  type PersonalChannel,
  type PersonalTiming,
} from './personalReminders';
import { parsePersonalReminder, type ParsedPersonalReminder } from './parsePersonalReminder';

const TIMINGS: PersonalTiming[] = ['day_before', 'hour_before', 'ten_min'];
const CHANNELS: PersonalChannel[] = ['email', 'sms', 'whatsapp', 'voice'];

function asChannel(value: unknown): PersonalChannel | null {
  return CHANNELS.includes(value as PersonalChannel) ? (value as PersonalChannel) : null;
}

/** Ask the model to split a spoken reminder. Falls back to the local parse when it cannot. */
export async function refinePersonalReminder(spoken: string, now = new Date()): Promise<ParsedPersonalReminder> {
  const local = parsePersonalReminder(spoken, now);
  try {
    const { data, error } = await supabase.functions.invoke('parse-personal-reminder', {
      body: {
        transcript: spoken,
        now: now.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      },
    });
    if (error || !data || typeof data !== 'object') return local;
    const row = data as {
      title?: unknown;
      location?: unknown;
      date?: unknown;
      time?: unknown;
      in_minutes?: unknown;
      extras?: Partial<Record<PersonalTiming, unknown>>;
    };
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const location = typeof row.location === 'string' ? row.location.trim() : local.location;
    let dueAt = local.dueAt;
    let relative = local.relative;
    if (!local.relative && typeof row.in_minutes === 'number' && row.in_minutes >= 1 && row.in_minutes <= 24 * 60) {
      dueAt = new Date(now.getTime() + Math.round(row.in_minutes) * 60 * 1000);
      relative = true;
    } else if (!local.relative && typeof row.date === 'string' && typeof row.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && /^\d{2}:\d{2}$/.test(row.time)) {
      const parsed = new Date(`${row.date}T${row.time}`);
      if (!Number.isNaN(parsed.getTime())) dueAt = parsed;
    }
    const extras: ParsedPersonalReminder['extras'] = {};
    for (const timing of TIMINGS) {
      const list = Array.isArray(row.extras?.[timing]) ? row.extras?.[timing] : [];
      const channels = (list as unknown[]).map(asChannel).filter((c): c is PersonalChannel => Boolean(c));
      if (channels.length) extras[timing] = channels;
    }
    return {
      title: title || local.title,
      location,
      dueAt,
      extras: Object.keys(extras).length ? extras : local.extras,
      relative,
      explicitChannels: local.explicitChannels,
    };
  } catch {
    return local;
  }
}
