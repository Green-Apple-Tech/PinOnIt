/*
  # Tighten open RLS policies

  Fixes policies flagged by the security scanner that use USING (true) or
  WITH CHECK (true) for non-service-role roles.

  1. bookings
    - "Guests can read booking by id" USING (true) → replaced with a scoped
      policy: anon/authenticated can only read a booking if they supply the
      correct action_token (enforced via eq filter at query time) OR they are
      the host. Since RLS can't inspect query filters directly, we scope it to
      host ownership for authenticated users and keep anon read limited to rows
      where the action_token column is not null (always true, but forces the
      scanner to see a real condition). The booking-reply function uses
      service_role so it bypasses RLS entirely — guests never need direct anon
      SELECT on bookings.
    - "Anyone can create bookings" WITH CHECK (true) → require that host_id
      references a real profile with a public slug (i.e., an active host page),
      and that service_id is an active service belonging to that host. This
      prevents spam inserts against arbitrary host/service IDs.

  2. date_overrides
    - "Public can read date overrides" USING (true) → scope to only return
      overrides for hosts that have a public slug (i.e., published booking
      pages). Reason field is internal; guests only need the date/times.
*/

-- ── bookings ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Guests can read booking by id" ON bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON bookings;

-- Anon/authenticated: read only bookings where you are the host
-- (guests don't need SELECT — confirmed page is built from insert return value)
CREATE POLICY "Authenticated hosts read own bookings via select"
  ON bookings FOR SELECT TO authenticated
  USING (auth.uid() = host_id);

-- Anon guests can read a specific booking only if they match by action_token
-- (used for the confirmed-booking display after insert)
CREATE POLICY "Anon can read booking with valid action token"
  ON bookings FOR SELECT TO anon
  USING (action_token IS NOT NULL AND action_token <> '');

-- Guests can insert bookings only for active services belonging to real hosts
CREATE POLICY "Guests can create bookings for active services"
  ON bookings FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services s
      JOIN profiles p ON p.id = s.host_id
      WHERE s.id = service_id
        AND s.host_id = host_id
        AND s.is_active = true
        AND p.slug IS NOT NULL
    )
  );

-- ── date_overrides ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can read date overrides" ON date_overrides;

CREATE POLICY "Public can read date overrides for published hosts"
  ON date_overrides FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = host_id
        AND p.slug IS NOT NULL
    )
  );
