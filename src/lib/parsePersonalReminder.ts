const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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

/** Turn "remind me to call Jennifer Smith next Tuesday" into a title + due date. */
export function parsePersonalReminder(raw: string, now = new Date()): { title: string; dueAt: Date | null } {
  let text = raw.trim().replace(/\s+/g, ' ');
  text = text.replace(/^(hey |ok |okay |please )?/i, '');
  text = text.replace(/^remind me (to |that i (need to |have to |should )?)?/i, '');

  const clock = parseClock(text) ?? { hours: 9, minutes: 0 };
  const lower = text.toLowerCase();
  let day: Date | null = null;

  if (/\btomorrow\b/.test(lower)) {
    day = new Date(now.getTime());
    day.setDate(day.getDate() + 1);
  } else if (/\btoday\b/.test(lower)) {
    day = new Date(now.getTime());
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
    dueAt.setDate(dueAt.getDate() + 7);
  }

  const title = text
    .replace(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/\b(today|tomorrow)\b/gi, '')
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,. ]+|[,. ]+$/g, '')
    .trim() || text;

  const pretty = title.charAt(0).toUpperCase() + title.slice(1);
  return { title: pretty, dueAt };
}
