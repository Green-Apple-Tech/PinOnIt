-- Composite indexes for host + time-range reads (booking page, calendar, cron).

CREATE INDEX IF NOT EXISTS idx_bookings_host_start_time
  ON public.bookings (host_id, start_time);

CREATE INDEX IF NOT EXISTS idx_calendar_events_host_start_at
  ON public.calendar_events (host_id, start_at);
