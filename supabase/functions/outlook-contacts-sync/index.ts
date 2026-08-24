import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dedupeContactRows } from "../_shared/dedupe-contacts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GraphContact {
  displayName?: string;
  emailAddresses?: { address?: string; name?: string }[];
  mobilePhone?: string | null;
  businessPhones?: string[];
  companyName?: string | null;
}

interface ConnectedCalendar {
  id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
}

async function refreshOutlookToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "offline_access Contacts.Read User.Read",
    }),
  });

  if (!res.ok) {
    console.error("[outlook-contacts-sync] Token refresh HTTP error:", res.status);
    return null;
  }

  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (data.error || !data.access_token) {
    console.error("[outlook-contacts-sync] Token refresh error:", data.error);
    return null;
  }

  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in ?? 3600 };
}

// deno-lint-ignore no-explicit-any
async function importOutlookContacts(
  supabase: any,
  hostId: string,
  accessToken: string,
): Promise<{ imported: number; fetched: number; error?: string }> {
  console.log("[outlook-contacts-sync] Fetching Microsoft Graph contacts...");

  let contacts: GraphContact[] = [];
  let nextUrl: string | null = `https://graph.microsoft.com/v1.0/me/contacts?$select=displayName,emailAddresses,mobilePhone,companyName,businessPhones&$top=999`;

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.text();
    console.log("[outlook-contacts-sync] Graph contacts status:", res.status);

    if (res.status === 403 || res.status === 401) {
      console.error("[outlook-contacts-sync] Contacts permission not granted:", body.slice(0, 300));
      return { imported: 0, fetched: 0, error: "contacts_permission_not_granted" };
    }

    if (!res.ok) {
      console.error("[outlook-contacts-sync] Graph contacts error:", body.slice(0, 300));
      return { imported: 0, fetched: 0, error: `Graph contacts returned ${res.status}` };
    }

    try {
      const data = JSON.parse(body) as { value?: GraphContact[]; "@odata.nextLink"?: string };
      contacts.push(...(data.value ?? []));
      nextUrl = data["@odata.nextLink"] ?? null;
    } catch (e) {
      console.error("[outlook-contacts-sync] Failed to parse contacts response:", e);
      return { imported: 0, fetched: 0, error: "Failed to parse contacts response" };
    }
  }

  const rows = contacts.flatMap((c) => {
    const emails = (c.emailAddresses ?? [])
      .map((e) => e.address?.trim().toLowerCase())
      .filter((e) => e && e.includes("@"));
    if (!emails.length) return [];
    const phone = c.mobilePhone ?? c.businessPhones?.[0] ?? null;
    const company = c.companyName ?? null;
    const full_name = c.displayName ?? null;
    return emails.map((email) => ({ host_id: hostId, email: email!, full_name, phone, company, source: "outlook" }));
  });

  const uniqueRows = dedupeContactRows(rows);
  console.log("[outlook-contacts-sync] Contacts with email:", rows.length, "unique:", uniqueRows.length);
  if (!uniqueRows.length) return { imported: 0, fetched: 0 };

  let totalImported = 0;
  let useFallback = false;

  for (let i = 0; i < uniqueRows.length; i += 100) {
    const batch = useFallback
      ? uniqueRows.slice(i, i + 100).map(({ host_id, email, full_name }) => ({ host_id, email, full_name, source: "outlook" }))
      : uniqueRows.slice(i, i + 100);

    const { error, count } = await supabase
      .from("contacts")
      .upsert(batch, { onConflict: "host_id,email", count: "exact" });

    if (error) {
      const isSchemaError = error.message?.includes("column") || error.code === "42703" || error.message?.includes("schema cache");
      if (isSchemaError && !useFallback) {
        useFallback = true;
        i -= 100;
        continue;
      }
      console.error("[outlook-contacts-sync] Upsert error:", JSON.stringify(error));
      return { imported: totalImported, fetched: uniqueRows.length, error: error.message };
    }

    totalImported += count ?? batch.length;
  }

  console.log("[outlook-contacts-sync] Contacts upserted:", totalImported);
  return { imported: totalImported, fetched: uniqueRows.length };
}

async function getOutlookAccessToken(
  admin: ReturnType<typeof createClient>,
  cal: ConnectedCalendar,
): Promise<string | null> {
  let accessToken = cal.access_token;
  const needsRefresh = !accessToken ||
    !cal.token_expires_at ||
    new Date(cal.token_expires_at).getTime() <= Date.now() + 60_000;

  if (!needsRefresh) return accessToken;

  if (!cal.refresh_token) return null;

  const refreshed = await refreshOutlookToken(cal.refresh_token);
  if (!refreshed) return null;

  accessToken = refreshed.access_token;
  const updatePayload: Record<string, string> = {
    access_token: accessToken,
    token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  };
  if (refreshed.refresh_token) updatePayload.refresh_token = refreshed.refresh_token;

  await admin.from("connected_calendars").update(updatePayload).eq("id", cal.id);
  return accessToken;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("outlook_contacts_connected")
      .eq("id", user.id)
      .maybeSingle();

    const { data: cal, error: calErr } = await admin
      .from("connected_calendars")
      .select("id, access_token, refresh_token, token_expires_at")
      .eq("host_id", user.id)
      .eq("provider", "outlook")
      .maybeSingle();

    if (calErr || !cal?.access_token) {
      return new Response(JSON.stringify({
        error: profile?.outlook_contacts_connected
          ? "Outlook token missing. Please disconnect and reconnect Outlook."
          : "Outlook not connected",
        code: "reconnect_required",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getOutlookAccessToken(admin, cal as ConnectedCalendar);
    if (!accessToken) {
      return new Response(JSON.stringify({
        error: "Outlook token expired. Please disconnect and reconnect Outlook.",
        code: "reconnect_required",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result = await importOutlookContacts(admin, user.id, accessToken);

    if (result.error === "contacts_permission_not_granted") {
      return new Response(JSON.stringify({
        error: "Contacts permission not granted. Please reconnect Outlook.",
        code: "reconnect_required",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const syncedCount = result.fetched;
    await admin.from("profiles").update({
      outlook_contacts_connected: true,
      outlook_contacts_count: syncedCount,
    }).eq("id", user.id);

    return new Response(JSON.stringify({
      imported: syncedCount,
      upserted: result.imported,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = (err as Error).message ?? "Unknown error";
    console.error("[outlook-contacts-sync] Unhandled exception:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
