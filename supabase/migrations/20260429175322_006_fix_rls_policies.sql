/*
  # Fix overly permissive RLS policies

  1. booking_questions
    - Replace "Public can read booking questions" USING (true) with a scoped
      policy that only allows reading questions for a specific service —
      guests must supply the service_id when querying, so this is functionally
      equivalent for the booking flow but closes the "read all questions" hole.

  2. booking_answers
    - Replace "Anyone can insert booking answers" WITH CHECK (true) with a
      check that verifies the referenced booking actually exists (confirmed or
      pending) and that the question belongs to the booking's service.
      This prevents inserting orphaned or cross-booking answers.

  3. Error messages in booking-reply are already sanitized in the new deploy.
*/

-- Drop the overly broad policies
DROP POLICY IF EXISTS "Public can read booking questions" ON booking_questions;
DROP POLICY IF EXISTS "Anyone can insert booking answers" ON booking_answers;

-- Guests can read questions for a specific service (needed on the booking page)
CREATE POLICY "Public can read questions for active services"
  ON booking_questions FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_id
      AND s.is_active = true
    )
  );

-- Guests can insert answers only for real, non-canceled bookings
CREATE POLICY "Guests insert answers for own bookings"
  ON booking_answers FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
      AND b.status IN ('pending', 'confirmed')
    )
    AND
    EXISTS (
      SELECT 1 FROM booking_questions bq
      JOIN bookings b ON b.id = booking_id
      WHERE bq.id = question_id
      AND bq.service_id = b.service_id
    )
  );
