/*
  # Add missing columns to contacts table

  ## Summary
  The Gmail contacts import fails because the contacts table is missing several
  columns that the edge function tries to insert. This migration adds them safely.

  ## Changes
  - `contacts` table gains four new optional columns:
    - `company` (text) — organization name imported from Google contacts
    - `phone` (text) — phone number from Google contacts or manual entry
    - `source` (text, default 'manual') — origin of the contact record (manual, booking, gmail)
    - `avatar_url` (text) — profile photo URL for future use

  ## Notes
  All additions use IF NOT EXISTS to be safe against re-runs.
*/

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avatar_url text;
