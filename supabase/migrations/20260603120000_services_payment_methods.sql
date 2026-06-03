-- Track which P2P methods a service accepts (venmo, cashapp, zelle)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT '{}';

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_payment_methods_check;
ALTER TABLE services ADD CONSTRAINT services_payment_methods_check
  CHECK (payment_methods <@ ARRAY['venmo', 'cashapp', 'zelle']::text[]);

-- Backfill from existing handle columns
UPDATE services
SET payment_methods = (
  SELECT COALESCE(array_agg(m ORDER BY m), '{}')
  FROM (
    SELECT 'venmo' AS m WHERE venmo_handle IS NOT NULL AND btrim(venmo_handle) <> ''
    UNION ALL
    SELECT 'cashapp' WHERE cashapp_tag IS NOT NULL AND btrim(cashapp_tag) <> ''
    UNION ALL
    SELECT 'zelle' WHERE zelle_contact IS NOT NULL AND btrim(zelle_contact) <> ''
  ) methods
)
WHERE cardinality(payment_methods) = 0;
