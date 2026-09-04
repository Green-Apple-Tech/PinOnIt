import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { appendSmsOptOut } from "../_shared/sms-opt-out.ts";
import { normalizePhoneE164 } from "../_shared/phone.ts";
import { hostIdFromJwt, jsonAuthError } from "../_shared/callerAuth.ts";
import { expireStaleTrials, hostPlanIsActive } from "../_shared/hostPlan.ts";

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
): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!accountSid || !authToken) {
    console.error("Twilio credentials not configured");
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: body });

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
async function sendMessage(to: string, body: string): Promise<void> {
  const smsFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
  const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
  const e164 = normalizePhoneE164(to);

  if (whatsappFrom) {
    const waFrom = whatsappFrom.startsWith("whatsapp:")
      ? whatsappFrom
      : `whatsapp:${whatsappFrom}`;
    const sent = await sendTwilioMessage(`whatsapp:${e164}`, waFrom, body);
    if (sent) return;
  }

  if (!smsFrom) {
    console.error("Twilio SMS from-number not configured");
    return;
  }

  await sendTwilioMessage(e164, smsFrom, body);
}

async function sendSms(to: string, body: string): Promise<void> {
  await sendMessage(to, appendSmsOptOut(body));
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
    .select("id, name, phone, role, availability_pre_entered")
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

  const toSms = participants.filter((p) => !p.availability_pre_entered);

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
    .select("id, meeting_id, name, opted_out")
    .eq("phone", normalizedFrom)
    .maybeSingle();

  if (pErr || !participant) {
    // Retry with E.164 variants (SMS vs WhatsApp formatting)
    const digits = normalizedFrom.replace(/\D/g, "");
    const { data: fallback } = await supabase
      .from("coordinated_meeting_participants")
      .select("id, meeting_id, name, opted_out, phone")
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
  participant: { id: string; meeting_id: string; name: string; opted_out: boolean },
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

  // Store raw availability response
  await supabase
    .from("coordinated_meeting_participants")
    .update({ availability_response: trimmedBody })
    .eq("id", participant.id);

  // Load meeting for timeframe
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, duration_minutes, proposed_window_start, proposed_window_end, status")
    .eq("id", participant.meeting_id)
    .maybeSingle();

  if (!meeting || meeting.status !== "collecting_availability") {
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Twilio sends webhook as form-urlencoded
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const from = formData.get("From") as string;
      const body = formData.get("Body") as string;
      return await handleInboundSms(from, body);
    }

    const payload = await req.json();

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
