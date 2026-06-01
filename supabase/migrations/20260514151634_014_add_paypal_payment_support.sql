/*
  # Add PayPal payment support to services and bookings

  1. New columns on `services`
    - `payment_provider` (text, default 'none') — 'none' | 'stripe' | 'paypal'
    - `paypal_client_id` (text, nullable) — host's PayPal client ID for the JS SDK
    - `paypal_currency` (text, default 'USD') — ISO currency code

  2. New columns on `bookings`
    - `paypal_order_id` (text, nullable) — PayPal order ID captured at booking time
    - `payment_provider` (text, nullable) — which provider processed this booking's payment

  All changes are additive with safe defaults — no data loss.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='payment_provider') THEN
    ALTER TABLE services ADD COLUMN payment_provider text NOT NULL DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='paypal_client_id') THEN
    ALTER TABLE services ADD COLUMN paypal_client_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='paypal_currency') THEN
    ALTER TABLE services ADD COLUMN paypal_currency text NOT NULL DEFAULT 'USD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='paypal_order_id') THEN
    ALTER TABLE bookings ADD COLUMN paypal_order_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_provider') THEN
    ALTER TABLE bookings ADD COLUMN payment_provider text;
  END IF;
END $$;
