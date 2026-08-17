import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { loadAuthorizedBooking } from "../_shared/bookingCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  booking_id: string;
  host_id: string;
  action_token?: string;
  start_time: string;
  end_time: string;
  summary: string;
  guest_email: string;
  guest_name: string;
}

async function refreshMicrosoftToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "offline_access OnlineMeetings.ReadWrite User.Read",
    }),
  });
  if (!res.ok) {
    console.error("[create-teams-meeting] Token refresh failed:", res.status, await res.text());
    return null;
  }
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Azure OAuth not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body: RequestBody = await req.json();
    const { booking_id, host_id, action_token, summary, guest_email, guest_name } = body;

    if (!booking_id || !host_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authorized = await loadAuthorizedBooking(supabase, booking_id, host_id, action_token);
    if ("error" in authorized) {
      return new Response(
        JSON.stringify({ error: authorized.error }),
        { status: authorized.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const start_time = authorized.booking.start_time;
    const end_time = authorized.booking.end_time;

    // Look up host's Outlook calendar connection
    const { data: calendar, error: calErr } = await supabase
      .from("connected_calendars")
      .select("access_token, refresh_token, token_expires_at")
      .eq("host_id", host_id)
      .eq("provider", "outlook")
      .eq("sync_enabled", true)
      .maybeSingle();

    if (calErr || !calendar) {
      console.log("[create-teams-meeting] No Outlook calendar connected for host:", host_id);
      return new Response(
        JSON.stringify({ teams_link: null, reason: "no_outlook_calendar" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if expired or close to expiry
    let accessToken = calendar.access_token;
    const expiresAt = calendar.token_expires_at ? new Date(calendar.token_expires_at).getTime() : 0;
    const nowMs = Date.now();
    if (!accessToken || expiresAt - nowMs < 60_000) {
      if (!calendar.refresh_token) {
        return new Response(
          JSON.stringify({ teams_link: null, reason: "no_refresh_token" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const refreshed = await refreshMicrosoftToken(clientId, clientSecret, calendar.refresh_token);
      if (!refreshed) {
        return new Response(
          JSON.stringify({ teams_link: null, reason: "token_refresh_failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      await supabase
        .from("connected_calendars")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(nowMs + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("host_id", host_id)
        .eq("provider", "outlook");
    }

    // Create online meeting via Microsoft Graph
    const meetingPayload = {
      subject: summary,
      startDateTime: start_time,
      endDateTime: end_time,
      participants: {
        attendees: [
          {
            upn: guest_email,
            role: "attendee",
            identity: {
              user: {
                displayName: guest_name,
                id: guest_email,
              },
            },
          },
        ],
      },
    };

    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me/onlineMeetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(meetingPayload),
    });

    const graphBody = await graphRes.text();
    console.log("[create-teams-meeting] Graph API status:", graphRes.status);

    if (!graphRes.ok) {
      console.error("[create-teams-meeting] Graph API error:", graphBody.slice(0, 500));
      return new Response(
        JSON.stringify({ teams_link: null, reason: "graph_api_error", detail: graphBody.slice(0, 200) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    interface OnlineMeeting {
      id?: string;
      joinWebUrl?: string;
    }
    const meeting: OnlineMeeting = JSON.parse(graphBody);
    const teamsLink = meeting.joinWebUrl ?? null;

    console.log("[create-teams-meeting] Teams link:", teamsLink ?? "none");

    if (teamsLink) {
      await supabase
        .from("bookings")
        .update({ meet_link: teamsLink })
        .eq("id", booking_id);
    }

    return new Response(
      JSON.stringify({ teams_link: teamsLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-teams-meeting] Unhandled error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
