import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { OAUTH_APP_URL, parseOAuthContext } from "../_shared/oauth-state.ts";

const STAFF = new Set(["support@pinonit.com", "stebbins.peter@gmail.com"]);

function userAgent(): string {
  return "web:pinonit-opportunity-finder:1.0 (contact support@pinonit.com)";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const destination = `${OAUTH_APP_URL}/dashboard/reddit-opportunities`;
  const fail = (reason: string) => Response.redirect(`${destination}?reddit=error&reason=${encodeURIComponent(reason)}`, 302);

  const code = url.searchParams.get("code");
  const ctx = parseOAuthContext(url.searchParams.get("state"));
  if (!code || !ctx.userId) return fail("missing_code");

  const clientId = Deno.env.get("REDDIT_CLIENT_ID") ?? "";
  const secret = Deno.env.get("REDDIT_CLIENT_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!clientId || !secret || !supabaseUrl || !serviceKey) return fail("not_configured");

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData } = await admin.auth.admin.getUserById(ctx.userId);
  const email = userData.user?.email?.toLowerCase() ?? "";
  if (!STAFF.has(email)) return fail("staff_only");

  const redirectUri = `${supabaseUrl}/functions/v1/reddit-oauth-callback`;
  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || typeof token.refresh_token !== "string") return fail("reddit_declined");

  const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
    headers: { Authorization: `Bearer ${token.access_token}`, "User-Agent": userAgent() },
  });
  const me = await meRes.json().catch(() => ({}));

  await admin.from("reddit_oauth_tokens").upsert({
    id: 1,
    reddit_username: typeof me.name === "string" ? me.name : null,
    access_token: token.access_token ?? null,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString(),
    connected_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });

  return Response.redirect(`${destination}?reddit=connected`, 302);
});
