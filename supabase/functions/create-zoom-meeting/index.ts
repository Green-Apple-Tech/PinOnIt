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

async function refreshZoomToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    console.error("[create-zoom-meeting] Token refresh failed:", res.status, await res.text());
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
    const clientId = Deno.env.get("ZOOM_CLIENT_ID");
    const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ zoom_link: null, reason: "zoom_not_configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body: RequestBody = await req.json();
    const { booking_id, host_id, action_token, summary } = body;

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

    const { data: calendar, error: calErr } = await supabase
      .from("connected_calendars")
      .select("access_token, refresh_token, token_expires_at")
      .eq("host_id", host_id)
      .eq("provider", "zoom")
      .eq("sync_enabled", true)
      .maybeSingle();

    if (calErr || !calendar) {
      return new Response(
        JSON.stringify({ zoom_link: null, reason: "no_zoom_connected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = calendar.access_token;
    const expiresAt = calendar.token_expires_at ? new Date(calendar.token_expires_at).getTime() : 0;
    const nowMs = Date.now();

    if (!accessToken || expiresAt - nowMs < 60_000) {
      if (!calendar.refresh_token) {
        return new Response(
          JSON.stringify({ zoom_link: null, reason: "no_refresh_token" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const refreshed = await refreshZoomToken(clientId, clientSecret, calendar.refresh_token);
      if (!refreshed) {
        return new Response(
          JSON.stringify({ zoom_link: null, reason: "token_refresh_failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      const updatePayload: Record<string, string> = {
        access_token: accessToken,
        token_expires_at: new Date(nowMs + refreshed.expires_in * 1000).toISOString(),
      };
      if (refreshed.refresh_token) updatePayload.refresh_token = refreshed.refresh_token;
      await supabase
        .from("connected_calendars")
        .update(updatePayload)
        .eq("host_id", host_id)
        .eq("provider", "zoom");
    }

    // Calculate duration in minutes
    const durationMs = new Date(end_time).getTime() - new Date(start_time).getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    const meetingPayload = {
      topic: summary,
      type: 2, // scheduled meeting
      start_time: start_time,
      duration: durationMinutes,
      timezone: "UTC",
      settings: {
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: false,
      },
    };

    const zoomRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(meetingPayload),
    });

    const zoomBody = await zoomRes.text();
    console.log("[create-zoom-meeting] Zoom API status:", zoomRes.status);

    if (!zoomRes.ok) {
      console.error("[create-zoom-meeting] Zoom API error:", zoomBody.slice(0, 500));
      return new Response(
        JSON.stringify({ zoom_link: null, reason: "zoom_api_error", detail: zoomBody.slice(0, 200) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    interface ZoomMeeting {
      id?: number;
      join_url?: string;
    }
    const meeting: ZoomMeeting = JSON.parse(zoomBody);
    const zoomLink = meeting.join_url ?? null;

    console.log("[create-zoom-meeting] Zoom join URL:", zoomLink ?? "none");

    if (zoomLink) {
      await supabase
        .from("bookings")
        .update({ meet_link: zoomLink })
        .eq("id", booking_id);
    }

    return new Response(
      JSON.stringify({ zoom_link: zoomLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-zoom-meeting] Unhandled error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
