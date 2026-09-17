import { SMS_OPT_OUT_FOOTER, SMS_REPLY_FOOTER } from './smsOptOut';

const CONFIRMATION_SMS_BODY =
  `Hi {{guest_name}}, your {{service_name}} with {{host_name}} is confirmed for {{date}} at {{time}}. {{location}} ${SMS_REPLY_FOOTER} ${SMS_OPT_OUT_FOOTER}`;

/** Turn on booking-confirmation SMS (template + send rule). Safe to call twice. */
export async function enableConfirmationSms(hostId: string): Promise<void> {
  const { supabase } = await import('./supabase');
  const { data: existing } = await supabase
    .from('message_templates')
    .select('id')
    .eq('host_id', hostId)
    .eq('type', 'confirmation')
    .eq('channel', 'sms')
    .limit(1);
  let templateId = existing?.[0]?.id as string | undefined;
  if (!templateId) {
    const { data: tpl } = await supabase
      .from('message_templates')
      .insert({
        host_id: hostId,
        name: 'Booking Confirmation — SMS',
        type: 'confirmation',
        channel: 'sms',
        subject: null,
        body: CONFIRMATION_SMS_BODY,
        timing_offset_minutes: 0,
        is_active: true,
        language: 'en',
        auto_translate: false,
      })
      .select('id')
      .maybeSingle();
    templateId = tpl?.id;
  }
  if (!templateId) return;
  const { count } = await supabase
    .from('reminder_rules')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId)
    .eq('template_id', templateId);
  if ((count ?? 0) > 0) return;
  await supabase.from('reminder_rules').insert({
    host_id: hostId,
    template_id: templateId,
    service_id: null,
    timing_offset_minutes: 0,
    is_active: true,
    is_critical: false,
  });
}

export const DEFAULT_GUEST_EMAIL_REMINDERS = [
  {
    name: '24 Hour Reminder — Email',
    type: 'reminder' as const,
    channel: 'email' as const,
    timing_offset_minutes: -1440,
    subject: 'Reminder: {{service_name}} tomorrow at {{time}}',
    body: 'Hi {{guest_name}},\n\nJust a reminder that your {{service_name}} with {{host_name}} is tomorrow at {{time}} ({{timezone}}).\n\n{{location}}\n\nSee you then!\n— {{host_name}}',
  },
  {
    name: '1 Hour Reminder — Email',
    type: 'reminder' as const,
    channel: 'email' as const,
    timing_offset_minutes: -60,
    subject: 'Reminder: {{service_name}} starts in 1 hour',
    body: 'Hi {{guest_name}},\n\nYour {{service_name}} with {{host_name}} starts in 1 hour.\n\n{{location}}\n\n— {{host_name}}',
  },
];

type GuestReminderTemplate = {
  id?: string;
  type: string;
  channel: string;
  timing_offset_minutes: number;
};

/** Slots we still need to create — skip any the host already has, even if they turned them off. */
export function missingDefaultGuestEmailSlots(existing: GuestReminderTemplate[]) {
  return DEFAULT_GUEST_EMAIL_REMINDERS.filter(
    (def) =>
      !existing.some(
        (t) =>
          t.type === def.type &&
          t.channel === def.channel &&
          t.timing_offset_minutes === def.timing_offset_minutes,
      ),
  );
}

/** Turn on 24-hour and 1-hour guest emails if this host has never had them. Safe to call twice. */
export async function ensureDefaultGuestEmailReminders(
  hostId: string,
  existingTemplates: GuestReminderTemplate[],
): Promise<{
  templates: Record<string, unknown>[];
  rules: { id: string; template_id: string; timing_offset_minutes: number; is_active: boolean; is_critical: boolean }[];
}> {
  const { supabase } = await import('./supabase');
  const missing = missingDefaultGuestEmailSlots(existingTemplates);
  const templates: Record<string, unknown>[] = [];
  const rules: { id: string; template_id: string; timing_offset_minutes: number; is_active: boolean; is_critical: boolean }[] = [];
  for (const def of missing) {
    const { data: tpl } = await supabase
      .from('message_templates')
      .insert({
        host_id: hostId,
        name: def.name,
        type: def.type,
        channel: def.channel,
        subject: def.subject,
        body: def.body,
        timing_offset_minutes: def.timing_offset_minutes,
        is_active: true,
        language: 'en',
        auto_translate: false,
      })
      .select()
      .maybeSingle();
    if (!tpl) continue;
    templates.push(tpl);
    const { data: rule } = await supabase
      .from('reminder_rules')
      .insert({
        host_id: hostId,
        template_id: tpl.id,
        service_id: null,
        timing_offset_minutes: def.timing_offset_minutes,
        is_active: true,
        is_critical: false,
      })
      .select('id, template_id, timing_offset_minutes, is_active, is_critical')
      .maybeSingle();
    if (rule) rules.push(rule);
  }
  return { templates, rules };
}

/** Templates from signup often have no send rule — attach one so they actually fire. */
export async function backfillMissingReminderRules(
  hostId: string,
  templates: { id: string; timing_offset_minutes: number }[],
  existingRuleTemplateIds: Set<string>,
): Promise<{ id: string; template_id: string; timing_offset_minutes: number; is_active: boolean; is_critical: boolean }[]> {
  const { supabase } = await import('./supabase');
  const created: { id: string; template_id: string; timing_offset_minutes: number; is_active: boolean; is_critical: boolean }[] = [];
  for (const tpl of templates) {
    if (existingRuleTemplateIds.has(tpl.id)) continue;
    const { data } = await supabase
      .from('reminder_rules')
      .insert({
        host_id: hostId,
        template_id: tpl.id,
        service_id: null,
        timing_offset_minutes: tpl.timing_offset_minutes,
        is_active: true,
        is_critical: false,
      })
      .select('id, template_id, timing_offset_minutes, is_active, is_critical')
      .maybeSingle();
    if (data) created.push(data);
  }
  return created;
}
