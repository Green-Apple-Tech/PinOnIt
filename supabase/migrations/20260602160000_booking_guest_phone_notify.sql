-- Optional guest email; phone + notification channel for confirmations/reminders
ALTER TABLE bookings
  ALTER COLUMN guest_email DROP NOT NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS notify_via text;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_notify_via_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_notify_via_check
  CHECK (notify_via IS NULL OR notify_via IN ('email', 'sms', 'whatsapp'));
