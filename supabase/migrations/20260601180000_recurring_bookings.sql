-- Recurring bookings (PinOnIt event types live in the `services` table)

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency text DEFAULT null,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date DEFAULT null,
  ADD COLUMN IF NOT EXISTS recurrence_end_occurrences integer DEFAULT null,
  ADD COLUMN IF NOT EXISTS max_recurring_clients integer DEFAULT null;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency text DEFAULT null,
  ADD COLUMN IF NOT EXISTS parent_booking_id uuid DEFAULT null REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_parent_booking_id_idx ON bookings(parent_booking_id);
CREATE INDEX IF NOT EXISTS bookings_recurring_series_idx ON bookings(service_id, is_recurring) WHERE is_recurring = true;
