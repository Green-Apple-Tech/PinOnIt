-- Service / job-site address from in-person bookings → host contacts

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_address text;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS address text;

COMMENT ON COLUMN bookings.guest_address IS 'Optional job-site / service address provided by guest for in-person bookings';
COMMENT ON COLUMN contacts.address IS 'Primary service or mailing address for this contact (from bookings or manual entry)';
