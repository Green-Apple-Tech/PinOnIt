-- Host quotes / invoices / cash receipts. Not payable in PinOnIt — view + optional pay-elsewhere link.

CREATE TABLE IF NOT EXISTS public.host_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('quote', 'invoice', 'receipt')),
  client_name text,
  client_email text,
  client_phone text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  pay_elsewhere_url text,
  pay_elsewhere_label text,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  sent_via text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS host_quotes_host_id_idx ON public.host_quotes (host_id);
CREATE INDEX IF NOT EXISTS host_quotes_created_at_idx ON public.host_quotes (created_at DESC);

ALTER TABLE public.host_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage own quotes"
  ON public.host_quotes
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE OR REPLACE FUNCTION public.get_host_quote(p_token text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'kind', q.kind,
    'client_name', q.client_name,
    'line_items', q.line_items,
    'notes', q.notes,
    'pay_elsewhere_url', q.pay_elsewhere_url,
    'pay_elsewhere_label', q.pay_elsewhere_label,
    'currency', q.currency,
    'created_at', q.created_at,
    'host_name', COALESCE(NULLIF(p.full_name, ''), p.email)
  )
  FROM public.host_quotes q
  JOIN public.profiles p ON p.id = q.host_id
  WHERE q.token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_host_quote(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_host_quote(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
