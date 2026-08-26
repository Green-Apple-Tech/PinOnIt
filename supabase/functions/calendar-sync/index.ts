import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureCalendarAccessToken } from "../_shared/calendar-tokens.ts";

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
  calendar_id?: string | null;
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
// Google Calendar sync
// ─────────────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncGoogle(supabase: any, cal: ConnectedCalendar): Promise<{ synced: number; error?: string }> {
  const accessToken = await ensureCalendarAccessToken(supabase, cal);
  if (!accessToken) {
    return {
      synced: 0,
      error: cal.refresh_token
        ? "Token refresh failed — please reconnect Google Calendar."
        : "No refresh token — please reconnect Google Calendar.",
    };
  }

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
  const accessToken = await ensureCalendarAccessToken(supabase, cal);
  if (!accessToken) {
    return {
      synced: 0,
      error: cal.refresh_token
        ? "Token refresh failed — please reconnect Outlook Calendar."
        : "No refresh token — please reconnect Outlook Calendar.",
    };
  }

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
// iCal / Apple public feed sync
// ─────────────────────────────────────────────────────────────────────────────

function unfoldIcs(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function icsUnescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(rawValue: string, params: string): { iso: string; allDay: boolean } {
  const value = rawValue.trim();
  const isDate = /VALUE=DATE/i.test(params) || /^\d{8}$/.test(value);
  if (isDate) {
    const y = value.slice(0, 4);
    const mo = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { iso: `${y}-${mo}-${d}T00:00:00.000Z`, allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { iso: new Date().toISOString(), allDay: false };
  const [, ys, mos, ds, hs, mis, ss, z] = m;
  if (z === "Z") {
    return {
      iso: new Date(Date.UTC(+ys, +mos - 1, +ds, +hs, +mis, +ss)).toISOString(),
      allDay: false,
    };
  }
  const tz = params.match(/TZID=([^;:]+)/i)?.[1]?.replace(/^"|"$/g, "") || "UTC";
  try {
    const dt = Temporal.ZonedDateTime.from({
      year: +ys,
      month: +mos,
      day: +ds,
      hour: +hs,
      minute: +mis,
      second: +ss,
      timeZone: tz,
    });
    return { iso: dt.toInstant().toString(), allDay: false };
  } catch {
    return {
      iso: new Date(+ys, +mos - 1, +ds, +hs, +mis, +ss).toISOString(),
      allDay: false,
    };
  }
}

function parseDurationMs(raw: string): number {
  const m = raw.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
  if (!m) return 60 * 60 * 1000;
  const days = +(m[1] || 0);
  const hours = +(m[2] || 0);
  const mins = +(m[3] || 0);
  const secs = +(m[4] || 0);
  return (((days * 24 + hours) * 60 + mins) * 60 + secs) * 1000;
}

function expandOccurrences(
  start: Date,
  end: Date,
  rrule: string | null,
  windowStart: Date,
  windowEnd: Date,
): Array<{ start: Date; end: Date }> {
  const duration = end.getTime() - start.getTime();
  if (!rrule) {
    if (end < windowStart || start > windowEnd) return [];
    return [{ start, end }];
  }
  const parts = Object.fromEntries(
    rrule.replace(/^RRULE:/i, "").split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k.toUpperCase(), v];
    }),
  );
  const freq = (parts.FREQ || "").toUpperCase();
  const interval = Math.max(1, +(parts.INTERVAL || 1));
  const until = parts.UNTIL ? parseIcsDate(parts.UNTIL, "").iso : null;
  const untilDate = until ? new Date(until) : windowEnd;
  const count = parts.COUNT ? Math.min(+(parts.COUNT), 200) : 200;
  let stepMs = 7 * 24 * 60 * 60 * 1000;
  if (freq === "DAILY") stepMs = 24 * 60 * 60 * 1000;
  else if (freq === "WEEKLY") stepMs = 7 * 24 * 60 * 60 * 1000;
  else if (freq === "MONTHLY") {
    const out: Array<{ start: Date; end: Date }> = [];
    const cursor = new Date(start);
    for (let i = 0; i < count && cursor <= untilDate && cursor <= windowEnd; i++) {
      const s = new Date(cursor);
      const e = new Date(s.getTime() + duration);
      if (e >= windowStart && s <= windowEnd) out.push({ start: s, end: e });
      cursor.setMonth(cursor.getMonth() + interval);
    }
    return out;
  } else {
    if (end < windowStart || start > windowEnd) return [];
    return [{ start, end }];
  }
  const out: Array<{ start: Date; end: Date }> = [];
  const cursor = new Date(start);
  for (let i = 0; i < count && cursor <= untilDate && cursor <= windowEnd; i++) {
    const s = new Date(cursor);
    const e = new Date(s.getTime() + duration);
    if (e >= windowStart && s <= windowEnd) out.push({ start: s, end: e });
    cursor.setTime(cursor.getTime() + stepMs * interval);
  }
  return out;
}

function parseIcsEvents(
  ics: string,
  windowStart: Date,
  windowEnd: Date,
): Array<{
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  showStatus: string;
  transparency: string;
}> {
  const unfolded = unfoldIcs(ics);
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1);
  const events: Array<{
    uid: string;
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    showStatus: string;
    transparency: string;
  }> = [];

  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0];
    const props: Record<string, { params: string; value: string }> = {};
    for (const line of body.split(/\r?\n/)) {
      if (!line.includes(":")) continue;
      const colon = line.indexOf(":");
      const left = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const [name, ...paramParts] = left.split(";");
      props[name.toUpperCase()] = { params: paramParts.join(";"), value };
    }
    if ((props.STATUS?.value || "").toUpperCase() === "CANCELLED") continue;
    if (!props.DTSTART) continue;
    const startParsed = parseIcsDate(props.DTSTART.value, props.DTSTART.params);
    let endParsed = props.DTEND
      ? parseIcsDate(props.DTEND.value, props.DTEND.params)
      : null;
    if (!endParsed && props.DURATION) {
      const start = new Date(startParsed.iso);
      endParsed = {
        iso: new Date(start.getTime() + parseDurationMs(props.DURATION.value)).toISOString(),
        allDay: startParsed.allDay,
      };
    }
    if (!endParsed) {
      const start = new Date(startParsed.iso);
      endParsed = {
        iso: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        allDay: startParsed.allDay,
      };
    }
    const transp = (props.TRANSP?.value || "OPAQUE").toUpperCase();
    const status = (props.STATUS?.value || "CONFIRMED").toUpperCase();
    const showStatus = transp === "TRANSPARENT" ? "free" : status === "TENTATIVE" ? "tentative" : "busy";
    const uid = (props.UID?.value || `${startParsed.iso}-${props.SUMMARY?.value || "busy"}`).trim();
    const title = icsUnescape(props.SUMMARY?.value || "Busy");
    const rrule = props.RRULE?.value || null;
    const occurrences = expandOccurrences(
      new Date(startParsed.iso),
      new Date(endParsed.iso),
      rrule,
      windowStart,
      windowEnd,
    );
    occurrences.forEach((occ, idx) => {
      events.push({
        uid: rrule ? `${uid}::${idx}` : uid,
        title,
        start: occ.start,
        end: occ.end,
        allDay: startParsed.allDay,
        showStatus,
        transparency: transp === "TRANSPARENT" ? "transparent" : "opaque",
      });
    });
  }
  return events;
}

// deno-lint-ignore no-explicit-any
async function syncIcal(supabase: any, cal: ConnectedCalendar): Promise<{ synced: number; error?: string }> {
  const rawUrl = (cal.calendar_id || "").trim();
  if (!rawUrl) {
    return {
      synced: 0,
      error: "No calendar link saved. Paste the private iPhone calendar link, then tap Sync.",
    };
  }
  const url = rawUrl.replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\//i.test(url)) {
    return { synced: 0, error: "Calendar link must start with https:// or webcal://" };
  }

  let text = "";
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/calendar, text/plain, */*",
        "User-Agent": "PinOnIt/1.0 (calendar sync)",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return { synced: 0, error: `Could not read that calendar link (${res.status}). Check the URL and that the calendar is shared.` };
    }
    text = await res.text();
  } catch (e) {
    return { synced: 0, error: `Could not open that calendar link: ${(e as Error).message}` };
  }

  if (text.length > 2_000_000) text = text.slice(0, 2_000_000);
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    return { synced: 0, error: "That link is not a calendar file. On iPhone: Calendar → the calendar → Share Calendar → copy the private link." };
  }

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - 1);
  const windowEnd = new Date(now);
  windowEnd.setMonth(windowEnd.getMonth() + 3);
  const parsed = parseIcsEvents(text, windowStart, windowEnd);

  await supabase.from("calendar_events").delete().eq("calendar_id", cal.id);

  const rows = parsed.map((e) => ({
    calendar_id: cal.id,
    host_id: cal.host_id,
    provider_event_id: e.uid.slice(0, 500),
    title: e.title.slice(0, 500),
    start_at: e.start.toISOString(),
    end_at: e.end.toISOString(),
    all_day: e.allDay,
    recurrence_rule: null,
    raw_json: { source: "ical", uid: e.uid },
    show_status: e.showStatus,
    transparency: e.transparency,
    attendee_self_status: null,
    is_birthday_cal: isBirthdayCalendarName(e.title) || isBirthdayCalendarName(cal.provider),
    is_holiday_cal: isHolidayCalendarName(e.title),
  }));

  let totalStored = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { error, count } = await supabase
      .from("calendar_events")
      .upsert(rows.slice(i, i + 100), { onConflict: "calendar_id,provider_event_id", count: "exact" });
    if (error) return { synced: totalStored, error: error.message };
    totalStored += count ?? rows.slice(i, i + 100).length;
  }

  await supabase.from("connected_calendars").update({ last_synced_at: new Date().toISOString() }).eq("id", cal.id);
  console.log("[calendar-sync] Stored", totalStored, "iCal events for calendar:", cal.id);
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
      .select("id,host_id,provider,access_token,refresh_token,token_expires_at,sync_enabled,calendar_id")
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
      } else if (cal.provider === "ical" || cal.provider === "apple") {
        results[cal.id] = await syncIcal(supabase, cal);
      } else {
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
