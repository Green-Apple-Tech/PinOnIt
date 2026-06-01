import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// calendar_events columns (including new conflict-aware ones):
//   id, host_id, calendar_id (uuid FK), provider_event_id, title,
//   start_at, end_at, all_day, recurrence_rule, raw_json,
//   show_status, transparency, attendee_self_status,
//   is_birthday_cal, is_holiday_cal, created_at, updated_at

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConnectedCalendar {
  id: string;
  host_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  sync_enabled: boolean;
}

// ── Google types ──────────────────────────────────────────────────────────────

interface GoogleAttendee {
  email?: string;
  self?: boolean;
  responseStatus?: string; // "accepted" | "declined" | "tentative" | "needsAction"
}

interface GoogleEvent {
  id: string;
  summary?: string;
  status?: string;          // "confirmed" | "tentative" | "cancelled"
  transparency?: string;    // "transparent" (free) | "opaque" (busy, default)
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  recurrence?: string[];
  attendees?: GoogleAttendee[];
  organizer?: { self?: boolean };
}

// ── Microsoft Graph types ─────────────────────────────────────────────────────

interface GraphEvent {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  showAs?: string; // "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown"
  responseStatus?: { response?: string }; // "accepted" | "declined" | "tentative" | "none"
  start: { dateTime?: string; timeZone?: string };
  end: { dateTime?: string; timeZone?: string };
  categories?: string[];
}

// ── iCal / CalDAV types ───────────────────────────────────────────────────────

interface ICalEvent {
  id: string;
  summary?: string;
  transp?: string;   // "TRANSPARENT" | "OPAQUE"
  status?: string;   // "CONFIRMED" | "TENTATIVE" | "CANCELLED"
  start: string;
  end: string;
  allDay: boolean;
  attendeeSelfStatus?: string;
  calendarName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Keyword patterns that indicate a birthday calendar by name */
function isBirthdayCalendarName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("birthday") || n.includes("anniversar");
}

/** Keyword patterns that indicate a public holidays calendar */
function isHolidayCalendarName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("holiday") || n.includes("public holiday") || n.includes("national holiday");
}

/** Titles that should always block (company-defined absence types) */
const BLOCKING_TITLE_KEYWORDS = [
  "vacation", "pto", "out of office", "ooo", "leave", "sick day", "sick leave",
  "annual leave", "personal day", "time off", "holiday", "parental leave",
];

function titleIndicatesBlocking(title: string): boolean {
  const t = title.toLowerCase();
  return BLOCKING_TITLE_KEYWORDS.some((kw) => t.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Token refresh
// ─────────────────────────────────────────────────────────────────────────────

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
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
    console.error("[calendar-sync] Google token refresh HTTP error:", res.status);
    return null;
  }
  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (data.error || !data.access_token) {
    console.error("[calendar-sync] Google token refresh error:", data.error);
    return null;
  }
  return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
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
      scope: "offline_access Calendars.Read User.Read",
    }),
  });

  if (!res.ok) {
    console.error("[calendar-sync] Outlook token refresh HTTP error:", res.status);
    return null;
  }
  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (data.error || !data.access_token) {
    console.error("[calendar-sync] Outlook token refresh error:", data.error);
    return null;
  }
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in ?? 3600 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar sync
// ─────────────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncGoogle(supabase: any, cal: ConnectedCalendar): Promise<{ synced: number; error?: string }> {
  let accessToken = cal.access_token;

  const needsRefresh = !accessToken ||
    !cal.token_expires_at ||
    new Date(cal.token_expires_at).getTime() <= Date.now() + 60_000;

  if (needsRefresh) {
    if (!cal.refresh_token) {
      return { synced: 0, error: "No refresh token — please reconnect Google Calendar." };
    }
    const refreshed = await refreshGoogleToken(cal.refresh_token);
    if (!refreshed) {
      return { synced: 0, error: "Token refresh failed — please reconnect Google Calendar." };
    }
    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase.from("connected_calendars").update({ access_token: accessToken, token_expires_at: newExpiry }).eq("id", cal.id);
  }

  if (!accessToken) return { synced: 0, error: "No access token available." };

  const now = new Date();
  const timeMin = new Date(now); timeMin.setMonth(timeMin.getMonth() - 1);
  const timeMax = new Date(now); timeMax.setMonth(timeMax.getMonth() + 3);

  // Fetch all user's calendar list to identify birthday/holiday calendars
  let birthdayCalIds = new Set<string>();
  let holidayCalIds = new Set<string>();
  try {
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (calListRes.ok) {
      const calList = await calListRes.json() as { items?: Array<{ id: string; summary?: string; description?: string }> };
      for (const c of calList.items ?? []) {
        const name = (c.summary ?? "") + " " + (c.description ?? "");
        if (isBirthdayCalendarName(name) || c.id.includes("contacts#contacts@group")) birthdayCalIds.add(c.id);
        if (isHolidayCalendarName(name) || c.id.includes("#holiday@group")) holidayCalIds.add(c.id);
      }
    }
  } catch (_) { /* non-fatal */ }

  // Fetch from primary calendar
  // (To also fetch other calendars, calendarList would need to be iterated — this covers the primary case)
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const txt = await res.text();
    return { synced: 0, error: `Google API ${res.status}: ${txt.slice(0, 200)}` };
  }

  const data = await res.json() as { items?: GoogleEvent[]; error?: unknown };
  if (data.error) return { synced: 0, error: "Google Calendar API error" };

  const events = (data.items ?? []).filter((e) => e.status !== "cancelled");

  // Build rows with conflict-aware metadata
  const rows = events.map((e) => {
    // transparency: "transparent" = free, "opaque" (default) = busy
    const transparency = e.transparency ?? "opaque";
    // show_status: derive from status field + transparency
    let showStatus: string;
    if (e.status === "tentative") {
      showStatus = "tentative";
    } else if (transparency === "transparent") {
      showStatus = "free";
    } else {
      showStatus = "busy";
    }

    // attendee self response
    const selfAttendee = e.attendees?.find((a) => a.self);
    const attendeeSelfStatus = selfAttendee?.responseStatus ?? null;

    const isBirthdayCal = birthdayCalIds.size > 0 && false; // primary calendar, not a birthday calendar
    // Check event title for birthday patterns as a fallback
    const title = e.summary ?? "Busy";
    const isHolidayCal = false; // primary is not the holidays calendar

    return {
      calendar_id: cal.id,
      host_id: cal.host_id,
      provider_event_id: e.id,
      title,
      start_at: e.start.dateTime ?? e.start.date ?? now.toISOString(),
      end_at: e.end.dateTime ?? e.end.date ?? now.toISOString(),
      all_day: !e.start.dateTime,
      recurrence_rule: e.recurrence?.[0] ?? null,
      raw_json: e,
      show_status: showStatus,
      transparency,
      attendee_self_status: attendeeSelfStatus,
      is_birthday_cal: isBirthdayCal,
      is_holiday_cal: isHolidayCal,
    };
  });

  let totalStored = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { error, count } = await supabase
      .from("calendar_events")
      .upsert(rows.slice(i, i + 100), { onConflict: "calendar_id,provider_event_id", count: "exact" });
    if (error) return { synced: totalStored, error: error.message };
    totalStored += count ?? rows.slice(i, i + 100).length;
  }

  // Also sync additional calendars (birthday, holiday) separately
  try {
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (calListRes.ok) {
      const calList = await calListRes.json() as { items?: Array<{ id: string; summary?: string; accessRole?: string }> };
      for (const c of calList.items ?? []) {
        // Only sync secondary calendars that are birthday or holiday types
        if (c.id === "primary") continue;
        const isBday = isBirthdayCalendarName(c.summary ?? "") || c.id.includes("contacts#contacts@group");
        const isHday = isHolidayCalendarName(c.summary ?? "") || c.id.includes("#holiday@group");
        if (!isBday && !isHday) continue;

        const secRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!secRes.ok) continue;
        const secData = await secRes.json() as { items?: GoogleEvent[] };
        const secRows = (secData.items ?? [])
          .filter((e) => e.status !== "cancelled")
          .map((e) => ({
            calendar_id: cal.id,
            host_id: cal.host_id,
            provider_event_id: `${c.id}::${e.id}`,
            title: e.summary ?? "Busy",
            start_at: e.start.dateTime ?? e.start.date ?? now.toISOString(),
            end_at: e.end.dateTime ?? e.end.date ?? now.toISOString(),
            all_day: !e.start.dateTime,
            recurrence_rule: e.recurrence?.[0] ?? null,
            raw_json: e,
            show_status: (e.transparency === "transparent") ? "free" : (e.status === "tentative" ? "tentative" : "busy"),
            transparency: e.transparency ?? "opaque",
            attendee_self_status: e.attendees?.find((a) => a.self)?.responseStatus ?? null,
            is_birthday_cal: isBday,
            is_holiday_cal: isHday,
          }));
        if (secRows.length > 0) {
          await supabase.from("calendar_events").upsert(secRows, { onConflict: "calendar_id,provider_event_id" });
          totalStored += secRows.length;
        }
      }
    }
  } catch (_) { /* non-fatal — secondary calendar sync is best-effort */ }

  await supabase.from("connected_calendars").update({ last_synced_at: new Date().toISOString() }).eq("id", cal.id);
  console.log("[calendar-sync] Stored", totalStored, "Google events for calendar:", cal.id);
  return { synced: totalStored };
}

// ─────────────────────────────────────────────────────────────────────────────
// Outlook / Microsoft Graph sync
// ─────────────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncOutlook(supabase: any, cal: ConnectedCalendar): Promise<{ synced: number; error?: string }> {
  let accessToken = cal.access_token;

  const needsRefresh = !accessToken ||
    !cal.token_expires_at ||
    new Date(cal.token_expires_at).getTime() <= Date.now() + 60_000;

  if (needsRefresh) {
    if (!cal.refresh_token) {
      return { synced: 0, error: "No refresh token — please reconnect Outlook Calendar." };
    }
    const refreshed = await refreshOutlookToken(cal.refresh_token);
    if (!refreshed) {
      return { synced: 0, error: "Token refresh failed — please reconnect Outlook Calendar." };
    }
    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const updatePayload: Record<string, string> = { access_token: accessToken, token_expires_at: newExpiry };
    if (refreshed.refresh_token) updatePayload.refresh_token = refreshed.refresh_token;
    await supabase.from("connected_calendars").update(updatePayload).eq("id", cal.id);
  }

  if (!accessToken) return { synced: 0, error: "No access token available." };

  const now = new Date();
  const startDateTime = new Date(now); startDateTime.setMonth(startDateTime.getMonth() - 1);
  const endDateTime = new Date(now); endDateTime.setMonth(endDateTime.getMonth() + 3);

  // Request showAs and responseStatus in addition to base fields
  const params = new URLSearchParams({
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString(),
    $top: "500",
    $select: "id,subject,isAllDay,isCancelled,start,end,showAs,responseStatus,categories",
    $orderby: "start/dateTime",
  });

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' } }
  );

  if (!res.ok) {
    const txt = await res.text();
    return { synced: 0, error: `Graph API ${res.status}: ${txt.slice(0, 200)}` };
  }

  const data = await res.json() as { value?: GraphEvent[]; error?: unknown };
  if (data.error) return { synced: 0, error: "Microsoft Graph API error" };

  const events = (data.value ?? []).filter((e) => !e.isCancelled);

  const rows = events.map((e) => {
    // showAs: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown"
    const showAs = (e.showAs ?? "busy").toLowerCase();
    // Normalize to our show_status
    let showStatus: string;
    if (showAs === "free") showStatus = "free";
    else if (showAs === "tentative") showStatus = "tentative";
    else if (showAs === "oof") showStatus = "oof";
    else showStatus = "busy"; // busy, workingElsewhere, unknown → treat as busy

    // transparency: opaque when blocking, transparent when free
    const transparency = showAs === "free" ? "transparent" : "opaque";

    // Self RSVP status from responseStatus
    const rsvp = e.responseStatus?.response?.toLowerCase() ?? null;
    const attendeeSelfStatus = rsvp === "none" ? null : rsvp;

    // Birthday detection: Outlook "People's birthdays" calendar shows events with category
    const categories = e.categories ?? [];
    const isBirthdayCal = categories.some((c) =>
      c.toLowerCase().includes("birthday") || c.toLowerCase().includes("anniversar")
    );
    const isHolidayCal = categories.some((c) =>
      c.toLowerCase().includes("holiday")
    );

    const title = e.subject ?? "Busy";

    return {
      calendar_id: cal.id,
      host_id: cal.host_id,
      provider_event_id: e.id,
      title,
      start_at: e.start.dateTime ? new Date(e.start.dateTime).toISOString() : now.toISOString(),
      end_at: e.end.dateTime ? new Date(e.end.dateTime).toISOString() : now.toISOString(),
      all_day: e.isAllDay ?? false,
      recurrence_rule: null,
      raw_json: e,
      show_status: showStatus,
      transparency,
      attendee_self_status: attendeeSelfStatus,
      is_birthday_cal: isBirthdayCal,
      is_holiday_cal: isHolidayCal,
    };
  });

  let totalStored = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { error, count } = await supabase
      .from("calendar_events")
      .upsert(rows.slice(i, i + 100), { onConflict: "calendar_id,provider_event_id", count: "exact" });
    if (error) return { synced: totalStored, error: error.message };
    totalStored += count ?? rows.slice(i, i + 100).length;
  }

  await supabase.from("connected_calendars").update({ last_synced_at: new Date().toISOString() }).eq("id", cal.id);
  console.log("[calendar-sync] Stored", totalStored, "Outlook events for calendar:", cal.id);
  return { synced: totalStored };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP handler
// ─────────────────────────────────────────────────────────────────────────────

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: calendars, error: fetchErr } = await supabase
      .from("connected_calendars")
      .select("id,host_id,provider,access_token,refresh_token,token_expires_at,sync_enabled")
      .eq("host_id", user.id)
      .eq("sync_enabled", true);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { synced: number; error?: string }> = {};

    for (const cal of (calendars ?? []) as ConnectedCalendar[]) {
      if (cal.provider === "google") {
        results[cal.id] = await syncGoogle(supabase, cal);
      } else if (cal.provider === "outlook") {
        results[cal.id] = await syncOutlook(supabase, cal);
      } else {
        // apple/ical: events are parsed client-side via iCal feeds
        results[cal.id] = { synced: 0 };
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = (err as Error).message ?? "Unknown error";
    console.error("[calendar-sync] Unhandled exception:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
