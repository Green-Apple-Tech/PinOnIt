-- Store guest notification channels as an array (email, sms, whatsapp)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_notify_via_check;

ALTER TABLE bookings
  ALTER COLUMN notify_via TYPE text[]
  USING CASE
    WHEN notify_via IS NULL THEN NULL
    WHEN notify_via = '' THEN NULL
    ELSE ARRAY[notify_via]::text[]
  END;

ALTER TABLE bookings ADD CONSTRAINT bookings_notify_via_check
  CHECK (
    notify_via IS NULL
    OR (
      notify_via <@ ARRAY['email', 'sms', 'whatsapp']::text[]
      AND cardinality(notify_via) >= 1
    )
  );
