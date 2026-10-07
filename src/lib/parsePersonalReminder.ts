import {
  type PersonalChannel,
  type PersonalReminderDefaults,
  type PersonalTiming,
} from './personalReminders';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export type ParsedPersonalReminder = {
  title: string;
  dueAt: Date | null;
  location: string;
  extras: Partial<PersonalReminderDefaults>;
};

function nextWeekday(from: Date, weekday: number, nextWeekIfSame: boolean) {
  const copy = new Date(from.getTime());
  copy.setHours(0, 0, 0, 0);
  const diff = (weekday - copy.getDay() + 7) % 7;
  const days = diff === 0 && nextWeekIfSame ? 7 : diff === 0 ? 0 : diff;
  copy.setDate(copy.getDate() + days);
  return copy;
}

function applyTime(day: Date, hours: number, minutes: number) {
  const d = new Date(day.getTime());
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function parseClock(text: string): { hours: number; minutes: number } | null {
  const m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
    || text.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)\b/i)
    || text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2] || 0);
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && hours < 12) hours += 12;
  if (ap === 'am' && hours === 12) hours = 0;
  if (!ap && hours <= 7) hours += 12;
  return { hours, minutes };
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function channelOf(chunk: string): PersonalChannel | null {
  if (/\bwhats?\s?app\b/i.test(chunk)) return 'whatsapp';
  if (/\b(e-?mail)\b/i.test(chunk)) return 'email';
  if (/\b(call me|voice call|phone call|voicemail)\b/i.test(chunk)) return 'voice';
  if (/\b(text|sms|message me)\b/i.test(chunk)) return 'sms';
  return null;
}

function timingOf(chunk: string): PersonalTiming | null {
  if (/\b(10|ten)\s*-?\s*(min|mins|minutes)\b/i.test(chunk)) return 'ten_min';
  if (/\b(an|a|1|one)\s+hours?\b|\b60\s*-?\s*(min|mins|minutes)\b/i.test(chunk)) return 'hour_before';
  if (/\b(the\s+)?(day|night)\s+before\b/i.test(chunk)) return 'day_before';
  return null;
}

/** Extra pings they asked for. "Remind me about…" itself is the event, not an extra. */
export function spokenReminderExtras(raw: string): Partial<PersonalReminderDefaults> {
  const extras: PersonalReminderDefaults = { day_before: [], hour_before: [], ten_min: [] };
  const chunks = raw.split(/\band\b/i);
  for (const chunk of chunks) {
    const timing = timingOf(chunk);
    if (!timing) continue;
    if (!/\b(before|remind|text|email|call|whatsapp|message)\b/i.test(chunk)) continue;
    const channel = channelOf(chunk) ?? 'sms';
    if (!extras[timing].includes(channel)) extras[timing].push(channel);
  }
  const any = extras.day_before.length + extras.hour_before.length + extras.ten_min.length;
  return any ? extras : {};
}

function stripScheduleWords(text: string) {
  return text
    .replace(/\b(?:and\s+)?(?:also\s+)?(?:please\s+)?(?:send|text|email|call|whatsapp|message)\s+me\b.*$/i, '')
    .replace(/\b(?:and\s+)?(?:a\s+)?(?:quick\s+)?reminder\b.*$/i, '')
    .replace(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/\b(today|tomorrow)\b/gi, '')
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function subjectFrom(text: string): string {
  const withThing = text.match(/\bwith\s+(?:the\s+|my\s+)?([a-z][\w'-]*(?:\s+(?!at\b|on\b|today\b|tomorrow\b|and\b)[a-z][\w'-]*){0,3})/i);
  if (withThing?.[1]) return `${titleCase(withThing[1])} reminder`;
  const about = text.match(/\babout\s+(?:my\s+|the\s+|a\s+)?([a-z][\w'-]*(?:\s+[a-z][\w'-]*){0,4})/i);
  if (about?.[1] && !/^my\b/i.test(about[1])) return titleCase(about[1]);
  const cleaned = stripScheduleWords(text)
    .replace(/^(about|to|that)\s+/i, '')
    .replace(/^(my|the|a)\s+/i, '')
    .replace(/^[,. ]+|[,. ]+$/g, '')
    .trim();
  if (!cleaned) return 'Reminder';
  return titleCase(cleaned);
}

function placeFrom(text: string): string {
  const match = text.match(
    /\b(?:at|in)\s+(?!\d)((?:the\s+|my\s+)?[a-z0-9][^,]{1,60}?)(?=\s+(?:at|on|today|tomorrow|and|with)\b|$)/i,
  );
  if (!match?.[1]) return '';
  const place = match[1].replace(/\s+/g, ' ').trim();
  if (/\b(am|pm|min|minute|hour|before|reminder)\b/i.test(place)) return '';
  if (/^(the\s+)?dentist$/i.test(place) && /\bwith\s+(?:the\s+)?dentist\b/i.test(text)) return '';
  return place;
}

/** Turn "remind me about my call today with the dentist at 7pm…" into a subject, time, place, and extra pings. */
export function parsePersonalReminder(raw: string, now = new Date()): ParsedPersonalReminder {
  let text = raw.trim().replace(/\s+/g, ' ');
  text = text.replace(/^(hey |ok |okay |please )?/i, '');
  text = text.replace(/^remind me (to |about |that i (need to |have to |should )?)?/i, '');

  const clock = parseClock(text) ?? { hours: 9, minutes: 0 };
  const lower = text.toLowerCase();
  let day: Date | null = null;
  let saidToday = false;

  if (/\btomorrow\b/.test(lower)) {
    day = new Date(now.getTime());
    day.setDate(day.getDate() + 1);
  } else if (/\btoday\b/.test(lower)) {
    day = new Date(now.getTime());
    saidToday = true;
  } else {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const name = WEEKDAYS[i];
      const next = new RegExp(`\\bnext\\s+${name}\\b`);
      const plain = new RegExp(`\\b${name}\\b`);
      if (next.test(lower)) {
        day = nextWeekday(now, i, true);
        break;
      }
      if (plain.test(lower)) {
        day = nextWeekday(now, i, false);
        break;
      }
    }
  }

  const dueAt = day ? applyTime(day, clock.hours, clock.minutes) : null;
  if (dueAt && dueAt.getTime() <= now.getTime()) {
    dueAt.setDate(dueAt.getDate() + (saidToday ? 1 : 7));
  }

  return {
    title: subjectFrom(text),
    dueAt,
    location: placeFrom(text),
    extras: spokenReminderExtras(raw),
  };
}
