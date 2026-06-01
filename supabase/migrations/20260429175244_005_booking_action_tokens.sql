/*
  # Add action tokens to bookings

  Adds a `action_token` column to bookings — a random secret generated at insert time.
  This token is included in confirmation/cancellation emails so only the recipient
  (host or guest) can confirm or cancel a booking via the booking-reply edge function.

  1. Changes
    - `bookings.action_token` (text, unique, not null) — set via DEFAULT gen_random_uuid()
      cast to text, so every new booking gets a unique token automatically.
      Existing rows get a backfilled UUID.

  2. Security
    - The booking-reply function will require this token alongside the booking_id,
      preventing enumeration attacks where an attacker iterates booking UUIDs.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'action_token'
  ) THEN
    ALTER TABLE bookings ADD COLUMN action_token text NOT NULL DEFAULT gen_random_uuid()::text;
  END IF;
END $$;

-- Backfill any rows that got the same default (shouldn't happen, but be safe)
UPDATE bookings SET action_token = gen_random_uuid()::text WHERE action_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_action_token ON bookings(action_token);
