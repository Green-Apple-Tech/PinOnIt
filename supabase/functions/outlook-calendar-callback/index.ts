import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MicrosoftTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GraphEvent {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  start: { dateTime?: string; timeZone?: string };
  end: { dateTime?: string; timeZone?: string };
}

interface GraphContact {
  displayName?: string;
  emailAddresses?: { address?: string; name?: string }[];
  mobilePhone?: string | null;
  businessPhones?: string[];
  companyName?: string | null;
}

// deno-lint-ignore no-explicit-any
async function storeEvents(supabase: any, hostId: string, calRowId: string, events: GraphEvent[]): Promise<{ stored: number; error?: string }> {
  const rows = events
    .filter((e) => !e.isCancelled)
    .map((e) => ({
      calendar_id: calRowId,
      host_id: hostId,
      provider_event_id: e.id,
      title: e.subject ?? "Busy",
      start_at: e.start.dateTime ? new Date(e.start.dateTime).toISOString() : new Date().toISOString(),
      end_at: e.end.dateTime ? new Date(e.end.dateTime).toISOString() : new Date().toISOString(),
      all_day: e.isAllDay ?? false,
      recurrence_rule: null,
      raw_json: e,
    }));

  if (!rows.length) return { stored: 0 };

  let totalStored = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { error, count } = await supabase
      .from("calendar_events")
      .upsert(rows.slice(i, i + 100), { onConflict: "calendar_id,provider_event_id", count: "exact" });
    if (error) {
      console.error("[outlook-callback] upsert error:", JSON.stringify(error));
      return { stored: totalStored, error: error.message };
    }
    totalStored += count ?? rows.slice(i, i + 100).length;
  }

  const { error: syncErr } = await supabase
    .from("connected_calendars")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", calRowId);
  if (syncErr) console.error("[outlook-callback] last_synced_at update error:", JSON.stringify(syncErr));

  return { stored: totalStored };
}

// deno-lint-ignore no-explicit-any
async function importOutlookContacts(supabase: any, hostId: string, accessToken: string): Promise<{ imported: number; error?: string }> {
  console.log("[outlook-contacts] Fetching Microsoft Graph contacts...");

  const params = new URLSearchParams({
    "$select": "displayName,emailAddresses,mobilePhone,companyName,businessPhones",
    "$top": "999",
  });

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/contacts?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const body = await res.text();
  console.log("[outlook-contacts] Graph contacts status:", res.status);

  if (res.status === 403 || res.status === 401) {
    console.error("[outlook-contacts] Contacts permission not granted:", body.slice(0, 300));
    return { imported: 0, error: "contacts_permission_not_granted" };
  }

  if (!res.ok) {
    console.error("[outlook-contacts] Graph contacts error:", body.slice(0, 300));
    return { imported: 0, error: `Graph contacts returned ${res.status}` };
  }

  let contacts: GraphContact[] = [];
  try {
    const data = JSON.parse(body) as { value?: GraphContact[] };
    contacts = data.value ?? [];
    console.log("[outlook-contacts] Total contacts:", contacts.length);
  } catch (e) {
    console.error("[outlook-contacts] Failed to parse contacts response:", e);
    return { imported: 0, error: "Failed to parse contacts response" };
  }

  const rows = contacts
    .flatMap((c) => {
      const emails = (c.emailAddresses ?? []).map((e) => e.address?.trim().toLowerCase()).filter((e) => e && e.includes("@"));
      if (!emails.length) return [];
      const phone = c.mobilePhone ?? c.businessPhones?.[0] ?? null;
      const company = c.companyName ?? null;
      const full_name = c.displayName ?? null;
      return emails.map((email) => ({ host_id: hostId, email: email!, full_name, phone, company, source: "outlook" }));
    });

  console.log("[outlook-contacts] Contacts with email:", rows.length);
  if (!rows.length) return { imported: 0 };

  let totalImported = 0;
  let useFallback = false;

  for (let i = 0; i < rows.length; i += 100) {
    const batch = useFallback
      ? rows.slice(i, i + 100).map(({ host_id, email, full_name }) => ({ host_id, email, full_name }))
      : rows.slice(i, i + 100);

    const { error, count } = await supabase
      .from("contacts")
      .upsert(batch, { onConflict: "host_id,email", ignoreDuplicates: true, count: "exact" });

    if (error) {
      const isSchemaError = error.message?.includes("column") || error.code === "42703" || error.message?.includes("schema cache");
      if (isSchemaError && !useFallback) {
        console.warn("[outlook-contacts] Schema error, falling back to minimal columns:", error.message);
        useFallback = true;
        i -= 100;
        continue;
      }
      console.error("[outlook-contacts] Upsert error:", JSON.stringify(error));
      return { imported: totalImported, error: error.message };
    }

    totalImported += count ?? 0;
  }

  console.log("[outlook-contacts] Contacts imported:", totalImported);
  return { imported: totalImported };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  // Use service role — Microsoft redirects here, there is no user session
  const supabase = createClient(supabaseUrl, serviceKey);

  const APP_URL = "https://pinonit.com";
  let redirectBase = `${APP_URL}/dashboard/appointments`;

  console.log("[outlook-callback] Function invoked, method:", req.method);
  console.log("[outlook-callback] AZURE_CLIENT_ID present:", !!clientId);
  console.log("[outlook-callback] AZURE_CLIENT_SECRET present:", !!clientSecret);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    console.log("[outlook-callback] code present:", !!code);
    console.log("[outlook-callback] state present:", !!state);
    console.log("[outlook-callback] error param:", errorParam ?? "none");

    if (errorParam) {
      const desc = url.searchParams.get("error_description") ?? errorParam;
      console.error("[outlook-callback] Microsoft returned error:", desc);
      return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(desc)}`, 302);
    }

    if (!code || !state) {
      console.error("[outlook-callback] Missing code or state");
      return Response.redirect(`${redirectBase}?calendar_error=missing_params`, 302);
    }

    if (!clientId || !clientSecret) {
      console.error("[outlook-callback] Missing Azure OAuth credentials");
      return Response.redirect(`${redirectBase}?calendar_error=oauth_not_configured`, 302);
    }

    // Decode user id and source from state
    let uid: string;
    let source = "calendar";
    try {
      const decoded = JSON.parse(atob(state)) as { uid: string; source?: string };
      uid = decoded.uid;
      source = decoded.source ?? "calendar";
      if (source === "contacts") redirectBase = `${APP_URL}/dashboard/contacts`;
      console.log("[outlook-callback] Decoded uid from state:", uid);
      console.log("[outlook-callback] Decoded source from state:", source);
    } catch (e) {
      console.error("[outlook-callback] Failed to decode state:", e);
      return Response.redirect(`${redirectBase}?calendar_error=invalid_state`, 302);
    }

    // Must exactly match the redirect_uri sent in outlook-calendar-auth and registered in Azure
    const redirectUri = `${supabaseUrl}/functions/v1/outlook-calendar-callback`;
    console.log("[outlook-callback] redirect_uri used for token exchange:", redirectUri);

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "offline_access Calendars.Read User.Read OnlineMeetings.ReadWrite",
      }),
    });

    const tokenBody = await tokenRes.text();
    console.log("[outlook-callback] Token exchange status:", tokenRes.status);
    console.log("[outlook-callback] Token exchange response:", tokenBody.slice(0, 500));

    let tokens: MicrosoftTokenResponse;
    try {
      tokens = JSON.parse(tokenBody) as MicrosoftTokenResponse;
    } catch {
      console.error("[outlook-callback] Failed to parse token response");
      return Response.redirect(`${redirectBase}?calendar_error=token_parse_failed`, 302);
    }

    if (tokens.error || !tokens.access_token) {
      const msg = tokens.error_description ?? tokens.error ?? "token_exchange_failed";
      console.error("[outlook-callback] Token exchange failed:", msg);
      return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(msg)}`, 302);
    }

    console.log("[outlook-callback] access_token received: YES");
    console.log("[outlook-callback] refresh_token received:", !!tokens.refresh_token);
    console.log("[outlook-callback] expires_in:", tokens.expires_in);

    // ── CONTACTS FLOW ────────────────────────────────────────────────────────
    if (source === "contacts") {
      const { imported, error: importErr } = await importOutlookContacts(supabase, uid, tokens.access_token);

      if (importErr === "contacts_permission_not_granted") {
        console.error("[outlook-callback] Contacts.Read scope not granted");
        return Response.redirect(
          `${redirectBase}?outlook_connected=1&contacts_error=contacts_permission_not_granted`,
          302
        );
      }

      if (importErr) {
        console.error("[outlook-callback] Contacts import failed:", importErr);
        return Response.redirect(
          `${redirectBase}?outlook_connected=1&contacts_error=${encodeURIComponent(importErr)}`,
          302
        );
      }

      await supabase
        .from("profiles")
        .update({ outlook_contacts_connected: true, outlook_contacts_count: imported })
        .eq("id", uid);

      console.log("[outlook-callback] Contacts flow complete — imported:", imported);
      return Response.redirect(
        `${redirectBase}?outlook_connected=1&contacts_imported=${imported}`,
        302
      );
    }

    // ── CALENDAR FLOW ────────────────────────────────────────────────────────

    // Fetch Microsoft account email via Graph API
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profileBody = await profileRes.text();
    console.log("[outlook-callback] Graph /me status:", profileRes.status);

    let email = "";
    try {
      const profileData = JSON.parse(profileBody) as { mail?: string; userPrincipalName?: string };
      email = profileData.mail ?? profileData.userPrincipalName ?? "";
      console.log("[outlook-callback] Got email:", email ? "yes" : "no");
    } catch {
      console.error("[outlook-callback] Failed to parse /me response");
    }

    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    const refreshToken = tokens.refresh_token ?? "";

    // Find existing Outlook calendar row for this user
    const { data: existing, error: selectErr } = await supabase
      .from("connected_calendars")
      .select("id")
      .eq("host_id", uid)
      .eq("provider", "outlook")
      .maybeSingle();

    if (selectErr) console.error("[outlook-callback] Select error:", JSON.stringify(selectErr));
    console.log("[outlook-callback] Existing calendar row:", existing ? existing.id : "none");

    let calRowId: string;

    if (existing) {
      const updatePayload: Record<string, string | boolean> = {
        provider_account_email: email,
        access_token: tokens.access_token,
        token_expires_at: tokenExpiresAt,
        sync_enabled: true,
        calendar_id: "primary",
        calendar_name: "Outlook Calendar",
      };
      if (tokens.refresh_token) updatePayload.refresh_token = tokens.refresh_token;

      const { error: updateErr } = await supabase
        .from("connected_calendars")
        .update(updatePayload)
        .eq("id", existing.id);

      if (updateErr) {
        console.error("[outlook-callback] Update error:", JSON.stringify(updateErr));
        return Response.redirect(`${redirectBase}?calendar_error=db_update_failed`, 302);
      }
      console.log("[outlook-callback] Updated existing row:", existing.id);
      calRowId = existing.id;
    } else {
      const insertPayload = {
        host_id: uid,
        provider: "outlook",
        provider_account_email: email,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        sync_enabled: true,
        calendar_id: "primary",
        calendar_name: "Outlook Calendar",
      };
      console.log("[outlook-callback] Inserting new row with host_id:", uid);

      const { data: inserted, error: insertErr } = await supabase
        .from("connected_calendars")
        .insert(insertPayload)
        .select("id")
        .maybeSingle();

      if (insertErr || !inserted) {
        console.error("[outlook-callback] Insert error:", JSON.stringify(insertErr));
        return Response.redirect(`${redirectBase}?calendar_error=db_insert_failed`, 302);
      }
      console.log("[outlook-callback] Inserted new row:", inserted.id);
      calRowId = inserted.id;
    }

    // Fetch upcoming Outlook Calendar events via Microsoft Graph
    const now = new Date();
    const startDateTime = new Date(now); startDateTime.setMonth(startDateTime.getMonth() - 1);
    const endDateTime = new Date(now); endDateTime.setMonth(endDateTime.getMonth() + 3);

    const evtParams = new URLSearchParams({
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      $top: "500",
      $select: "id,subject,isAllDay,isCancelled,start,end",
      $orderby: "start/dateTime",
    });

    const evtRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?${evtParams}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}`, Prefer: 'outlook.timezone="UTC"' } }
    );

    console.log("[outlook-callback] Calendar events fetch status:", evtRes.status);
    const evtBody = await evtRes.text();

    let events: GraphEvent[] = [];
    try {
      const evtData = JSON.parse(evtBody) as { value?: GraphEvent[]; error?: unknown };
      if (evtData.error) {
        console.error("[outlook-callback] Graph API error:", JSON.stringify(evtData.error));
      } else {
        events = evtData.value ?? [];
        console.log("[outlook-callback] Events fetched:", events.length);
      }
    } catch {
      console.error("[outlook-callback] Failed to parse events response:", evtBody.slice(0, 500));
    }

    if (events.length > 0) {
      const { stored, error: storeErr } = await storeEvents(supabase, uid, calRowId, events);
      console.log("[outlook-callback] Events stored:", stored);
      if (storeErr) console.error("[outlook-callback] Store events error:", storeErr);
    } else {
      console.log("[outlook-callback] No events to store");
    }

    console.log("[outlook-callback] Success — redirecting with calendar_connected=outlook");
    return Response.redirect(`${redirectBase}?calendar_connected=outlook`, 302);
  } catch (err) {
    const msg = (err as Error).message ?? "unknown_error";
    console.error("[outlook-callback] Unhandled exception:", msg);
    return Response.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(msg)}`, 302);
  }
});
