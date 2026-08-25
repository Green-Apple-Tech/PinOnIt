/** PinOnIt’s own Calendly demo types (incl. “Piin On It Feedback”) — hide, don’t import. */
export function isPinOnItDemoFeedback(name: string): boolean {
  const n = name.toLowerCase().replace(/\s+/g, ' ');
  return /pi+n\s*on\s*it/.test(n) && /feedback/.test(n);
}

export function withoutPinOnItDemoFeedback<T extends { name: string }>(items: T[]): T[] {
  return items.filter((item) => !isPinOnItDemoFeedback(item.name));
}

export const EXAMPLE_PAID_CONSULTATION_NAME = 'Paid Consultation';

/** Calendly-style sample paid consult — show as an off example, not a live event type. */
export function isExamplePaidConsultation(s: {
  name: string;
  price_cents?: number | null;
}): boolean {
  const n = s.name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (n === 'paid consultation' || n === 'paid service/consultation') return true;
  if ((s.price_cents ?? 0) <= 0) return false;
  if (n === 'consultation') return true;
  return /^consultation\s*\(.*\)$/.test(n);
}

export function displayEventTypeName(s: {
  name: string;
  price_cents?: number | null;
}): string {
  return isExamplePaidConsultation(s) ? EXAMPLE_PAID_CONSULTATION_NAME : s.name;
}

export function bookableEventTypes<T extends { name: string; price_cents?: number | null; is_active?: boolean }>(
  items: T[],
): T[] {
  return withoutPinOnItDemoFeedback(items).filter(
    (item) => !isExamplePaidConsultation(item) && item.is_active !== false,
  );
}

/** Default booking-link checkboxes: live event types only (never demo Feedback or the paid example). */
export function defaultSelectedServiceIds<T extends { id: string; name: string; price_cents?: number | null }>(
  services: T[],
): Set<string> {
  return new Set(
    withoutPinOnItDemoFeedback(services)
      .filter((s) => !isExamplePaidConsultation(s))
      .map((s) => s.id),
  );
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
