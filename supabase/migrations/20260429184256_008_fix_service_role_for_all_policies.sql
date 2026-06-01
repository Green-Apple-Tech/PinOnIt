/*
  # Replace FOR ALL service-role policies with role-scoped variants

  The security scanner flags any policy using USING (true) or WITH CHECK (true),
  even when the policy is logically intended for the service role only. Bolt's
  scanner does not distinguish intent — it just sees the open predicate.

  Fix: Replace each open FOR ALL policy with four separate operation policies
  (SELECT, INSERT, UPDATE, DELETE) that restrict access to service_role by
  checking that the requesting role is 'service_role' via current_setting.
  Because Supabase edge functions use the service_role key, and RLS is bypassed
  for the service_role role by default in Postgres, the cleanest fix is simply
  to DROP the open policies and rely on Postgres's built-in service_role bypass
  (service_role always bypasses RLS — no explicit policy needed).

  Tables affected:
    - profiles            "Service role can manage profiles"
    - message_log         "Service role can manage message log"
    - booking_answers     "Service role manages booking answers"
    - subscriptions       "Service role can manage subscriptions"
*/

-- profiles
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;

-- message_log
DROP POLICY IF EXISTS "Service role can manage message log" ON message_log;

-- booking_answers
DROP POLICY IF EXISTS "Service role manages booking answers" ON booking_answers;

-- subscriptions
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;

-- Hosts can also insert into message_log (edge functions use service_role,
-- but add an authenticated insert policy so the table isn't write-locked for hosts)
CREATE POLICY "Hosts can insert own message log"
  ON message_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);
