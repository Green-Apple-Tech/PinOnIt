import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CALENDLY_AUTH_URL,
  CALENDLY_IMPORT_SCOPES,
  calendlyRedirectUri,
  generateCodeChallenge,
  generateCodeVerifier,
} from "../_shared/calendly-oauth.ts";
import { encodeOAuthState } from "../_shared/oauth-state.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("CALENDLY_CLIENT_ID");
    const clientSecret = Deno.env.get("CALENDLY_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Calendly OAuth credentials are not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const redirectUri = calendlyRedirectUri(Deno.env.get("SUPABASE_URL")!);

    // Allow callers to pass a source (e.g. "wizard") so the callback can
    // redirect back to the right place after OAuth completes.
    let bodySource = "calendly_import";
    if (req.method === "POST") {
      try {
        const body = await req.json() as { source?: string };
        if (body.source) bodySource = body.source;
      } catch { /* no body or non-JSON — use default */ }
    }

    const state = encodeOAuthState(user.id, bodySource, codeVerifier);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: CALENDLY_IMPORT_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const oauthUrl = `${CALENDLY_AUTH_URL}?${params}`;

    // Legacy frontend: direct browser navigation with ?token= (no Authorization header).
    if (queryToken) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: oauthUrl },
      });
    }

    // Current frontend: supabase.functions.invoke with Authorization header.
    return new Response(JSON.stringify({ url: oauthUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
