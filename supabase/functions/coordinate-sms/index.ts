import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { appendSmsOptOut } from "../_shared/sms-opt-out.ts";
import { smsIsOptedOut } from "../_shared/sms-send-gate.ts";
import { normalizePhoneE164 } from "../_shared/phone.ts";
import { hostIdFromJwt, jsonAuthError } from "../_shared/callerAuth.ts";
import { expireStaleTrials, hostPlanIsActive } from "../_shared/hostPlan.ts";
import { buildCoordinationIcs } from "../_shared/ics.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedSlot {
  date: string;
  start_time: string;
  end_time: string;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendTwilioMessage(
  to: string,
  from: string,
  body: string,
  mediaUrl?: string,
): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!accountSid || !authToken) {
    console.error("Twilio credentials not configured");
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  if (mediaUrl) params.set("MediaUrl", mediaUrl);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
    },
    body: params.toString(),
  });

  if (!res.ok) {
    console.error("Twilio send failed:", await res.text());
    return false;
  }
  return true;
}

/** Sends via WhatsApp when configured, otherwise SMS. */
async function sendMessage(to: string, body: string, mediaUrl?: string): Promise<void> {
  if (await smsIsOptedOut(supabase, to)) {
    console.warn("Skipping coordinate SMS — recipient opted out (STOP):", to);
    return;
  }

  const smsFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
  const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
  const e164 = normalizePhoneE164(to);

  if (whatsappFrom) {
    const waFrom = whatsappFrom.startsWith("whatsapp:")
      ? whatsappFrom
      : `whatsapp:${whatsappFrom}`;
    const sent = await sendTwilioMessage(`whatsapp:${e164}`, waFrom, body, mediaUrl);
    if (sent) return;
    if (mediaUrl) {
      const retry = await sendTwilioMessage(`whatsapp:${e164}`, waFrom, body);
      if (retry) return;
    }
  }

  if (!smsFrom) {
    console.error("Twilio SMS from-number not configured");
    return;
  }

  const smsOk = await sendTwilioMessage(e164, smsFrom, body, mediaUrl);
  if (smsOk || !mediaUrl) return;
  await sendTwilioMessage(e164, smsFrom, body);
}

async function sendSms(to: string, body: string, mediaUrl?: string): Promise<void> {
  await sendMessage(to, appendSmsOptOut(body), mediaUrl);
}

function publicSiteUrl() {
  return (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "https://pinonit.com").replace(/\/$/, "");
}

function coordinationContextLabel(type: unknown): string {
  if (type === "showing") return "Showing";
  if (type === "consultation") return "Consultation";
  return "Meeting";
}

function formatSlotLabel(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const startT = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endT = end ? end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  return endT ? `${day} ${startT}–${endT}` : `${day} ${startT}`;
}

function parseBareSlotNumber(body: string): number | null {
  const m = body.trim().match(/^([1-9]\d?)$/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function slotFromNumber<T extends { sort_order: number }>(slots: T[], n: number | null): T | null {
  if (n == null || n < 1) return null;
  return slots.find((s) => s.sort_order + 1 === n) ?? slots[n - 1] ?? null;
}

function icsPublicUrl(token: string) {
  const fn = `${Deno.env.get("SUPABASE_URL")}/functions/v1/coordinate-sms?ics=1&token=${encodeURIComponent(token)}`;
  return fn;
}

async function loadProposedSlots(meetingId: string) {
  const { data } = await supabase
    .from("coordinated_meeting_slots")
    .select("id, start_time, end_time, sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true })
    .order("start_time", { ascending: true });
  return data ?? [];
}

function buildNumberedInviteSms(opts: {
  participantName: string;
  hostName: string;
  title: string;
  contextType: string;
  location: string | null;
  slots: { start_time: string; end_time: string }[];
  token: string;
}): string {
  const kind = coordinationContextLabel(opts.contextType).toLowerCase();
  const title = opts.title.trim() || coordinationContextLabel(opts.contextType);
  const loc = opts.location?.trim() ? `\nWhere: ${opts.location.trim()}` : "";
  const lines = opts.slots.map((s, i) => `${i + 1}) ${formatSlotLabel(s.start_time, s.end_time)}`);
  const nHint = opts.slots.length <= 1 ? "1" : `1–${opts.slots.length}`;
  const link = `${publicSiteUrl()}/c/${opts.token}`;
  return `Hi ${opts.participantName}! ${opts.hostName} wants to set a ${kind}: ${title}.${loc}\nPick a time (reply with just the number, or tap the link):\n${lines.join("\n")}\nReply ${nHint}: ${link}`;
}

function numberedClarifySms(token: string, slotCount: number) {
  const nHint = slotCount <= 1 ? "1" : Array.from({ length: slotCount }, (_, i) => String(i + 1)).join(", ");
  const link = `${publicSiteUrl()}/c/${token}`;
  return `Reply with just the number (${nHint}) — or tap the link: ${link}`;
}

async function parseAvailability(
  response: string,
  timeframe: { start: string; end: string }
): Promise<ParsedSlot[]> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${supabaseUrl}/functions/v1/parse-availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ response, timeframe }),
    });
    const data = await res.json();
    return data.slots ?? [];
  } catch {
    return [];
  }
}

function slotsToMinuteBuckets(slots: ParsedSlot[]): Set<string> {
  const buckets = new Set<string>();
  for (const slot of slots) {
    const [sh, sm] = slot.start_time.split(":").map(Number);
    const [eh, em] = slot.end_time.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur < end) {
      buckets.add(`${slot.date}T${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
      cur += 15;
    }
  }
  return buckets;
}

function formatTimeLabel(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const min = parseInt(mStr || "0", 10);
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (min === 0) return `${hour12}${suffix}`;
  return `${hour12}:${String(min).padStart(2, "0")}${suffix}`;
}

function fmtDayHeader(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type CoordSimpleTimeframe =
  | "next_3_days"
  | "this_week"
  | "next_2_weeks"
  | "next_month"
  | "custom";
type TimeOfDayKey = "morning" | "midday" | "afternoon" | "any";

const SIMPLE_TIMEFRAME_SMS: Record<CoordSimpleTimeframe, string> = {
  next_3_days: "the next 3 days",
  this_week: "this week",
  next_2_weeks: "the next 2 weeks",
  next_month: "the next month",
  custom: "the selected dates",
};

const TIME_OF_DAY_SMS: Record<TimeOfDayKey, string> = {
  morning: "mornings",
  midday: "mid-day",
  afternoon: "afternoons",
  any: "any time of day",
};

function formatDurationForSms(minutes: number): string {
  if (minutes < 60) return `${minutes}-minute`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return h === 1 ? "1-hour" : `${h}-hour`;
  return `${h}h ${m}m`;
}

function formatTimeOfDayPhrase(keys: TimeOfDayKey[]): string {
  if (!keys.length || keys.includes("any")) return TIME_OF_DAY_SMS.any;
  const parts = keys.map((k) => TIME_OF_DAY_SMS[k]);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function formatCustomRangeSms(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return `between ${fmt(start)} and ${fmt(end)}`;
}

function buildCoordInviteSms(
  participantName: string,
  hostName: string,
  meeting: {
    title: string;
    duration_minutes: number;
    location: string | null;
  },
  preferredTimes: Record<string, unknown> | null,
  selectedDates: string[] | null,
): string {
  const dur = formatDurationForSms(meeting.duration_minutes);
  const titleClause = meeting.title.trim()
    ? ` ("${meeting.title.trim()}")`
    : "";
  const locationClause = meeting.location
    ? ` Location: ${meeting.location}.`
    : "";

  const selectedSlots = preferredTimes?.selectedSlots as
    | Record<string, string[]>
    | undefined;
  const hasAdvancedSlots =
    selectedSlots &&
    Object.values(selectedSlots).some((t) => (t?.length ?? 0) > 0);

  if (hasAdvancedSlots) {
    const slotsStr = formatSlotsForSms(preferredTimes, selectedDates);
    let msg =
      `Hi ${participantName}! ${hostName} is looking for a ${dur} meeting${titleClause}`;
    if (slotsStr) msg += ` during these times: ${slotsStr}`;
    msg += ". Reply with times that work for you.";
    return msg + locationClause;
  }

  const simpleTf = preferredTimes?.simpleTimeframe as
    | CoordSimpleTimeframe
    | undefined;
  const todKeys = (preferredTimes?.timeOfDayPreferences as TimeOfDayKey[]) ??
    ["any"];
  const customStart = preferredTimes?.customRangeStart as string | undefined;
  const customEnd = preferredTimes?.customRangeEnd as string | undefined;

  let tf = "in the coming days";
  if (simpleTf === "custom" && customStart && customEnd) {
    tf = formatCustomRangeSms(customStart, customEnd);
  } else if (simpleTf && SIMPLE_TIMEFRAME_SMS[simpleTf]) {
    tf = SIMPLE_TIMEFRAME_SMS[simpleTf];
  }

  const tod = formatTimeOfDayPhrase(todKeys);
  let msg =
    `Hi ${participantName}! ${hostName} is looking for a ${dur} meeting within ${tf}${titleClause} — ${tod}. Reply with times that work for you.`;
  return msg + locationClause;
}

function formatSlotsForSms(
  preferredTimes: unknown,
  selectedDates: string[] | null,
): string {
  if (!preferredTimes || typeof preferredTimes !== "object") return "";
  const pt = preferredTimes as Record<string, unknown>;
  const selectedSlots = pt.selectedSlots as Record<string, string[]> | undefined;
  if (!selectedSlots) return "";
  const dates = selectedDates?.length
    ? [...selectedDates].sort()
    : Object.keys(selectedSlots).sort();
  const parts = dates
    .map((d) => {
      const times = selectedSlots[d] ?? [];
      if (!times.length) return null;
      return `${fmtDayHeader(d)}: ${times.map(formatTimeLabel).join(", ")}`;
    })
    .filter(Boolean);
  return parts.join("; ");
}

/** 15-min buckets where the host is available (each selected start + duration). */
function hostSelectedSlotsToBuckets(
  preferredTimes: unknown,
  durationMinutes: number,
): Set<string> | null {
  if (!preferredTimes || typeof preferredTimes !== "object") return null;
  const pt = preferredTimes as Record<string, unknown>;
  const selectedSlots = pt.selectedSlots as Record<string, string[]> | undefined;
  if (!selectedSlots) return null;
  const dates = Object.keys(selectedSlots).filter((d) => (selectedSlots[d]?.length ?? 0) > 0);
  if (!dates.length) return null;

  const buckets = new Set<string>();
  const steps = Math.ceil(durationMinutes / 15);
  for (const date of dates) {
    for (const time of selectedSlots[date] ?? []) {
      const [h, m] = time.split(":").map(Number);
      let cur = h * 60 + m;
      for (let i = 0; i < steps; i++) {
        buckets.add(
          `${date}T${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`,
        );
        cur += 15;
      }
    }
  }
  return buckets.size ? buckets : null;
}

/** ISO start times for candidate slots (up to 5), sorted soonest first. */
function findOverlaps(
  participantSlots: ParsedSlot[][],
  durationMinutes: number,
  hostBuckets: Set<string> | null = null,
): string[] {
  if (participantSlots.length === 0) return [];

  const bucketSets = participantSlots.map(slotsToMinuteBuckets);
  const common = new Set<string>();
  for (const bucket of bucketSets[0]) {
    if (bucketSets.every((s) => s.has(bucket))) {
      if (!hostBuckets || hostBuckets.has(bucket)) {
        common.add(bucket);
      }
    }
  }

  const sorted = Array.from(common).sort();
  const windows: string[] = [];
  const needed = durationMinutes / 15;

  let streak: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (streak.length === 0) {
      streak.push(sorted[i]);
    } else {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const [pd, pt] = prev.split("T");
      const [cd, ct] = cur.split("T");
      const [ph, pm] = pt.split(":").map(Number);
      const [ch, cm] = ct.split(":").map(Number);
      const prevMin = ph * 60 + pm;
      const curMin = ch * 60 + cm;
      if (pd === cd && curMin - prevMin === 15) {
        streak.push(cur);
      } else {
        streak = [cur];
      }
    }
    if (streak.length >= needed) {
      const start = streak[streak.length - needed];
      const [date, time] = start.split("T");
      const [sh, sm] = time.split(":").map(Number);
      windows.push(
        `${date}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`,
      );
      if (windows.length >= 5) break;
    }
  }
  return windows;
}

function phonesMatch(a: string, b: string): boolean {
  const da = a.replace(/\D/g, "").slice(-10);
  const db = b.replace(/\D/g, "").slice(-10);
  return da.length >= 10 && da === db;
}

function formatSlotForHostSms(isoStart: string): { day: string; date: string; time: string } {
  const d = new Date(isoStart);
  return {
    day: d.toLocaleDateString("en-US", { weekday: "long" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function formatSlotForConfirmSms(isoStart: string, durationMinutes: number): string {
  const start = new Date(isoStart);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const startT = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endT = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} ${startT}–${endT}`;
}

function getPreferredTimesExtras(preferredTimes: unknown): Record<string, unknown> {
  if (!preferredTimes || typeof preferredTimes !== "object") return {};
  return preferredTimes as Record<string, unknown>;
}

function candidateSlotsFromPreferred(preferredTimes: unknown): string[] {
  const pt = getPreferredTimesExtras(preferredTimes);
  const raw = pt.candidateSlots;
  return Array.isArray(raw) ? (raw as string[]) : [];
}

function hostOptionIndexFromPreferred(preferredTimes: unknown): number {
  const pt = getPreferredTimesExtras(preferredTimes);
  return typeof pt.hostOptionIndex === "number" ? pt.hostOptionIndex : 0;
}

async function addCoordinatedEventToHostCalendar(
  hostId: string,
  meetingId: string,
  title: string,
  startIso: string,
  endIso: string,
): Promise<void> {
  const { data: cal } = await supabase
    .from("connected_calendars")
    .select("id")
    .eq("host_id", hostId)
    .eq("sync_enabled", true)
    .limit(1)
    .maybeSingle();

  if (!cal?.id) return;

  await supabase.from("calendar_events").insert({
    calendar_id: cal.id,
    host_id: hostId,
    provider_event_id: `coord-${meetingId}-${Date.now()}`,
    title,
    start_at: startIso,
    end_at: endIso,
    all_day: false,
    show_status: "busy",
    transparency: "opaque",
  });
}

async function notifyHostBestMatch(
  meeting: { id: string; title: string; duration_minutes: number; preferred_times: unknown },
  candidateSlots: string[],
  totalParticipants: number,
  hostPhone: string,
): Promise<void> {
  const idx = 0;
  const slot = candidateSlots[idx];
  const { day, date, time } = formatSlotForHostSms(slot);
  const pt = getPreferredTimesExtras(meeting.preferred_times);
  const merged = {
    ...pt,
    candidateSlots,
    hostOptionIndex: idx,
    awaitingHostConfirmation: true,
    noOverlap: false,
  };

  await supabase
    .from("coordinated_meetings")
    .update({
      status: "match_found",
      confirmed_time: null,
      preferred_times: merged,
    })
    .eq("id", meeting.id);

  await sendSms(
    hostPhone,
    `✅ Best match found for "${meeting.title}":\n${day} ${date} at ${time}\n(${totalParticipants} of ${totalParticipants} participants available)\nReply YES to confirm and notify everyone, or NO to see other options.`,
  );
}

async function notifyHostNoOverlap(
  meeting: { id: string; title: string; preferred_times: unknown },
  hostPhone: string,
): Promise<void> {
  const pt = getPreferredTimesExtras(meeting.preferred_times);
  await supabase
    .from("coordinated_meetings")
    .update({
      preferred_times: { ...pt, noOverlap: true, awaitingHostConfirmation: true },
    })
    .eq("id", meeting.id);

  await sendSms(
    hostPhone,
    `No overlap found for "${meeting.title}". Reply EXTEND to try next week, or visit pinonit.com to adjust.`,
  );
}

async function notifyHostNextOption(
  meeting: { id: string; title: string; duration_minutes: number; preferred_times: unknown },
  hostPhone: string,
  optionIndex: number,
  totalParticipants: number,
): Promise<void> {
  const candidates = candidateSlotsFromPreferred(meeting.preferred_times);
  const slot = candidates[optionIndex];
  if (!slot) {
    await sendSms(
      hostPhone,
      `No more options for "${meeting.title}". Visit pinonit.com to adjust or cancel.`,
    );
    return;
  }
  const { day, date, time } = formatSlotForHostSms(slot);
  const pt = getPreferredTimesExtras(meeting.preferred_times);
  await supabase
    .from("coordinated_meetings")
    .update({
      preferred_times: { ...pt, hostOptionIndex: optionIndex },
    })
    .eq("id", meeting.id);

  await sendSms(
    hostPhone,
    `Next best option:\n${day} ${date} at ${time}\n(${totalParticipants} of ${totalParticipants} available)\nReply YES to confirm or NO for more options.`,
  );
}

async function extendMeetingWindow(meetingId: string): Promise<void> {
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, proposed_window_end, preferred_times")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) return;

  const end = meeting.proposed_window_end
    ? new Date(meeting.proposed_window_end)
    : new Date();
  end.setDate(end.getDate() + 7);

  const pt = getPreferredTimesExtras(meeting.preferred_times);
  await supabase
    .from("coordinated_meetings")
    .update({
      status: "collecting_availability",
      proposed_window_end: end.toISOString(),
      confirmed_time: null,
      preferred_times: {
        ...pt,
        noOverlap: false,
        awaitingHostConfirmation: false,
        candidateSlots: [],
        hostOptionIndex: 0,
      },
    })
    .eq("id", meetingId);

  await supabase
    .from("coordinated_meeting_participants")
    .update({ availability_response: null, parsed_slots: null })
    .eq("meeting_id", meetingId)
    .eq("availability_pre_entered", false)
    .eq("opted_out", false);
}

async function findHostMeetingForPhone(
  phone: string,
): Promise<{ meeting: Record<string, unknown>; hostPhone: string } | null> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return null;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, phone")
    .not("phone", "is", null)
    .ilike("phone", `%${digits}`)
    .limit(8);

  const hostProfile = (profiles ?? []).find((p) =>
    p.phone && phonesMatch(p.phone as string, phone)
  );
  if (!hostProfile) return null;

  const { data: meetings } = await supabase
    .from("coordinated_meetings")
    .select("*")
    .eq("host_id", hostProfile.id)
    .in("status", ["match_found", "collecting_availability"])
    .order("updated_at", { ascending: false });

  const awaiting = (meetings ?? []).find((m) => {
    const pt = getPreferredTimesExtras(m.preferred_times);
    return pt.awaitingHostConfirmation === true;
  });

  if (!awaiting) return null;
  return { meeting: awaiting, hostPhone: hostProfile.phone as string };
}

async function processHostInbound(
  meeting: Record<string, unknown>,
  trimmedBody: string,
  hostPhone: string,
): Promise<Response> {
  const meetingId = meeting.id as string;
  const hostId = meeting.host_id as string;
  await expireStaleTrials(supabase);
  if (!(await hostPlanIsActive(supabase, hostId))) {
    await sendSms(
      hostPhone,
      "Your PinOnIt trial has ended. Reactivate at pinonit.com/billing to keep coordinating meetings.",
    );
    return new Response("OK", { status: 200 });
  }

  const title = meeting.title as string;
  const durationMinutes = meeting.duration_minutes as number;
  const preferredTimes = meeting.preferred_times;
  const pt = getPreferredTimesExtras(preferredTimes);

  const { data: participants } = await supabase
    .from("coordinated_meeting_participants")
    .select("id, availability_pre_entered")
    .eq("meeting_id", meetingId)
    .eq("opted_out", false);

  const totalParticipants = (participants ?? []).length;

  if (meeting.scheduling_mode === "proposed_slots") {
    const slots = await loadProposedSlots(meetingId);
    const n = parseBareSlotNumber(trimmedBody);
    const slot = slotFromNumber(slots, n);
    if (!slot) {
      const hint = slots.length <= 1
        ? "1"
        : Array.from({ length: slots.length }, (_, i) => String(i + 1)).join(", ");
      await sendSms(
        hostPhone,
        `Reply with the slot number (${hint}) to lock it, or pick in the dashboard.`,
      );
      return new Response("OK", { status: 200 });
    }
    const locked = await finalizeProposedSlotLock(meetingId, slot.id);
    await sendSms(
      hostPhone,
      locked.ok
        ? `Locked option ${n} for "${title}". Confirmations are on the way.`
        : `Could not lock that time. Try the dashboard.`,
    );
    return new Response("OK", { status: 200 });
  }

  if (/^EXTEND$/i.test(trimmedBody) && pt.noOverlap === true) {
    await extendMeetingWindow(meetingId);
    await sendSms(
      hostPhone,
      `Extended the window for "${title}" by one week. We'll text participants to share new availability.`,
    );
    await sendCoordinationInvites(meetingId).catch(() => {});
    return new Response("OK", { status: 200 });
  }

  if (meeting.status !== "match_found") {
    return new Response("OK", { status: 200 });
  }

  const candidates = candidateSlotsFromPreferred(preferredTimes);
  const optionIndex = hostOptionIndexFromPreferred(preferredTimes);

  if (/^YES$/i.test(trimmedBody)) {
    const slotIso = candidates[optionIndex];
    if (!slotIso) {
      await sendSms(hostPhone, `No time slot selected. Visit pinonit.com to confirm "${title}".`);
      return new Response("OK", { status: 200 });
    }
    await finalizeHostConfirmation(meetingId, slotIso);
    return new Response("OK", { status: 200 });
  }

  if (/^NO$/i.test(trimmedBody)) {
    const nextIndex = optionIndex + 1;
    if (nextIndex >= candidates.length) {
      await sendSms(
        hostPhone,
        `No more options for "${title}". Visit pinonit.com to adjust or cancel.`,
      );
      return new Response("OK", { status: 200 });
    }
    await notifyHostNextOption(
      { id: meetingId, title, duration_minutes: durationMinutes, preferred_times: preferredTimes },
      hostPhone,
      nextIndex,
      totalParticipants,
    );
    return new Response("OK", { status: 200 });
  }

  return new Response("OK", { status: 200 });
}

async function finalizeHostConfirmation(
  meetingId: string,
  slotIso: string,
): Promise<void> {
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, host_id, title, duration_minutes, location, preferred_times")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) return;

  const start = new Date(slotIso);
  const end = new Date(start.getTime() + meeting.duration_minutes * 60_000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const timeLabel = formatSlotForConfirmSms(slotIso, meeting.duration_minutes);

  await supabase
    .from("coordinated_meetings")
    .update({
      status: "confirmed",
      confirmed_time: startIso,
      preferred_times: {
        ...getPreferredTimesExtras(meeting.preferred_times),
        awaitingHostConfirmation: false,
      },
    })
    .eq("id", meetingId);

  await supabase
    .from("coordinated_meeting_participants")
    .update({ confirmed: true })
    .eq("meeting_id", meetingId)
    .eq("opted_out", false);

  const { data: participants } = await supabase
    .from("coordinated_meeting_participants")
    .select("name, phone")
    .eq("meeting_id", meetingId)
    .eq("opted_out", false);

  const locationStr = meeting.location ? ` at ${meeting.location}` : "";
  if (participants) {
    await Promise.all(
      participants.map((p) =>
        sendSms(
          p.phone,
          `Hi ${p.name}! "${meeting.title}" is confirmed for ${timeLabel}${locationStr} (${meeting.duration_minutes} min). See you then!`,
        )
      ),
    );
  }

  await addCoordinatedEventToHostCalendar(
    meeting.host_id,
    meetingId,
    meeting.title,
    startIso,
    endIso,
  );
}

async function checkAndRunOverlap(meetingId: string): Promise<void> {
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, duration_minutes, proposed_window_start, proposed_window_end, status, host_id, title, preferred_times, selected_dates")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting || meeting.status !== "collecting_availability") return;

  const pt = getPreferredTimesExtras(meeting.preferred_times);
  if (pt.awaitingHostConfirmation === true) return;

  const { data: allParticipants } = await supabase
    .from("coordinated_meeting_participants")
    .select("id, phone, parsed_slots, opted_out, availability_response, availability_pre_entered")
    .eq("meeting_id", meetingId);

  const active = (allParticipants ?? []).filter((p) => !p.opted_out);
  const ready = active.filter((p) => p.availability_response !== null);

  if (ready.length < active.length) return;

  const allSlots = ready.map((p) => (p.parsed_slots as ParsedSlot[]) ?? []);
  const hostBuckets = hostSelectedSlotsToBuckets(meeting.preferred_times, meeting.duration_minutes);
  const overlaps = findOverlaps(allSlots, meeting.duration_minutes, hostBuckets);

  const { data: hostProfile } = await supabase
    .from("profiles")
    .select("phone, full_name")
    .eq("id", meeting.host_id)
    .maybeSingle();

  if (!hostProfile?.phone) return;

  if (overlaps.length === 0) {
    await notifyHostNoOverlap(meeting, hostProfile.phone);
    return;
  }

  await notifyHostBestMatch(meeting, overlaps, active.length, hostProfile.phone);
}

async function ensureCoordinationService(hostId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("services")
    .select("id")
    .eq("host_id", hostId)
    .eq("name", "Multi-Party Scheduling")
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: anySvc } = await supabase
    .from("services")
    .select("id")
    .eq("host_id", hostId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (anySvc?.id) return anySvc.id as string;

  const { data: created, error } = await supabase
    .from("services")
    .insert({
      host_id: hostId,
      name: "Multi-Party Scheduling",
      duration_minutes: 60,
      is_active: false,
      location_type: "in_person",
    })
    .select("id")
    .maybeSingle();
  if (error || !created?.id) {
    console.error("Could not create coordination service", error);
    return null;
  }
  return created.id as string;
}

async function createBookingForLockedMeeting(
  meeting: {
    id: string;
    host_id: string;
    title: string;
    location: string | null;
    duration_minutes: number;
    booking_id?: string | null;
  },
  startIso: string,
  endIso: string,
  participants: { name: string; phone: string }[],
): Promise<string | null> {
  if (meeting.booking_id) return meeting.booking_id;
  const serviceId = await ensureCoordinationService(meeting.host_id);
  if (!serviceId) return null;
  const first = participants[0];
  const names = participants.map((p) => p.name).filter(Boolean).join(", ");
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      host_id: meeting.host_id,
      service_id: serviceId,
      guest_name: first?.name || meeting.title || "Guest",
      guest_phone: first?.phone || null,
      guest_email: null,
      guest_address: meeting.location,
      start_time: startIso,
      end_time: endIso,
      status: "confirmed",
      notes: names ? `Multi-party: ${names}` : meeting.title,
      notify_via: ["sms"],
      reminder_channels: ["sms"],
      reminder_times: ["24hour", "1hour"],
    })
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    console.error("coordination booking insert failed", error);
    return null;
  }
  await supabase.from("coordinated_meetings").update({ booking_id: data.id }).eq("id", meeting.id);
  return data.id as string;
}

async function sendProposedSlotConfirmations(
  meeting: { id: string; title: string; location: string | null; duration_minutes: number; context_type?: string },
  startIso: string,
  endIso: string,
  participants: { name: string; phone: string; token: string }[],
): Promise<void> {
  const timeLabel = formatSlotLabel(startIso, endIso);
  const loc = meeting.location?.trim() ? ` at ${meeting.location.trim()}` : "";
  const kind = coordinationContextLabel(meeting.context_type).toLowerCase();
  await Promise.all(
    participants.map((p) => {
      const ics = icsPublicUrl(p.token);
      return sendSms(
        p.phone,
        `Confirmed: "${meeting.title || kind}" ${timeLabel}${loc}. Calendar: ${ics}`,
        ics,
      );
    }),
  );
}

async function finalizeProposedSlotLock(meetingId: string, slotId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from("coordinated_meetings")
    .select("status")
    .eq("id", meetingId)
    .maybeSingle();
  if (existing?.status === "confirmed") return { ok: true };

  const { data: lockRaw, error: lockErr } = await supabase.rpc("lock_coordination_slot", {
    p_meeting_id: meetingId,
    p_slot_id: slotId,
  });
  const lock = typeof lockRaw === "string" ? JSON.parse(lockRaw) : lockRaw;
  if (lockErr || !lock?.ok) {
    return { ok: false, error: lockErr?.message ?? lock?.error ?? "lock failed" };
  }
  const startIso = lock.confirmed_time as string;
  const endIso = lock.end_time as string;

  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, host_id, title, location, duration_minutes, context_type, booking_id")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) return { ok: false, error: "meeting missing after lock" };

  const { data: participants } = await supabase
    .from("coordinated_meeting_participants")
    .select("name, phone, token")
    .eq("meeting_id", meetingId)
    .eq("opted_out", false);

  const people = (participants ?? []) as { name: string; phone: string; token: string }[];
  await createBookingForLockedMeeting(meeting, startIso, endIso, people);
  await sendProposedSlotConfirmations(meeting, startIso, endIso, people);
  await addCoordinatedEventToHostCalendar(
    meeting.host_id,
    meetingId,
    meeting.title,
    startIso,
    endIso,
  );
  return { ok: true };
}

async function notifyOrganizerNoOverlap(meetingId: string): Promise<void> {
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, host_id, title, context_type, preferred_times, status")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) return;
  if (meeting.status === "match_found") {
    const ptExisting = getPreferredTimesExtras(meeting.preferred_times);
    if (ptExisting.noOverlap === true) return;
  }
  const slots = await loadProposedSlots(meetingId);
  const slotIds = slots.map((s) => s.id);
  const { data: votes } = slotIds.length
    ? await supabase
      .from("coordinated_meeting_slot_votes")
      .select("slot_id, availability, participant_id")
      .in("slot_id", slotIds)
    : { data: [] as { slot_id: string; availability: string; participant_id: string }[] };
  const { data: active } = await supabase
    .from("coordinated_meeting_participants")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("opted_out", false);
  const activeIds = new Set((active ?? []).map((p) => p.id));
  const lines = slots.map((s, i) => {
    const yes = (votes ?? []).filter((v) =>
      v.slot_id === s.id && v.availability === "yes" && activeIds.has(v.participant_id)
    ).length;
    return `${i + 1}) ${formatSlotLabel(s.start_time, s.end_time)} — ${yes} yes`;
  });
  const pt = getPreferredTimesExtras(meeting.preferred_times);
  await supabase
    .from("coordinated_meetings")
    .update({
      status: "match_found",
      preferred_times: { ...pt, awaitingHostConfirmation: true, noOverlap: true },
    })
    .eq("id", meetingId);

  const { data: host } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", meeting.host_id)
    .maybeSingle();
  if (!host?.phone) return;
  await sendSms(
    host.phone,
    `No time worked for everyone on "${meeting.title}". Reply with a slot number to lock it, or pick in the dashboard:\n${lines.join("\n")}`,
  );
}

async function afterProposedSlotVote(token: string): Promise<Response> {
  const { data: participant } = await supabase
    .from("coordinated_meeting_participants")
    .select("id, meeting_id")
    .eq("token", token)
    .maybeSingle();
  if (!participant) {
    return new Response(JSON.stringify({ ok: false, error: "not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: allDone } = await supabase.rpc("coordination_all_active_responded", {
    p_meeting_id: participant.meeting_id,
  });
  if (!allDone) {
    return new Response(JSON.stringify({ ok: true, pending: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: overlapId } = await supabase.rpc("coordination_unanimous_slot_id", {
    p_meeting_id: participant.meeting_id,
  });
  if (overlapId) {
    const locked = await finalizeProposedSlotLock(participant.meeting_id, overlapId as string);
    return new Response(JSON.stringify({ ok: locked.ok, locked: locked.ok, error: locked.error }), {
      status: locked.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  await notifyOrganizerNoOverlap(participant.meeting_id);
  return new Response(JSON.stringify({ ok: true, needs_host: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendCoordinationInvites(meetingId: string): Promise<{ sent: number; skipped: number }> {
  const { data: meeting, error: mErr } = await supabase
    .from("coordinated_meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();

  if (mErr || !meeting) {
    throw new Error("Meeting not found");
  }

  const { data: participants, error: pErr } = await supabase
    .from("coordinated_meeting_participants")
    .select("id, name, phone, role, availability_pre_entered, token, opted_out")
    .eq("meeting_id", meetingId);

  if (pErr || !participants) {
    throw new Error("Failed to load participants");
  }

  const { data: hostProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", meeting.host_id)
    .maybeSingle();

  const hostName =
    (hostProfile?.full_name as string | undefined)?.trim() || "Someone";
  const pt = meeting.preferred_times as Record<string, unknown> | null;

  if (meeting.scheduling_mode === "proposed_slots") {
    const slots = await loadProposedSlots(meetingId);
    const toSms = participants.filter((p) => !p.opted_out);
    await Promise.all(
      toSms.map((p) =>
        sendSms(
          p.phone,
          buildNumberedInviteSms({
            participantName: p.name,
            hostName,
            title: meeting.title,
            contextType: meeting.context_type ?? "meeting",
            location: meeting.location,
            slots,
            token: p.token,
          }),
        )
      ),
    );
    return { sent: toSms.length, skipped: participants.length - toSms.length };
  }

  const toSms = participants.filter((p) => !p.availability_pre_entered && !p.opted_out);

  await Promise.all(
    toSms.map(async (p) => {
      const body = buildCoordInviteSms(p.name, hostName, meeting, pt, meeting.selected_dates);
      await sendSms(p.phone, body);
    }),
  );
  await checkAndRunOverlap(meetingId);

  return { sent: toSms.length, skipped: participants.length - toSms.length };
}

async function handleInitialSend(meetingId: string, callerHostId: string): Promise<Response> {
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("host_id")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    return new Response(JSON.stringify({ error: "Meeting not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (meeting.host_id !== callerHostId) {
    return jsonAuthError(corsHeaders, "Not allowed for this meeting", 403);
  }

  await expireStaleTrials(supabase);
  if (!(await hostPlanIsActive(supabase, callerHostId))) {
    return new Response(JSON.stringify({ error: "Reactivate Pro to coordinate meetings." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const result = await sendCoordinationInvites(meetingId);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send invites";
    const status = message === "Meeting not found" ? 404 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleInboundSms(from: string, body: string): Promise<Response> {
  const trimmedBody = body.trim();
  const normalizedFrom = from.replace(/^whatsapp:/, "");

  const hostContext = await findHostMeetingForPhone(normalizedFrom);
  if (hostContext) {
    return await processHostInbound(hostContext.meeting, trimmedBody, hostContext.hostPhone);
  }

  // Find participant by phone
  const { data: participant, error: pErr } = await supabase
    .from("coordinated_meeting_participants")
    .select("id, meeting_id, name, opted_out, phone, token")
    .eq("phone", normalizedFrom)
    .maybeSingle();

  if (pErr || !participant) {
    // Retry with E.164 variants (SMS vs WhatsApp formatting)
    const digits = normalizedFrom.replace(/\D/g, "");
    const { data: fallback } = await supabase
      .from("coordinated_meeting_participants")
      .select("id, meeting_id, name, opted_out, phone, token")
      .ilike("phone", `%${digits.slice(-10)}%`)
      .maybeSingle();

    if (!fallback) {
      console.log("No participant found for phone:", from);
      return new Response("OK", { status: 200 });
    }

    return await processInboundReply(fallback, trimmedBody);
  }

  return await processInboundReply(participant, trimmedBody);
}

async function processInboundReply(
  participant: { id: string; meeting_id: string; name: string; opted_out: boolean; phone: string; token: string },
  trimmedBody: string,
): Promise<Response> {
  // Handle opt-out
  if (/^STOP$/i.test(trimmedBody)) {
    await supabase
      .from("coordinated_meeting_participants")
      .update({ opted_out: true })
      .eq("id", participant.id);
    return new Response("OK", { status: 200 });
  }

  if (participant.opted_out) {
    return new Response("OK", { status: 200 });
  }

  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, duration_minutes, proposed_window_start, proposed_window_end, status, scheduling_mode")
    .eq("id", participant.meeting_id)
    .maybeSingle();

  if (!meeting) {
    return new Response("OK", { status: 200 });
  }

  if (meeting.scheduling_mode === "proposed_slots") {
    if (meeting.status !== "collecting_availability") {
      return new Response("OK", { status: 200 });
    }
    const slots = await loadProposedSlots(participant.meeting_id);
    const n = parseBareSlotNumber(trimmedBody);
    const slot = slotFromNumber(slots, n);
    if (!slot || !participant.token) {
      await sendSms(participant.phone, numberedClarifySms(participant.token, slots.length));
      return new Response("OK", { status: 200 });
    }
    const { data: voteRaw } = await supabase.rpc("submit_coordination_slot_votes", {
      p_token: participant.token,
      p_slot_ids: [slot.id],
    });
    const voteRes = typeof voteRaw === "string" ? JSON.parse(voteRaw) : voteRaw;
    if (!voteRes?.ok) {
      await sendSms(participant.phone, numberedClarifySms(participant.token, slots.length));
      return new Response("OK", { status: 200 });
    }
    await afterProposedSlotVote(participant.token);
    return new Response("OK", { status: 200 });
  }

  // Store raw availability response (open_availability / NL only)
  await supabase
    .from("coordinated_meeting_participants")
    .update({ availability_response: trimmedBody })
    .eq("id", participant.id);

  if (meeting.status !== "collecting_availability") {
    return new Response("OK", { status: 200 });
  }

  const timeframe = {
    start: meeting.proposed_window_start ?? new Date().toISOString(),
    end: meeting.proposed_window_end ?? new Date(Date.now() + 7 * 86400000).toISOString(),
  };

  // Parse availability via AI
  const slots = await parseAvailability(trimmedBody, timeframe);

  await supabase
    .from("coordinated_meeting_participants")
    .update({ parsed_slots: slots })
    .eq("id", participant.id);

  await checkAndRunOverlap(participant.meeting_id);

  return new Response("OK", { status: 200 });
}

async function handleConfirm(meetingId: string, confirmedTime: string, callerHostId: string): Promise<Response> {
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("host_id")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    return new Response(JSON.stringify({ error: "Meeting not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (meeting.host_id !== callerHostId) {
    return jsonAuthError(corsHeaders, "Not allowed for this meeting", 403);
  }

  await expireStaleTrials(supabase);
  if (!(await hostPlanIsActive(supabase, callerHostId))) {
    return new Response(JSON.stringify({ error: "Reactivate Pro to coordinate meetings." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await finalizeHostConfirmation(meetingId, confirmedTime);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function serveCoordinationIcs(token: string | null): Promise<Response> {
  if (!token) {
    return new Response("missing token", { status: 400, headers: corsHeaders });
  }
  const { data: participant } = await supabase
    .from("coordinated_meeting_participants")
    .select("token, meeting_id, name")
    .eq("token", token)
    .maybeSingle();
  if (!participant) {
    return new Response("not found", { status: 404, headers: corsHeaders });
  }
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, title, location, duration_minutes, status, confirmed_time, context_type")
    .eq("id", participant.meeting_id)
    .maybeSingle();
  if (!meeting || meeting.status !== "confirmed" || !meeting.confirmed_time) {
    return new Response("not confirmed", { status: 404, headers: corsHeaders });
  }
  const slots = await loadProposedSlots(meeting.id);
  const startMs = new Date(meeting.confirmed_time).getTime();
  const locked = slots.find((s) => new Date(s.start_time).getTime() === startMs);
  const startIso = meeting.confirmed_time as string;
  const endIso = locked?.end_time
    ?? new Date(startMs + (meeting.duration_minutes || 60) * 60_000).toISOString();
  const kind = coordinationContextLabel(meeting.context_type);
  const ics = buildCoordinationIcs({
    uid: `coord-${meeting.id}-${participant.token}@pinonit.com`,
    title: (meeting.title as string) || kind,
    location: meeting.location as string | null,
    startIso,
    endIso,
  });
  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="pinonit-${kind.toLowerCase()}.ics"`,
    },
  });
}

async function requireActiveHostMeeting(meetingId: string, callerHostId: string) {
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) {
    return { error: new Response(JSON.stringify({ error: "Meeting not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }) };
  }
  if (meeting.host_id !== callerHostId) {
    return { error: jsonAuthError(corsHeaders, "Not allowed for this meeting", 403) };
  }
  await expireStaleTrials(supabase);
  if (!(await hostPlanIsActive(supabase, callerHostId))) {
    return { error: new Response(JSON.stringify({ error: "Reactivate Pro to coordinate meetings." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }) };
  }
  return { meeting };
}

async function handleNudge(
  meetingId: string,
  participantId: string,
  callerHostId: string,
): Promise<Response> {
  const checked = await requireActiveHostMeeting(meetingId, callerHostId);
  if ("error" in checked) return checked.error;
  const meeting = checked.meeting;
  const { data: p } = await supabase
    .from("coordinated_meeting_participants")
    .select("id, name, phone, token, opted_out, availability_pre_entered")
    .eq("id", participantId)
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (!p || p.opted_out) {
    return new Response(JSON.stringify({ error: "Participant not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: hostProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", meeting.host_id)
    .maybeSingle();
  const hostName = (hostProfile?.full_name as string | undefined)?.trim() || "Someone";
  if (meeting.scheduling_mode === "proposed_slots") {
    const slots = await loadProposedSlots(meetingId);
    await sendSms(
      p.phone,
      buildNumberedInviteSms({
        participantName: p.name,
        hostName,
        title: meeting.title,
        contextType: meeting.context_type ?? "meeting",
        location: meeting.location,
        slots,
        token: p.token,
      }),
    );
  } else {
    const pt = meeting.preferred_times as Record<string, unknown> | null;
    await sendSms(p.phone, buildCoordInviteSms(p.name, hostName, meeting, pt, meeting.selected_dates));
  }
  await supabase
    .from("coordinated_meeting_participants")
    .update({ last_nudged_at: new Date().toISOString() })
    .eq("id", p.id);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleHostLockSlot(
  meetingId: string,
  slotId: string,
  callerHostId: string,
): Promise<Response> {
  const checked = await requireActiveHostMeeting(meetingId, callerHostId);
  if ("error" in checked) return checked.error;
  const locked = await finalizeProposedSlotLock(meetingId, slotId);
  return new Response(JSON.stringify({ ok: locked.ok, error: locked.error }), {
    status: locked.ok ? 200 : 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      if (url.searchParams.get("ics") === "1") {
        return await serveCoordinationIcs(url.searchParams.get("token"));
      }
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Twilio sends webhook as form-urlencoded
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const from = formData.get("From") as string;
      const body = formData.get("Body") as string;
      return await handleInboundSms(from, body);
    }

    const payload = await req.json();

    if (payload.type === "after_vote" && typeof payload.token === "string") {
      return await afterProposedSlotVote(payload.token);
    }

    const callerHostId = await hostIdFromJwt(req, supabase);
    if (!callerHostId) {
      return jsonAuthError(corsHeaders, "Sign in to coordinate meetings");
    }

    if (payload.type === "sms_webhook") {
      return await handleInboundSms(payload.From, payload.Body);
    }

    if (payload.type === "confirm") {
      return await handleConfirm(payload.meeting_id, payload.confirmed_time, callerHostId);
    }

    if (payload.type === "nudge") {
      return await handleNudge(payload.meeting_id, payload.participant_id, callerHostId);
    }

    if (payload.type === "lock_slot") {
      return await handleHostLockSlot(payload.meeting_id, payload.slot_id, callerHostId);
    }

    if (payload.meeting_id) {
      return await handleInitialSend(payload.meeting_id, callerHostId);
    }

    return new Response(JSON.stringify({ error: "Unknown request type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("coordinate-sms error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
