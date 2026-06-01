import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SCOPES = ["meeting:write:meeting", "user:read:user"].join(" ");

async function signState(uid: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ uid });
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return btoa(JSON.stringify({ uid, sig: sigHex }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("ZOOM_CLIENT_ID");
    const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Zoom OAuth credentials are not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Accept token from Authorization header OR ?token= query param (for direct browser redirects)
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    const authHeader = queryToken
      ? `Bearer ${queryToken}`
      : (req.headers.get("Authorization") ?? "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const state = await signState(user.id, serviceKey);
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/zoom-callback`;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
    });

    const oauthUrl = `https://zoom.us/oauth/authorize?${params}`;

    // If called with ?token= (direct browser navigation), do a 302 redirect
    if (queryToken) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: oauthUrl },
      });
    }

    // Otherwise return JSON (called via fetch from app)
    return new Response(
      JSON.stringify({ url: oauthUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
