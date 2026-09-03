/** Validate Twilio's X-Twilio-Signature (HMAC-SHA1 of URL + sorted POST params). */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa[i] ^ bb[i];
  return out === 0;
}

export async function twilioSignatureMatches(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): Promise<boolean> {
  if (!authToken || !signature || !url) return false;
  const keys = Object.keys(params).sort();
  let data = url;
  for (const key of keys) data += key + (params[key] ?? "");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const raw = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(raw)));
  return timingSafeEqual(expected, signature);
}

export function candidateTwilioUrls(req: Request): string[] {
  const configured = (Deno.env.get("TWILIO_SMS_INBOUND_URL") || "").replace(/\/$/, "");
  const parsed = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || parsed.protocol.replace(":", "") || "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    parsed.host;
  const path = parsed.pathname;
  const withQuery = `${proto}://${host}${path}${parsed.search}`;
  const noQuery = `${proto}://${host}${path}`;
  const project = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const projectFn = project ? `${project}/functions/v1/sms-inbound` : "";
  return [...new Set([configured, noQuery, withQuery, parsed.href, projectFn].filter(Boolean))];
}

export async function assertTwilioSignature(
  req: Request,
  params: Record<string, string>,
): Promise<boolean> {
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const signature = req.headers.get("X-Twilio-Signature") || req.headers.get("x-twilio-signature") || "";
  if (!authToken || !signature) return false;
  for (const url of candidateTwilioUrls(req)) {
    if (await twilioSignatureMatches(authToken, signature, url, params)) return true;
  }
  return false;
}
