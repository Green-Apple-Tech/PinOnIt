/*
  # Create reminders and messaging schema

  1. New Tables
    - `message_templates`
      - `id` (uuid, PK)
      - `host_id` (uuid, references profiles)
      - `name` (text, not null) - e.g. "Confirmation", "24h Reminder", "Follow-up"
      - `type` (text) - confirmation, reminder, follow_up, custom
      - `channel` (text) - email, sms, both
      - `subject` (text, nullable) - email subject line
      - `body` (text, not null) - message body with template variables {{guest_name}}, {{host_name}}, {{service_name}}, {{date}}, {{time}}, {{timezone}}, {{booking_link}}
      - `timing_offset_minutes` (int, default 0) - minutes before/after appointment (negative = before, positive = after)
      - `is_active` (bool, default true)
      - `language` (text, default 'en') - original language code
      - `auto_translate` (bool, default false) - whether to AI-translate to guest's language
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `message_log`
      - `id` (uuid, PK)
      - `booking_id` (uuid, references bookings)
      - `host_id` (uuid, references profiles)
      - `template_id` (uuid, nullable, references message_templates)
      - `channel` (text) - email, sms
      - `status` (text, default 'pending') - pending, sent, delivered, failed
      - `recipient` (text, not null) - email or phone
      - `subject` (text, nullable)
      - `body` (text, not null)
      - `language` (text, default 'en') - language the message was sent in
      - `sent_at` (timestamptz, nullable)
      - `created_at` (timestamptz, default now())

    - `reminder_rules`
      - `id` (uuid, PK)
      - `host_id` (uuid, references profiles)
      - `service_id` (uuid, nullable, references services) - null = all services
      - `template_id` (uuid, references message_templates)
      - `timing_offset_minutes` (int, not null) - e.g. -1440 = 24h before, 0 = at booking time, 1440 = 24h after
      - `is_active` (bool, default true)
      - `created_at` (timestamptz, default now())

  2. Security
    - RLS enabled on all tables
    - Hosts manage own templates, rules, and view own message log
    - Service role can insert/update message_log for edge function sending

  3. Indexes
    - message_log.booking_id, message_log.host_id
    - reminder_rules.host_id, reminder_rules.service_id
*/

-- Message templates
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom' CHECK (type IN ('confirmation', 'reminder', 'follow_up', 'custom')),
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'both')),
  subject text,
  body text NOT NULL,
  timing_offset_minutes int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  language text NOT NULL DEFAULT 'en',
  auto_translate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Message log
CREATE TABLE IF NOT EXISTS message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Reminder rules (links templates to timing for services)
CREATE TABLE IF NOT EXISTS reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  timing_offset_minutes int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;

-- Message templates policies
CREATE POLICY "Hosts can manage own templates"
  ON message_templates FOR ALL TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Message log policies
CREATE POLICY "Hosts can read own message log"
  ON message_log FOR SELECT TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Service role can manage message log"
  ON message_log FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Reminder rules policies
CREATE POLICY "Hosts can manage own reminder rules"
  ON reminder_rules FOR ALL TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_log_booking_id ON message_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_message_log_host_id ON message_log(host_id);
CREATE INDEX IF NOT EXISTS idx_reminder_rules_host_id ON reminder_rules(host_id);
CREATE INDEX IF NOT EXISTS idx_reminder_rules_service_id ON reminder_rules(service_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_templates_updated_at ON message_templates;
CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create default templates for new hosts
CREATE OR REPLACE FUNCTION public.create_default_templates()
RETURNS trigger AS $$
BEGIN
  INSERT INTO message_templates (host_id, name, type, channel, subject, body, timing_offset_minutes, auto_translate)
  VALUES
    (NEW.id, 'Booking Confirmation', 'confirmation', 'email',
     'Your appointment is confirmed',
     'Hi {{guest_name}}, your {{service_name}} with {{host_name}} is confirmed for {{date}} at {{time}} ({{timezone}}). Reply CANCEL to cancel or RESCHEDULE to request a new time.',
     0, true),
    (NEW.id, '24 Hour Reminder', 'reminder', 'email',
     'Reminder: Your appointment tomorrow',
     'Hi {{guest_name}}, this is a reminder that your {{service_name}} with {{host_name}} is tomorrow at {{time}} ({{timezone}}). Reply CONFIRM to confirm or CANCEL to cancel.',
     -1440, true),
    (NEW.id, 'Follow-up', 'follow_up', 'email',
     'Thanks for your visit',
     'Hi {{guest_name}}, thanks for your {{service_name}} appointment with {{host_name}}. We hope everything went well! Reply to rebook anytime.',
     1440, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_templates();
