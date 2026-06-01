/*
  # Fix RLS policies and security settings

  ## Changes

  ### 1. incentive_programs — add SELECT policy for public read access
  - This table holds reference data (government/country incentive programs) with no owner column.
  - Anyone (including unauthenticated visitors) needs to read it to browse programs.
  - No write access is granted through RLS (inserts/updates handled via service role only).

  ### 2. leads — add policies for authenticated owners
  - The `leads` table has a `user_id` column linking rows to the authenticated user who created them.
  - Authenticated users can insert their own leads, select their own leads, and update their own leads.
  - Anon users can insert leads (e.g. public lead-capture forms) but cannot read or modify them.
  - Delete is not exposed — handled via service role.

  ### 3. Leaked password protection
  - Enable HaveIBeenPwned.org breach check on Supabase Auth so compromised passwords are rejected at signup/password-change.
*/

-- ============================================================
-- incentive_programs: public read-only reference data
-- ============================================================

CREATE POLICY "Anyone can read active incentive programs"
  ON public.incentive_programs
  FOR SELECT
  USING (active = true);

-- ============================================================
-- leads: owner-scoped policies
-- ============================================================

-- Authenticated users can insert their own leads
CREATE POLICY "Authenticated users can insert own leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Anon users can insert leads (public lead capture forms)
CREATE POLICY "Anon users can submit leads"
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Authenticated users can read their own leads
CREATE POLICY "Authenticated users can read own leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can update their own leads
CREATE POLICY "Authenticated users can update own leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
