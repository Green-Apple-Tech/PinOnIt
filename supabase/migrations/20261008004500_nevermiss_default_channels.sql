/*
  NeverMiss defaults for new hosts. Event-type reminders are unchanged.

  Exact time: email, SMS, voice.
  One hour before: email and WhatsApp.
*/

CREATE OR REPLACE FUNCTION public.create_default_templates()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  tpl_id uuid;
BEGIN
  INSERT INTO public.message_templates (host_id, name, type, channel, subject, body, timing_offset_minutes, auto_translate)
  VALUES (
    NEW.id, 'Exact reminder Time — Email', 'confirmation', 'email',
    'Your {{service_name}} is confirmed',
    E'Hi {{guest_name}},\n\nYour {{service_name}} with {{host_name}} is confirmed.\n\nDate: {{date}} at {{time}} ({{timezone}})\nDuration: {{duration}}\n\n{{location}}\n\nNeed to change this? {{reschedule_link}}\n\n— {{host_name}}',
    0, true
  )
  RETURNING id INTO tpl_id;
  INSERT INTO public.reminder_rules (host_id, service_id, template_id, timing_offset_minutes, is_active, is_critical)
  VALUES (NEW.id, NULL, tpl_id, 0, true, false);

  INSERT INTO public.message_templates (host_id, name, type, channel, subject, body, timing_offset_minutes, auto_translate)
  VALUES (
    NEW.id, 'Exact reminder Time — SMS', 'confirmation', 'sms',
    NULL,
    'Hi {{guest_name}}, your {{service_name}} with {{host_name}} is confirmed for {{date}} at {{time}}. {{location}} Reply 1 to cancel or 2 to reschedule. Reply STOP to opt out.',
    0, true
  )
  RETURNING id INTO tpl_id;
  INSERT INTO public.reminder_rules (host_id, service_id, template_id, timing_offset_minutes, is_active, is_critical)
  VALUES (NEW.id, NULL, tpl_id, 0, true, false);

  INSERT INTO public.message_templates (host_id, name, type, channel, subject, body, timing_offset_minutes, auto_translate)
  VALUES (
    NEW.id, 'Exact reminder Time — Voice', 'confirmation', 'voice',
    NULL,
    'Hi, this is a reminder from {{host_name}} that you have a {{service_name}} scheduled for {{date}} at {{time}}. We look forward to speaking with you.',
    0, true
  )
  RETURNING id INTO tpl_id;
  INSERT INTO public.reminder_rules (host_id, service_id, template_id, timing_offset_minutes, is_active, is_critical)
  VALUES (NEW.id, NULL, tpl_id, 0, true, false);

  INSERT INTO public.message_templates (host_id, name, type, channel, subject, body, timing_offset_minutes, auto_translate)
  VALUES (
    NEW.id, '1 Hour Reminder — Email', 'reminder', 'email',
    'Reminder: {{service_name}} starts in 1 hour',
    E'Hi {{guest_name}},\n\nYour {{service_name}} with {{host_name}} starts in 1 hour.\n\n{{location}}\n\n— {{host_name}}',
    -60, true
  )
  RETURNING id INTO tpl_id;
  INSERT INTO public.reminder_rules (host_id, service_id, template_id, timing_offset_minutes, is_active, is_critical)
  VALUES (NEW.id, NULL, tpl_id, -60, true, false);

  INSERT INTO public.message_templates (host_id, name, type, channel, subject, body, timing_offset_minutes, auto_translate)
  VALUES (
    NEW.id, '1 Hour Reminder — WhatsApp', 'reminder', 'whatsapp',
    NULL,
    'Hi {{guest_name}}! Your {{service_name}} with {{host_name}} starts in 1 hour. {{location}} Reply STOP to opt out.',
    -60, true
  )
  RETURNING id INTO tpl_id;
  INSERT INTO public.reminder_rules (host_id, service_id, template_id, timing_offset_minutes, is_active, is_critical)
  VALUES (NEW.id, NULL, tpl_id, -60, true, false);

  INSERT INTO public.message_templates (host_id, name, type, channel, subject, body, timing_offset_minutes, auto_translate)
  VALUES (
    NEW.id, 'Follow-up', 'follow_up', 'email',
    'Thanks for your visit',
    'Hi {{guest_name}}, thanks for your {{service_name}} appointment with {{host_name}}. We hope everything went well! Reply to rebook anytime.',
    1440, true
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_default_templates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_templates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_templates() FROM authenticated;
