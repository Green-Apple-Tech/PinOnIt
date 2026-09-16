-- Default 1-hour reminder on every event type: email + SMS.
-- SMS is stored as a rule; send-reminder only texts if the guest opted in with a phone.

CREATE OR REPLACE FUNCTION public.insert_default_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.service_reminders
    (service_id, host_id, channel, timing_offset_minutes, label, is_active)
  SELECT NEW.id, NEW.host_id, 'email', -60, '60 min before', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.service_reminders r
    WHERE r.service_id = NEW.id AND r.channel = 'email' AND r.timing_offset_minutes = -60
  );

  INSERT INTO public.service_reminders
    (service_id, host_id, channel, timing_offset_minutes, label, is_active)
  SELECT NEW.id, NEW.host_id, 'sms', -60, '60 min before', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.service_reminders r
    WHERE r.service_id = NEW.id AND r.channel = 'sms' AND r.timing_offset_minutes = -60
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_reminder_on_service_insert ON public.services;
CREATE TRIGGER trg_default_reminder_on_service_insert
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.insert_default_reminder();

INSERT INTO public.service_reminders
  (service_id, host_id, channel, timing_offset_minutes, label, is_active)
SELECT s.id, s.host_id, 'email', -60, '60 min before', true
FROM public.services s
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_reminders r
  WHERE r.service_id = s.id AND r.channel = 'email' AND r.timing_offset_minutes = -60
);

INSERT INTO public.service_reminders
  (service_id, host_id, channel, timing_offset_minutes, label, is_active)
SELECT s.id, s.host_id, 'sms', -60, '60 min before', true
FROM public.services s
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_reminders r
  WHERE r.service_id = s.id AND r.channel = 'sms' AND r.timing_offset_minutes = -60
);
