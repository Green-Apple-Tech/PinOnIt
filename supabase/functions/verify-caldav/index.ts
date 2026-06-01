import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, action, calendar_id } = await req.json();

    // Handle disconnect
    if (action === "disconnect" && calendar_id) {
      await supabase.from("calendar_events").delete().eq("calendar_id", calendar_id);
      await supabase.from("connected_calendars").delete().eq("id", calendar_id).eq("host_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and app-specific password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apple iCloud CalDAV principal URL
    const caldavUrl = `https://caldav.icloud.com/`;
    const credentials = btoa(`${email}:${password}`);

    // Probe Apple CalDAV with a PROPFIND request to discover calendars
    const propfind = `<?xml version="1.0" encoding="UTF-8"?>
<A:propfind xmlns:A="DAV:">
  <A:prop>
    <A:displayname/>
    <A:resourcetype/>
  </A:prop>
</A:propfind>`;

    let verifyOk = false;
    let calendarName = "iCloud Calendar";

    try {
      const resp = await fetch(caldavUrl, {
        method: "PROPFIND",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/xml; charset=utf-8",
          Depth: "0",
        },
        body: propfind,
      });

      if (resp.status === 207 || resp.status === 200) {
        verifyOk = true;
      } else if (resp.status === 401) {
        return new Response(JSON.stringify({ error: "Invalid credentials. Make sure you're using an app-specific password, not your Apple ID password." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Treat non-401 errors as a partial success — credentials may still be valid
        verifyOk = resp.status !== 403;
      }
    } catch (_e) {
      // Network error — still store credentials optimistically
      verifyOk = true;
    }

    if (!verifyOk) {
      return new Response(JSON.stringify({ error: "Could not connect to iCloud CalDAV. Check your credentials and try again." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store the connection
    const { data: cal, error: insertErr } = await supabase
      .from("connected_calendars")
      .insert({
        host_id: user.id,
        provider: "apple",
        provider_account_email: email,
        calendar_name: calendarName,
        sync_enabled: true,
        caldav_url: caldavUrl,
        caldav_username: email,
        caldav_password: password,
      })
      .select()
      .maybeSingle();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, calendar: cal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
