-- P2P payment handles for event types (stored in `services` table)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS venmo_handle text,
  ADD COLUMN IF NOT EXISTS cashapp_handle text,
  ADD COLUMN IF NOT EXISTS zelle_handle text;

-- Migrate legacy column names if present
UPDATE services
SET cashapp_handle = cashapp_tag
WHERE cashapp_handle IS NULL AND cashapp_tag IS NOT NULL AND btrim(cashapp_tag) <> '';

UPDATE services
SET zelle_handle = zelle_contact
WHERE zelle_handle IS NULL AND zelle_contact IS NOT NULL AND btrim(zelle_contact) <> '';
