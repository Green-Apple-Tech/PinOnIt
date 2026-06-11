// Calendly OAuth callback — browser redirect, no JWT.
// DEPLOY: supabase functions deploy calendly-callback --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  calendlyRedirectUri,
  exchangeCalendlyCode,
  tokenExpiresAt,
} from "../_shared/calendly-oauth.ts";
import { decodeOAuthState, isValidOAuthUserId, oauthRedirectBase } from "../_shared/oauth-state.ts";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const decoded = decodeOAuthState(state ?? "");
  const source = decoded?.source ?? "calendly_import";
  const redirectBase = oauthRedirectBase(source);
  const userId = decoded?.userId ?? decoded?.uid ?? null;
  const codeVerifier = decoded?.codeVerifier as string | undefined;

  const fail = (message: string) => {
    const dest = new URL(redirectBase);
    dest.searchParams.set("calendly_error", message);
    return Response.redirect(dest.toString(), 302);
  };

  if (oauthError) {
    return fail(oauthError);
  }

  if (!code || !userId || !isValidOAuthUserId(userId) || !codeVerifier) {
    return fail("Invalid OAuth state");
  }

  const clientId = Deno.env.get("CALENDLY_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("CALENDLY_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) {
    return fail("Calendly OAuth not configured");
  }

  try {
    const tokenData = await exchangeCalendlyCode({
      code,
      codeVerifier,
      clientId,
      clientSecret,
      redirectUri: calendlyRedirectUri(Deno.env.get("SUPABASE_URL")!),
    });

    if (!tokenData.access_token) {
      return fail(tokenData.error_description ?? tokenData.error ?? "Token exchange failed");
    }

    const meRes = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const meJson = await meRes.json() as { resource?: Record<string, unknown> };
    const resource = meJson.resource ?? {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("integrations").upsert(
      {
        host_id: userId,
        provider: "calendly",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: tokenExpiresAt(tokenData.expires_in),
        provider_user_uri: (resource.uri as string) ?? null,
        provider_account_email: (resource.email as string) ?? null,
        provider_account_name: (resource.name as string) ?? null,
        provider_slug: (resource.slug as string) ?? null,
        metadata: {
          scheduling_url: resource.scheduling_url ?? null,
          timezone: resource.timezone ?? null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "host_id,provider" }
    );

    await supabase.from("profiles").update({ calendly_connected: true }).eq("id", userId);

    const dest = new URL(redirectBase);
    dest.searchParams.set("calendly_connected", "1");
    if (source === "wizard") dest.searchParams.set("wizard", "true");
    return Response.redirect(dest.toString(), 302);
  } catch (err) {
    console.error("[calendly-callback]", err);
    return fail((err as Error).message ?? "Calendly connection failed");
  }
});
