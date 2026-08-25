/** PinOnIt’s own Calendly demo types (incl. “Piin On It Feedback”) — hide, don’t import. */
export function isPinOnItDemoFeedback(name: string): boolean {
  const n = name.toLowerCase().replace(/\s+/g, ' ');
  return /pi+n\s*on\s*it/.test(n) && /feedback/.test(n);
}

export function withoutPinOnItDemoFeedback<T extends { name: string }>(items: T[]): T[] {
  return items.filter((item) => !isPinOnItDemoFeedback(item.name));
}

/** Default booking-link checkboxes: every real event type (never PinOnIt demo Feedback). */
export function defaultSelectedServiceIds<T extends { id: string; name: string }>(
  services: T[],
): Set<string> {
  return new Set(withoutPinOnItDemoFeedback(services).map((s) => s.id));
}

export type EventTypeSlugInput = {
  id?: string;
  name: string;
  duration_minutes: number;
  price_cents?: number | null;
};

/** Public booking-link token, e.g. 15_min_consult or 60_min_paid. */
export function eventTypeSlug(s: EventTypeSlugInput): string {
  const paid = (s.price_cents ?? 0) > 0;
  const words = s.name
    .toLowerCase()
    .replace(/consultation/g, 'consult')
    .replace(/\$[\d.,]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bmin(?:ute)?s?\b/g, ' ')
    .replace(new RegExp(`\\b${s.duration_minutes}\\b`, 'g'), ' ')
    .replace(/\b\d+\b/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w && w !== 'paid');

  if (paid && (words.length === 0 || (words.length === 1 && words[0] === 'consult'))) {
    return `${s.duration_minutes}_min_paid`;
  }

  const rest = words.join('_');
  const base = rest ? `${s.duration_minutes}_min_${rest}` : `${s.duration_minutes}_min`;
  if (paid && !base.endsWith('_paid')) return `${base}_paid`;
  return base;
}

export function serviceMatchesTypeToken(
  s: EventTypeSlugInput & { id: string },
  token: string,
): boolean {
  const t = token.trim();
  if (!t) return false;
  if (s.id === t) return true;
  return eventTypeSlug(s).toLowerCase() === t.toLowerCase();
}
