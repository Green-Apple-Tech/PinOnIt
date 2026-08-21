-- Tax percent on host quotes (0 = no tax). Public RPC updated so clients see it.

ALTER TABLE public.host_quotes
  ADD COLUMN IF NOT EXISTS tax_percent numeric NOT NULL DEFAULT 0;

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
    'tax_percent', q.tax_percent,
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
