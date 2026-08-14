-- Extra reminders can attach to a PinOnIt booking OR a synced calendar event.
-- sent_at prevents duplicate sends from the dispatcher.

ALTER TABLE public.event_reminder_overrides
  ALTER COLUMN booking_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_reminder_overrides' AND column_name = 'calendar_event_id'
  ) THEN
    ALTER TABLE public.event_reminder_overrides
      ADD COLUMN calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_reminder_overrides' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE public.event_reminder_overrides
      ADD COLUMN sent_at timestamptz;
  END IF;
END $$;

ALTER TABLE public.event_reminder_overrides
  DROP CONSTRAINT IF EXISTS event_reminder_overrides_target_chk;

ALTER TABLE public.event_reminder_overrides
  ADD CONSTRAINT event_reminder_overrides_target_chk
  CHECK (
    (booking_id IS NOT NULL AND calendar_event_id IS NULL)
    OR (booking_id IS NULL AND calendar_event_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS event_reminder_overrides_calendar_event_id_idx
  ON public.event_reminder_overrides(calendar_event_id);

CREATE INDEX IF NOT EXISTS event_reminder_overrides_unsent_idx
  ON public.event_reminder_overrides(host_id)
  WHERE sent_at IS NULL;
