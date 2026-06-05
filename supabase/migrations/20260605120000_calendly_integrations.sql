-- Calendly OAuth integration storage + event type external refs

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('calendly')),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  provider_user_uri text,
  provider_account_email text,
  provider_account_name text,
  provider_slug text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_host_provider ON integrations(host_id, provider);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Tokens are edge-function only (service role). No client policies.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS calendly_connected boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'calendly_slug'
  ) THEN
    ALTER TABLE services ADD COLUMN calendly_slug text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'calendly_event_type_uri'
  ) THEN
    ALTER TABLE services ADD COLUMN calendly_event_type_uri text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_services_host_calendly_uri
  ON services(host_id, calendly_event_type_uri)
  WHERE calendly_event_type_uri IS NOT NULL;
