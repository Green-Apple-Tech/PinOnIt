export function bearerToken(req: Request): string {
  return (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
}

/** True when the caller presented the service-role key (cron / internal). */
export function isServiceRoleRequest(req: Request): boolean {
  const token = bearerToken(req);
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const cron = req.headers.get('x-cron-secret') ?? '';
  const cronSecret = Deno.env.get('CRON_DISPATCH_SECRET') ?? '';
  if (token && service && token === service) return true;
  if (cronSecret && cron && cron === cronSecret) return true;
  return false;
}

export function jsonAuthError(corsHeaders: Record<string, string>, message = 'Unauthorized', status = 401): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
