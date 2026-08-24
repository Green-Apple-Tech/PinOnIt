/** PinOnIt’s own Calendly demo types (incl. “Piin On It Feedback”) — hide, don’t import. */
export function isPinOnItDemoFeedback(name: string): boolean {
  const n = name.toLowerCase().replace(/\s+/g, ' ');
  return /pi+n\s*on\s*it/.test(n) && /feedback/.test(n);
}

export function isThirtyMinIncludedByDefault(s: { name: string; duration_minutes: number }): boolean {
  const n = s.name.toLowerCase().replace(/\s+/g, ' ');
  if (/feedback/.test(n) && /pin/.test(n)) return false;
  return (
    n.includes('30 min consultation') ||
    n.includes('30 minute consultation') ||
    n.includes('30 minute meeting') ||
    (s.duration_minutes === 30 && /consultation/.test(n))
  );
}

export function withoutPinOnItDemoFeedback<T extends { name: string }>(items: T[]): T[] {
  return items.filter((item) => !isPinOnItDemoFeedback(item.name));
}

/** Default booking-link checkboxes: only the 30-min consultation (never demo Feedback, never “select all”). */
export function defaultSelectedServiceIds<T extends { id: string; name: string; duration_minutes: number }>(
  services: T[],
): Set<string> {
  const visible = withoutPinOnItDemoFeedback(services);
  const matches = visible.filter(isThirtyMinIncludedByDefault);
  if (matches.length > 0) return new Set(matches.map((s) => s.id));
  const fallback = visible.find((s) => s.duration_minutes === 30);
  if (fallback) return new Set([fallback.id]);
  return new Set();
}
