/*
  # Add Voice Call as a Reminder Channel

  1. Changes
    - Extends the `channel` enum/check in `message_templates` and `message_log` tables to include 'voice'
    - Adds `voice_reminder_enabled` boolean to `profiles` for global voice toggle
    - Adds `voice_message_template` text to `profiles` to store customized voice script
    - No destructive operations — purely additive

  2. Tables modified
    - `profiles`: new columns `voice_reminder_enabled`, `voice_message_template`
    - `message_templates`: channel constraint updated to allow 'voice'
    - `message_log`: channel constraint updated to allow 'voice'

  3. Notes
    - The check constraints on channel columns are dropped and recreated
      to include 'voice' alongside existing values
*/

-- Add voice reminder settings to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'voice_reminder_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN voice_reminder_enabled boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'voice_message_template'
  ) THEN
    ALTER TABLE profiles ADD COLUMN voice_message_template text DEFAULT NULL;
  END IF;
END $$;

-- Update message_templates channel constraint to include 'voice'
DO $$
BEGIN
  -- Drop existing channel check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'message_templates' AND column_name = 'channel'
      AND constraint_name IN (
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'message_templates' AND constraint_type = 'CHECK'
      )
  ) THEN
    -- Find and drop the constraint by searching pg_constraint
    DECLARE
      v_constraint text;
    BEGIN
      SELECT conname INTO v_constraint
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'message_templates'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%channel%';
      IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE message_templates DROP CONSTRAINT %I', v_constraint);
      END IF;
    END;
  END IF;
END $$;

-- Simpler approach: directly attempt to drop known constraint names and add new one
DO $$
BEGIN
  -- Try to drop common constraint names for message_templates.channel
  BEGIN
    ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_channel_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp', 'both', 'voice'));

-- Update message_log channel constraint to include 'voice'
DO $$
BEGIN
  BEGIN
    ALTER TABLE message_log DROP CONSTRAINT IF EXISTS message_log_channel_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

ALTER TABLE message_log
  ADD CONSTRAINT message_log_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp', 'voice'));
