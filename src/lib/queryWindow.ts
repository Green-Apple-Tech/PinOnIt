/** Date bounds so booking/calendar queries do not pull unbounded history. */

export function isoWindow(pastDays: number, futureDays: number) {
  const from = new Date(Date.now() - pastDays * 86400000);
  const to = new Date(Date.now() + futureDays * 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Public booking page: yesterday through ~3 months (typical booking_window_days). */
export function publicBusyWindow() {
  return isoWindow(2, 93);
}

/** Host calendar / dashboard: 90 days back, ~13 months forward. */
export function hostCalendarWindow() {
  return isoWindow(90, 400);
}
