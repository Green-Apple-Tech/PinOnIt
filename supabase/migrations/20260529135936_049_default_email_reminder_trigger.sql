/*
  # Default Email Reminder on New Event Types

  ## Summary
  Ensures every event type always has at least one reminder so the
  Reminders tab never shows "No reminders yet."

  ## Changes

  ### 1. New Function: `insert_default_reminder()`
  - SECURITY DEFINER trigger function
  - Inserts a single "60 minutes before — Email" reminder for the newly
    created service, but ONLY if that service has zero existing reminders.
  - Prevents duplicates with a COUNT guard.

  ### 2. New Trigger: `trg_default_reminder_on_service_insert`
  - Fires AFTER INSERT on `services`
  - Calls `insert_default_reminder()` once per new row

  ### 3. Backfill: Existing event types with zero reminders
  - One-time INSERT that creates the default reminder for every
    existing service that currently has no entries in service_reminders.

  ## Security
  - Trigger function uses SECURITY DEFINER + explicit search_path
  - No RLS changes needed; service_reminders already has RLS enabled
    and the trigger runs as the table owner (bypasses RLS).
*/

-- ── 1. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.insert_default_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if this service currently has no reminders
  IF (SELECT COUNT(*) FROM public.service_reminders WHERE service_id = NEW.id) = 0 THEN
    INSERT INTO public.service_reminders
      (service_id, host_id, channel, timing_offset_minutes, label, is_active)
    VALUES
      (NEW.id, NEW.host_id, 'email', -60, '60 min before', true);
  END IF;
  RETURN NEW;
END;
$$;

-- Revoke execute from public (SECURITY DEFINER function)
REVOKE ALL ON FUNCTION public.insert_default_reminder() FROM PUBLIC;

-- ── 2. Trigger on services table ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_default_reminder_on_service_insert ON public.services;

CREATE TRIGGER trg_default_reminder_on_service_insert
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.insert_default_reminder();

-- ── 3. Backfill existing services that have zero reminders ───────────────────

INSERT INTO public.service_reminders
  (service_id, host_id, channel, timing_offset_minutes, label, is_active)
SELECT
  s.id,
  s.host_id,
  'email',
  -60,
  '60 min before',
  true
FROM public.services s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.service_reminders r
  WHERE r.service_id = s.id
);
