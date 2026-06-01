/*
  # Fix overly permissive anon booking SELECT policy

  The previous policy allowed ANY anonymous user to SELECT any booking row
  because action_token IS NOT NULL is always true (every booking has a token).
  
  Fix: Drop that policy entirely. Guests never need to SELECT bookings directly —
  the confirmed page is built from the INSERT return value. The booking-reply
  edge function uses service_role and bypasses RLS, so it is unaffected.
  BookingAction page also uses the edge function, not a direct SELECT.
*/

DROP POLICY IF EXISTS "Anon can read booking with valid action token" ON bookings;
