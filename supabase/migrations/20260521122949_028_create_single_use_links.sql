/*
  # Create single_use_links table

  ## Summary
  Single-use booking links are one-time URLs tied to a specific event type.
  Once a guest books via a single-use link, it is marked as used and cannot be
  used again. Hosts can also create single-use QR codes backed by the same token.

  ## New Table: single_use_links
  - `id` (uuid, pk) — internal identifier
  - `host_id` (uuid, fk → profiles.id) — owner
  - `service_id` (uuid, fk → services.id) — which event type this link is for
  - `token` (text, unique) — the random token embedded in the URL
  - `label` (text, nullable) — optional human-readable note (e.g. "For John Smith")
  - `used` (boolean) — whether the link has been claimed
  - `used_at` (timestamptz, nullable) — when it was claimed
  - `booking_id` (uuid, nullable) — the resulting booking id, if any
  - `expires_at` (timestamptz, nullable) — optional expiry; null = no expiry
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Hosts can CRUD their own links
  - Anon users can SELECT a link by token (needed for the public booking flow to validate it)
  - Anon users can UPDATE `used`, `used_at`, `booking_id` on a link (to mark it used when booking)
*/

CREATE TABLE IF NOT EXISTS single_use_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'base64url'),
  label       text,
  used        boolean NOT NULL DEFAULT false,
  used_at     timestamptz,
  booking_id  uuid,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_single_use_links_token ON single_use_links (token);
CREATE INDEX IF NOT EXISTS idx_single_use_links_host_id ON single_use_links (host_id);
CREATE INDEX IF NOT EXISTS idx_single_use_links_service_id ON single_use_links (service_id);

ALTER TABLE single_use_links ENABLE ROW LEVEL SECURITY;

-- Hosts can view their own links
CREATE POLICY "Hosts can view own single use links"
  ON single_use_links FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id);

-- Hosts can create links for their own services
CREATE POLICY "Hosts can create single use links"
  ON single_use_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

-- Hosts can update (e.g. set label) their own links
CREATE POLICY "Hosts can update own single use links"
  ON single_use_links FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Hosts can delete their own links
CREATE POLICY "Hosts can delete own single use links"
  ON single_use_links FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- Anyone can look up a link by token (needed for public booking page validation)
CREATE POLICY "Anyone can read single use link by token"
  ON single_use_links FOR SELECT
  TO anon
  USING (true);

-- Anyone can mark a link as used (done atomically during booking)
CREATE POLICY "Anyone can mark single use link used"
  ON single_use_links FOR UPDATE
  TO anon
  USING (used = false)
  WITH CHECK (used = true);
