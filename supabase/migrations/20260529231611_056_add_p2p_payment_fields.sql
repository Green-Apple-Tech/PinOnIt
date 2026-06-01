/*
  # Add peer-to-peer payment fields to services table

  ## Summary
  Replaces the old PayPal Client ID / Stripe payment model with a simpler
  peer-to-peer payment model where hosts share their personal payment links.

  ## New Columns on `services`
  - `paypal_me_link` (text, nullable) — e.g. "paypal.me/johnsmith"
  - `venmo_handle` (text, nullable) — e.g. "@johnsmith"
  - `cashapp_tag` (text, nullable) — e.g. "$johnsmith"
  - `zelle_contact` (text, nullable) — phone or email for Zelle

  ## Changed Columns on `services`
  - `payment_provider` — extended allowed values to include 'p2p'
    (existing 'none'/'paypal'/'stripe' rows kept as-is; 'paypal' rows
    will be treated as legacy and rendered gracefully)

  ## Notes
  - `paypal_client_id` column is left in place (not dropped) to preserve
    existing data; it is simply no longer used in the UI.
  - No data migration needed — new columns default to NULL.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'paypal_me_link'
  ) THEN
    ALTER TABLE services ADD COLUMN paypal_me_link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'venmo_handle'
  ) THEN
    ALTER TABLE services ADD COLUMN venmo_handle text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'cashapp_tag'
  ) THEN
    ALTER TABLE services ADD COLUMN cashapp_tag text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'zelle_contact'
  ) THEN
    ALTER TABLE services ADD COLUMN zelle_contact text;
  END IF;
END $$;
