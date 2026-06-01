import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

async function verifyState(state: string, secret: string): Promise<string> {
  const decoded = JSON.parse(atob(state)) as { uid?: string; sig?: string };
  if (!decoded.uid || !decoded.sig || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.uid)) {
    throw new Error("invalid state");
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const sigBytes = new Uint8Array(decoded.sig.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(JSON.stringify({ uid: decoded.uid })));
  if (!valid) throw new Error("invalid state signature");
  return decoded.uid;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ZoomTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  reason?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

  const supabase = createClient(supabaseUrl, serviceKey);
  const APP_URL = "https://pinonit.com";
  const redirectBase = `${APP_URL}/dashboard/appointments`;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(errorParam)}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${redirectBase}?calendar_error=missing_params`, 302);
    }

    if (!clientId || !clientSecret) {
      return Response.redirect(`${redirectBase}?calendar_error=oauth_not_configured`, 302);
    }

    let uid: string;
    try {
      uid = await verifyState(state, serviceKey);
    } catch {
      return Response.redirect(`${redirectBase}?calendar_error=invalid_state`, 302);
    }

    const redirectUri = `${supabaseUrl}/functions/v1/zoom-callback`;
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const tokenRes = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenBody = await tokenRes.text();
    console.log("[zoom-callback] Token exchange status:", tokenRes.status);

    let tokens: ZoomTokenResponse;
    try {
      tokens = JSON.parse(tokenBody) as ZoomTokenResponse;
    } catch {
      return Response.redirect(`${redirectBase}?calendar_error=token_parse_failed`, 302);
    }

    if (tokens.error || !tokens.access_token) {
      const msg = tokens.reason ?? tokens.error ?? "token_exchange_failed";
      return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(msg)}`, 302);
    }

    // Fetch Zoom user info
    const profileRes = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    let email = "";
    try {
      const profile = await profileRes.json() as { email?: string };
      email = profile.email ?? "";
    } catch { /* ignore */ }

    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    const { data: existing } = await supabase
      .from("connected_calendars")
      .select("id")
      .eq("host_id", uid)
      .eq("provider", "zoom")
      .maybeSingle();

    if (existing) {
      const updatePayload: Record<string, string | boolean> = {
        provider_account_email: email,
        access_token: tokens.access_token,
        token_expires_at: tokenExpiresAt,
        sync_enabled: true,
        calendar_name: "Zoom",
      };
      if (tokens.refresh_token) updatePayload.refresh_token = tokens.refresh_token;

      const { error: updateErr } = await supabase
        .from("connected_calendars")
        .update(updatePayload)
        .eq("id", existing.id);

      if (updateErr) {
        return Response.redirect(`${redirectBase}?calendar_error=db_update_failed`, 302);
      }
    } else {
      const { error: insertErr } = await supabase
        .from("connected_calendars")
        .insert({
          host_id: uid,
          provider: "zoom",
          provider_account_email: email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? "",
          token_expires_at: tokenExpiresAt,
          sync_enabled: true,
          calendar_name: "Zoom",
        });

      if (insertErr) {
        console.error("[zoom-callback] Insert error:", JSON.stringify(insertErr));
        return Response.redirect(`${redirectBase}?calendar_error=db_insert_failed`, 302);
      }
    }

    return Response.redirect(`${redirectBase}?calendar_connected=zoom`, 302);
  } catch (err) {
    const msg = (err as Error).message ?? "unknown_error";
    return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(msg)}`, 302);
  }
});
