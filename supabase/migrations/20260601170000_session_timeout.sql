-- Configurable inactivity sign-out (null = never)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS session_timeout_minutes integer DEFAULT NULL;
