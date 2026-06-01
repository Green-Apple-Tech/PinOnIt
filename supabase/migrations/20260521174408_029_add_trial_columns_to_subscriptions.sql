/*
  # Add trial support columns to subscriptions

  1. Changes
    - `subscriptions.trial_ends_at` — timestamp when a manually-activated trial expires
    - `subscriptions.trial_source` — which flow granted the trial (e.g. 'calendly_migration')

  2. Notes
    - Both columns are nullable; absence means no active manual trial
    - No RLS changes — existing policies cover these new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_ends_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'trial_source'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_source text DEFAULT NULL;
  END IF;
END $$;
