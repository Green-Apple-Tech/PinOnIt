-- Inbound SMS conversation state + message log (two-way cancel/reschedule).

CREATE TABLE IF NOT EXISTS public.sms_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  last_intent text,
  state text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_conversations_phone_idx
  ON public.sms_conversations (phone);
CREATE INDEX IF NOT EXISTS sms_conversations_booking_idx
  ON public.sms_conversations (booking_id);

ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages sms_conversations" ON public.sms_conversations;
CREATE POLICY "Service role manages sms_conversations"
  ON public.sms_conversations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text,
  twilio_sid text,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_booking_idx ON public.messages (booking_id);
CREATE INDEX IF NOT EXISTS messages_twilio_sid_idx ON public.messages (twilio_sid);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages (created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages messages" ON public.messages;
CREATE POLICY "Service role manages messages"
  ON public.messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.sms_conversations IS 'Latest inbound SMS intent per phone for cancel/reschedule.';
COMMENT ON TABLE public.messages IS 'Log of inbound and outbound SMS related to bookings.';

UPDATE public.message_templates
SET body = trim(both from body) || E'\nReply 1 to cancel or 2 to reschedule.'
WHERE channel = 'sms'
  AND body IS NOT NULL
  AND body !~* 'reply 1 to cancel';
