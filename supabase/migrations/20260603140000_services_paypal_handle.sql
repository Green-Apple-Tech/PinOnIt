-- PayPal handle for guest-facing payment display (alongside paypal_me_link)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS paypal_handle text;

UPDATE services
SET paypal_handle = paypal_me_link
WHERE paypal_handle IS NULL AND paypal_me_link IS NOT NULL AND btrim(paypal_me_link) <> '';
