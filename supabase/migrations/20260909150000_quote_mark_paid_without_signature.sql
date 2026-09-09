-- Hosts can mark a quote paid after they send it. Recipients do not have to
-- Sign-by-Text first (quotes default to view-only).
CREATE OR REPLACE FUNCTION public.mark_quote_paid(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.documents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  SELECT * INTO v_row
  FROM public.documents
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND OR v_row.sender_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not found');
  END IF;

  IF v_row.document_type IS DISTINCT FROM 'quote' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not a quote');
  END IF;

  IF v_row.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'paid', 'already', true);
  END IF;

  IF v_row.status = 'declined' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote declined');
  END IF;

  IF v_row.status NOT IN ('pending', 'viewed', 'signed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot mark paid');
  END IF;

  UPDATE public.documents
  SET status = 'paid', paid_at = now()
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true, 'status', 'paid');
END;
$$;

REVOKE ALL ON FUNCTION public.mark_quote_paid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_quote_paid(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
