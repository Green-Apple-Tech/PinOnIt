// DEPLOY (required): supabase functions deploy slack-callback --no-verify-jwt --project-ref adlusgtlwgcfyxgeoias
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseOAuthContext, isValidOAuthUserId } from "../_shared/oauth-state.ts";
import { isValidSlackWebhookUrl } from "../_shared/slack-webhook.ts";

function fail(redirectBase: string, code: string) {
  const sep = redirectBase.includes("?") ? "&" : "?";
  return Response.redirect(`${redirectBase}${sep}slack_error=${encodeURIComponent(code)}`, 302);
}

function ok(redirectBase: string) {
  const sep = redirectBase.includes("?") ? "&" : "?";
  return Response.redirect(`${redirectBase}${sep}slack_connected=1`, 302);
}

interface SlackOAuthResponse {
  ok?: boolean;
  error?: string;
  incoming_webhook?: {
    url?: string;
    channel?: string;
  };
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("SLACK_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("SLACK_CLIENT_SECRET")?.trim();

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const oauth = parseOAuthContext(state);
  const redirectBase = oauth.redirectBase;

  if (errorParam) return fail(redirectBase, errorParam);
  if (!code || !state) return fail(redirectBase, "missing_params");
  if (!clientId || !clientSecret) return fail(redirectBase, "oauth_not_configured");
  if (!oauth.userId || !isValidOAuthUserId(oauth.userId)) return fail(redirectBase, "invalid_state");

  const redirectUri = `${supabaseUrl}/functions/v1/slack-callback`;

  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenRes.json() as SlackOAuthResponse;
    const webhookUrl = tokens.incoming_webhook?.url?.trim() ?? "";

    if (!tokens.ok || !isValidSlackWebhookUrl(webhookUrl)) {
      const msg = tokens.error ?? "token_exchange_failed";
      console.error("[slack-callback] Slack OAuth failed:", msg);
      return fail(redirectBase, msg);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ slack_webhook_url: webhookUrl })
      .eq("id", oauth.userId);

    if (updateErr) {
      console.error("[slack-callback] db update failed:", updateErr.message);
      return fail(redirectBase, "db_update_failed");
    }

    return ok(redirectBase);
  } catch (err) {
    const msg = (err as Error).message ?? "unknown_error";
    console.error("[slack-callback]", msg);
    return fail(redirectBase, msg);
  }
});
