import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeOAuthState } from "../_shared/oauth-state.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STAFF = new Set(["support@pinonit.com", "stebbins.peter@gmail.com"]);
const SCOPES = "identity read history";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const clientId = Deno.env.get("REDDIT_CLIENT_ID") ?? "";
  if (!clientId) {
    return new Response(JSON.stringify({ error: "REDDIT_CLIENT_ID is not set. Create an approved Reddit app first." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!user || !STAFF.has(email)) {
    return new Response(JSON.stringify({ error: "Staff only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/reddit-oauth-callback`;
  const state = encodeOAuthState(user.id, "reddit");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    state,
    redirect_uri: redirectUri,
    duration: "permanent",
    scope: SCOPES,
  });

  return new Response(JSON.stringify({ url: `https://www.reddit.com/api/v1/authorize?${params}` }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
