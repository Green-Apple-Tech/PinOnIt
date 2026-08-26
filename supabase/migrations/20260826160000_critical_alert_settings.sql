-- Flexible critical-alert schedule (SMS / WhatsApp / email / optional voice)
-- and per-booking dispatch log (replaces hard-coded 5m/1m voice-only flags).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS critical_alert_settings jsonb NOT NULL DEFAULT '{
    "sms_offsets": [-60, -15],
    "whatsapp_offsets": [-60, -15],
    "email_offsets": [-1440, -240],
    "voice_enabled": false,
    "voice_offsets": [-5, -1]
  }'::jsonb;

COMMENT ON COLUMN profiles.critical_alert_settings IS
  'Host critical meeting alert schedule: SMS/WhatsApp/email offsets (minutes before) and optional voice.';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS critical_alerts_sent jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN bookings.critical_alerts_sent IS
  'Dispatch keys already sent, e.g. ["sms:-60","email:-1440","voice:-5"].';
