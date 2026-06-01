/*
  # Fix always-true RLS INSERT policies on poll tables

  ## Problem
  The INSERT policies on meeting_poll_responses and meeting_poll_votes used
  WITH CHECK (true), which effectively bypassed RLS entirely for inserts.

  ## Changes

  ### meeting_poll_responses
  - Drop the two always-true INSERT policies (anon + authenticated).
  - Replace with a single policy for both roles that verifies:
    - The referenced poll exists
    - The poll status is 'open' (not expired or confirmed)

  ### meeting_poll_votes
  - Drop the two always-true INSERT policies (anon + authenticated).
  - Replace with a single policy for both roles that verifies:
    - The referenced response_id exists in meeting_poll_responses
    - The slot_id belongs to the same poll as the response
    - The poll is still 'open'

  This keeps the feature fully functional for guests (anon) while preventing
  inserts against non-existent or closed polls and preventing vote-stuffing
  on arbitrary slot IDs.
*/

-- ── meeting_poll_responses ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can insert poll response" ON meeting_poll_responses;
DROP POLICY IF EXISTS "Authenticated can insert poll response" ON meeting_poll_responses;

CREATE POLICY "Anyone can insert response for open poll"
  ON meeting_poll_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meeting_polls
      WHERE meeting_polls.id = poll_id
        AND meeting_polls.status = 'open'
    )
  );

-- ── meeting_poll_votes ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can insert vote" ON meeting_poll_votes;
DROP POLICY IF EXISTS "Authenticated can insert vote" ON meeting_poll_votes;

CREATE POLICY "Anyone can insert vote for valid response and slot"
  ON meeting_poll_votes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM meeting_poll_responses r
      JOIN meeting_polls p ON p.id = r.poll_id
      JOIN meeting_poll_slots s ON s.poll_id = p.id AND s.id = slot_id
      WHERE r.id = response_id
        AND p.status = 'open'
    )
  );
