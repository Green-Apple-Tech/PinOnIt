-- Performance indexes for common query patterns (idempotent)

CREATE INDEX IF NOT EXISTS idx_bookings_host_id ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_contacts_host_id ON contacts(host_id);
CREATE INDEX IF NOT EXISTS idx_services_host_id ON services(host_id);
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug);
-- PinOnIt uses connected_calendars (not google_calendar_tokens)
CREATE INDEX IF NOT EXISTS idx_connected_calendars_host_id ON connected_calendars(host_id);
