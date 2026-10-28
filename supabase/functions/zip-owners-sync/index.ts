import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { secretsMatch } from '../../../shared/leadAlert.ts';
import { ZIP_OWNERS_TOKEN_HEADER, decideZipOwnersSync } from '../../../shared/zipOwners.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': `Content-Type, Authorization, apikey, ${ZIP_OWNERS_TOKEN_HEADER}`,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const expected = Deno.env.get('ZIP_OWNERS_SYNC_TOKEN') ?? '';
  if (!expected) {
    console.error('zip-owners-sync missing ZIP_OWNERS_SYNC_TOKEN');
    return json({ error: 'not_configured' }, 503);
  }
  const provided = req.headers.get(ZIP_OWNERS_TOKEN_HEADER) ?? '';
  if (!provided || !secretsMatch(provided, expected)) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_body' }, 400);
  const record = body as Record<string, unknown>;
  if (typeof record.active !== 'boolean') return json({ error: 'invalid_body' }, 400);

  const gate = decideZipOwnersSync({
    email: record.email,
    subscriberId: record.subscriber_id,
    active: record.active,
    existingKind: null,
    paidSubscription: false,
    subscriberTaken: false,
  });
  if (!gate.ok && (gate.reason === 'invalid_email' || gate.reason === 'invalid_subscriber')) {
    return json({ error: gate.reason }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'not_configured' }, 503);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.rpc('sync_zip_owners_membership', {
    p_email: record.email,
    p_subscriber_id: record.subscriber_id,
    p_active: record.active,
  });
  if (error) {
    console.error('zip-owners-sync rpc failed', error.message);
    return json({ error: 'sync_failed' }, 500);
  }
  const result = data as { ok?: boolean; reason?: string } | null;
  if (result && result.ok === false) return json({ error: result.reason ?? 'rejected' }, 409);
  return json(result ?? { ok: true });
});
