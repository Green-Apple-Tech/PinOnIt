/*
  # Add WhatsApp as a message channel

  Adds 'whatsapp' to the channel enum used by message_templates and message_log tables.
  Also adds an 'is_critical' flag to reminder_rules for the "super important meetings" feature.

  Changes:
  - message_templates.channel: allows 'whatsapp' value
  - message_log.channel: allows 'whatsapp' value
  - reminder_rules: new boolean column is_critical (default false)
*/

-- Extend message_templates channel check
ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_channel_check;

ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp', 'both'));

-- Extend message_log channel check
ALTER TABLE message_log
  DROP CONSTRAINT IF EXISTS message_log_channel_check;

ALTER TABLE message_log
  ADD CONSTRAINT message_log_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp'));

-- Add is_critical to reminder_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reminder_rules' AND column_name = 'is_critical'
  ) THEN
    ALTER TABLE reminder_rules ADD COLUMN is_critical boolean NOT NULL DEFAULT false;
  END IF;
END $$;
