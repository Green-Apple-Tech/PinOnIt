import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  status?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  recurrence?: string[];
}

interface GooglePerson {
  names?: { displayName?: string; givenName?: string; familyName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
  organizations?: { name?: string }[];
}

// deno-lint-ignore no-explicit-any
async function storeEvents(supabase: any, hostId: string, calRowId: string, events: GoogleEvent[]): Promise<{ stored: number; error?: string }> {
  const rows = events
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      calendar_id: calRowId,
      host_id: hostId,
      provider_event_id: e.id,
      title: e.summary ?? "Busy",
      start_at: e.start.dateTime ?? e.start.date ?? new Date().toISOString(),
      end_at: e.end.dateTime ?? e.end.date ?? new Date().toISOString(),
      all_day: !e.start.dateTime,
      recurrence_rule: e.recurrence?.[0] ?? null,
      raw_json: e,
    }));

  if (!rows.length) return { stored: 0 };

  let totalStored = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { error, count } = await supabase
      .from("calendar_events")
      .upsert(rows.slice(i, i + 100), { onConflict: "calendar_id,provider_event_id", count: "exact" });
    if (error) {
      console.error("[storeEvents] upsert error:", JSON.stringify(error));
      return { stored: totalStored, error: error.message };
    }
    totalStored += count ?? rows.slice(i, i + 100).length;
  }

  const { error: syncErr } = await supabase
    .from("connected_calendars")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", calRowId);
  if (syncErr) console.error("[storeEvents] last_synced_at update error:", JSON.stringify(syncErr));

  return { stored: totalStored };
}

// deno-lint-ignore no-explicit-any
async function importGoogleContacts(supabase: any, hostId: string, accessToken: string): Promise<{ imported: number; error?: string }> {
  console.log("[contacts] Fetching Google People API contacts...");

  const params = new URLSearchParams({
    personFields: "names,emailAddresses,phoneNumbers,organizations",
    pageSize: "1000",
  });

  const res = await fetch(
    `https://people.googleapis.com/v1/people/me/connections?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const body = await res.text();
  console.log("[contacts] People API status:", res.status);

  if (!res.ok) {
    console.error("[contacts] People API error:", body.slice(0, 500));
    return { imported: 0, error: `People API returned ${res.status}: ${body.slice(0, 200)}` };
  }

  let connections: GooglePerson[] = [];
  try {
    const data = JSON.parse(body) as { connections?: GooglePerson[]; totalPeople?: number };
    connections = data.connections ?? [];
    console.log("[contacts] Total connections:", data.totalPeople ?? connections.length);
  } catch (e) {
    console.error("[contacts] Failed to parse People API response:", e);
    return { imported: 0, error: "Failed to parse contacts response" };
  }

  // Filter to contacts that have at least one email address
  const fullRows = connections
    .filter((p) => p.emailAddresses && p.emailAddresses.length > 0)
    .map((p) => {
      const email = (p.emailAddresses![0].value ?? "").trim().toLowerCase();
      const name = p.names?.[0]?.displayName ?? null;
      const phone = p.phoneNumbers?.[0]?.value ?? null;
      const company = p.organizations?.[0]?.name ?? null;
      return { host_id: hostId, email, full_name: name, phone, company, source: "gmail" };
    })
    .filter((r) => r.email.includes("@"));

  console.log("[contacts] Contacts with email:", fullRows.length);

  if (!fullRows.length) return { imported: 0 };

  // Attempt upsert with all columns. If any batch fails due to missing columns,
  // fall back to a minimal row (only columns guaranteed to exist in the schema).
  let totalImported = 0;
  let useFallback = false;

  for (let i = 0; i < fullRows.length; i += 100) {
    const batch = useFallback
      ? fullRows.slice(i, i + 100).map(({ host_id, email, full_name }) => ({ host_id, email, full_name }))
      : fullRows.slice(i, i + 100);

    const { error, count } = await supabase
      .from("contacts")
      .upsert(batch, { onConflict: "host_id,email", ignoreDuplicates: true, count: "exact" });

    if (error) {
      // If the error is a schema/column error and we haven't fallen back yet, retry this batch with minimal columns
      const isSchemaError =
        error.message?.includes("column") ||
        error.code === "42703" ||
        error.message?.includes("schema cache");

      if (isSchemaError && !useFallback) {
        console.warn("[contacts] Schema error on full row, falling back to minimal columns:", error.message);
        useFallback = true;
        i -= 100; // retry this batch
        continue;
      }

      console.error("[contacts] Upsert error:", JSON.stringify(error));
      return { imported: totalImported, error: error.message };
    }

    totalImported += count ?? 0;
  }

  console.log("[contacts] Contacts imported/updated:", totalImported, useFallback ? "(fallback mode)" : "");
  return { imported: totalImported };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  // Use service role — Google redirects here, there is no user session
  const supabase = createClient(supabaseUrl, serviceKey);

  const APP_URL = "https://pinonit.com";

  console.log("[callback] Function invoked, method:", req.method);
  console.log("[callback] GOOGLE_CLIENT_ID present:", !!clientId);
  console.log("[callback] GOOGLE_CLIENT_SECRET present:", !!clientSecret);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    console.log("[callback] code present:", !!code);
    console.log("[callback] state present:", !!state);
    console.log("[callback] error param:", errorParam ?? "none");

    // Default redirect base before state is decoded
    let redirectBase = `${APP_URL}/dashboard/appointments`;

    if (errorParam) {
      console.error("[callback] Google returned error:", errorParam);
      return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(errorParam)}`, 302);
    }

    if (!code || !state) {
      console.error("[callback] Missing code or state");
      return Response.redirect(`${redirectBase}?calendar_error=missing_params`, 302);
    }

    if (!clientId || !clientSecret) {
      console.error("[callback] Missing Google OAuth credentials");
      return Response.redirect(`${redirectBase}?calendar_error=oauth_not_configured`, 302);
    }

    // Decode user id and source from state
    let uid: string;
    let source = "calendar";
    try {
      const decoded = JSON.parse(atob(state)) as { uid?: string; source?: string };
      if (!decoded.uid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.uid)) {
        throw new Error("invalid uid");
      }
      uid = decoded.uid;
      source = decoded.source ?? "calendar";
      if (source === "contacts") {
        redirectBase = `${APP_URL}/dashboard/contacts`;
      }
      console.log("[callback] Decoded uid from state:", uid);
      console.log("[callback] Decoded source from state:", source);
    } catch (e) {
      console.error("[callback] Failed to decode state:", e);
      return Response.redirect(`${redirectBase}?calendar_error=invalid_state`, 302);
    }

    // Must exactly match the redirect_uri sent in google-calendar-auth and registered in Google Cloud Console
    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`;
    console.log("[callback] redirect_uri used for token exchange:", redirectUri);

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenBody = await tokenRes.text();
    console.log("[callback] Token exchange status:", tokenRes.status);
    console.log("[callback] Token exchange response:", tokenBody.slice(0, 500));

    let tokens: GoogleTokenResponse;
    try {
      tokens = JSON.parse(tokenBody) as GoogleTokenResponse;
    } catch {
      console.error("[callback] Failed to parse token response");
      return Response.redirect(`${redirectBase}?calendar_error=token_parse_failed`, 302);
    }

    if (tokens.error || !tokens.access_token) {
      const msg = tokens.error_description ?? tokens.error ?? "token_exchange_failed";
      console.error("[callback] Token exchange failed:", msg);
      return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(msg)}`, 302);
    }

    console.log("[callback] access_token received: YES");
    console.log("[callback] refresh_token received:", !!tokens.refresh_token);

    // ── CONTACTS FLOW ────────────────────────────────────────────────────────
    if (source === "contacts") {
      // Store Gmail tokens on the profile row
      const gmailUpdatePayload: Record<string, string | boolean> = {
        gmail_connected: true,
        gmail_access_token: tokens.access_token,
      };
      if (tokens.refresh_token) gmailUpdatePayload.gmail_refresh_token = tokens.refresh_token;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update(gmailUpdatePayload)
        .eq("id", uid);

      if (profileErr) {
        console.error("[callback] Failed to store Gmail tokens on profile:", JSON.stringify(profileErr));
        return Response.redirect(`${redirectBase}?contacts_error=db_update_failed`, 302);
      }

      // Import Google contacts
      const { imported, error: importErr } = await importGoogleContacts(supabase, uid, tokens.access_token);

      if (importErr) {
        console.error("[callback] Contacts import failed:", importErr);
        // Still mark as connected even if import had issues — token is stored
        await supabase.from("profiles").update({ gmail_connected: true }).eq("id", uid);
        return Response.redirect(
          `${redirectBase}?gmail_connected=1&contacts_error=${encodeURIComponent(importErr)}`,
          302
        );
      }

      // Persist the imported count on the profile
      await supabase
        .from("profiles")
        .update({ gmail_contacts_count: imported })
        .eq("id", uid);

      console.log("[callback] Contacts flow complete — imported:", imported);
      return Response.redirect(
        `${redirectBase}?gmail_connected=1&contacts_imported=${imported}`,
        302
      );
    }

    // ── CALENDAR FLOW ────────────────────────────────────────────────────────

    // Fetch Google account email
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profileBody = await profileRes.text();
    console.log("[callback] Userinfo status:", profileRes.status);

    let email = "";
    try {
      const profileData = JSON.parse(profileBody) as { email?: string };
      email = profileData.email ?? "";
      console.log("[callback] Got email:", email ? "yes" : "no");
    } catch {
      console.error("[callback] Failed to parse userinfo response");
    }

    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    const refreshToken = tokens.refresh_token ?? "";

    // Find existing Google calendar row for this user
    const { data: existing, error: selectErr } = await supabase
      .from("connected_calendars")
      .select("id")
      .eq("host_id", uid)
      .eq("provider", "google")
      .maybeSingle();

    if (selectErr) {
      console.error("[callback] Select error:", JSON.stringify(selectErr));
    }
    console.log("[callback] Existing calendar row:", existing ? existing.id : "none");

    let calRowId: string;

    if (existing) {
      const updatePayload: Record<string, string | boolean> = {
        provider_account_email: email,
        access_token: tokens.access_token,
        token_expires_at: tokenExpiresAt,
        sync_enabled: true,
        calendar_id: "primary",
        calendar_name: "Google Calendar",
      };
      if (tokens.refresh_token) updatePayload.refresh_token = tokens.refresh_token;

      const { error: updateErr } = await supabase
        .from("connected_calendars")
        .update(updatePayload)
        .eq("id", existing.id);

      if (updateErr) {
        console.error("[callback] Update error:", JSON.stringify(updateErr));
        return Response.redirect(`${redirectBase}?calendar_error=db_update_failed`, 302);
      }
      console.log("[callback] Updated existing row:", existing.id);
      calRowId = existing.id;
    } else {
      const insertPayload = {
        host_id: uid,
        provider: "google",
        provider_account_email: email,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        sync_enabled: true,
        calendar_id: "primary",
        calendar_name: "Google Calendar",
      };
      console.log("[callback] Inserting new row with host_id:", uid);

      const { data: inserted, error: insertErr } = await supabase
        .from("connected_calendars")
        .insert(insertPayload)
        .select("id")
        .maybeSingle();

      if (insertErr || !inserted) {
        console.error("[callback] Insert error:", JSON.stringify(insertErr));
        return Response.redirect(`${redirectBase}?calendar_error=db_insert_failed`, 302);
      }
      console.log("[callback] Inserted new row:", inserted.id);
      calRowId = inserted.id;
    }

    // Fetch upcoming Google Calendar events
    const now = new Date();
    const timeMin = new Date(now); timeMin.setMonth(timeMin.getMonth() - 1);
    const timeMax = new Date(now); timeMax.setMonth(timeMax.getMonth() + 3);

    const evtParams = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "500",
    });

    const evtRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${evtParams}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    console.log("[callback] Calendar events fetch status:", evtRes.status);
    const evtBody = await evtRes.text();

    let events: GoogleEvent[] = [];
    try {
      const evtData = JSON.parse(evtBody) as { items?: GoogleEvent[]; error?: unknown };
      if (evtData.error) {
        console.error("[callback] Calendar API error:", JSON.stringify(evtData.error));
      } else {
        events = evtData.items ?? [];
        console.log("[callback] Events fetched:", events.length);
      }
    } catch {
      console.error("[callback] Failed to parse events response:", evtBody.slice(0, 500));
    }

    if (events.length > 0) {
      const { stored, error: storeErr } = await storeEvents(supabase, uid, calRowId, events);
      console.log("[callback] Events stored:", stored);
      if (storeErr) console.error("[callback] Store events error:", storeErr);
    } else {
      console.log("[callback] No events to store");
    }

    console.log("[callback] Success — redirecting with calendar_connected=google");
    return Response.redirect(`${redirectBase}?calendar_connected=google`, 302);
  } catch (err) {
    const msg = (err as Error).message ?? "unknown_error";
    console.error("[callback] Unhandled exception:", msg);
    return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(msg)}`, 302);
  }
});
