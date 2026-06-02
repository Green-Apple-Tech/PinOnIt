import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GooglePerson {
  names?: { displayName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
  organizations?: { name?: string }[];
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("[gmail-contacts-sync] Token refresh HTTP error:", res.status);
    return null;
  }

  const data = await res.json() as { access_token?: string; error?: string };
  if (data.error || !data.access_token) {
    console.error("[gmail-contacts-sync] Token refresh error:", data.error);
    return null;
  }

  return { access_token: data.access_token };
}

// deno-lint-ignore no-explicit-any
async function importGoogleContacts(
  supabase: any,
  hostId: string,
  accessToken: string,
): Promise<{ imported: number; fetched: number; error?: string }> {
  console.log("[gmail-contacts-sync] Fetching Google People API contacts...");

  let connections: GooglePerson[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: "names,emailAddresses,phoneNumbers,organizations",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://people.googleapis.com/v1/people/me/connections?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const body = await res.text();
    console.log("[gmail-contacts-sync] People API status:", res.status);

    if (!res.ok) {
      console.error("[gmail-contacts-sync] People API error:", body.slice(0, 500));
      if (res.status === 401 || res.status === 403) {
        return { imported: 0, fetched: 0, error: "contacts_scope_or_token_invalid" };
      }
      return { imported: 0, fetched: 0, error: `People API returned ${res.status}` };
    }

    try {
      const data = JSON.parse(body) as { connections?: GooglePerson[]; nextPageToken?: string; totalPeople?: number };
      connections.push(...(data.connections ?? []));
      pageToken = data.nextPageToken;
      console.log("[gmail-contacts-sync] Page fetched, running total:", connections.length);
    } catch (e) {
      console.error("[gmail-contacts-sync] Failed to parse People API response:", e);
      return { imported: 0, fetched: 0, error: "Failed to parse contacts response" };
    }
  } while (pageToken);

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

  console.log("[gmail-contacts-sync] Contacts with email:", fullRows.length);

  if (!fullRows.length) return { imported: 0, fetched: 0 };

  let totalImported = 0;
  let useFallback = false;

  for (let i = 0; i < fullRows.length; i += 100) {
    const batch = useFallback
      ? fullRows.slice(i, i + 100).map(({ host_id, email, full_name }) => ({ host_id, email, full_name, source: "gmail" }))
      : fullRows.slice(i, i + 100);

    const { error, count } = await supabase
      .from("contacts")
      .upsert(batch, { onConflict: "host_id,email", count: "exact" });

    if (error) {
      const isSchemaError =
        error.message?.includes("column") ||
        error.code === "42703" ||
        error.message?.includes("schema cache");

      if (isSchemaError && !useFallback) {
        useFallback = true;
        i -= 100;
        continue;
      }

      console.error("[gmail-contacts-sync] Upsert error:", JSON.stringify(error));
      return { imported: totalImported, fetched: fullRows.length, error: error.message };
    }

    totalImported += count ?? batch.length;
  }

  console.log("[gmail-contacts-sync] Contacts upserted:", totalImported);
  return { imported: totalImported, fetched: fullRows.length };
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

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("gmail_connected, gmail_access_token, gmail_refresh_token")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile?.gmail_connected || !profile.gmail_access_token) {
      return new Response(JSON.stringify({ error: "Gmail not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = profile.gmail_access_token as string;
    let result = await importGoogleContacts(admin, user.id, accessToken);

    if (result.error === "contacts_scope_or_token_invalid" && profile.gmail_refresh_token) {
      const refreshed = await refreshGoogleToken(profile.gmail_refresh_token as string);
      if (refreshed) {
        accessToken = refreshed.access_token;
        await admin.from("profiles").update({ gmail_access_token: accessToken }).eq("id", user.id);
        result = await importGoogleContacts(admin, user.id, accessToken);
      }
    }

    if (result.error === "contacts_scope_or_token_invalid") {
      return new Response(JSON.stringify({
        error: "Google contacts permission expired. Please disconnect and reconnect Gmail.",
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
    await admin.from("profiles").update({ gmail_contacts_count: syncedCount }).eq("id", user.id);

    return new Response(JSON.stringify({
      imported: syncedCount,
      upserted: result.imported,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = (err as Error).message ?? "Unknown error";
    console.error("[gmail-contacts-sync] Unhandled exception:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
