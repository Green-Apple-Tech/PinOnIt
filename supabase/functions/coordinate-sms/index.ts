import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
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
  await sendMessage(to, body);
}

async function parseAvailability(
  response: string,
  timeframe: { start: string; end: string }
): Promise<ParsedSlot[]> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetch(`${supabaseUrl}/functions/v1/parse-availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
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
      // Check if consecutive 15-min block
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
      const endMin = sh * 60 + sm + durationMinutes;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      windows.push(`${date} ${time}-${endTime}`);
      if (windows.length >= 3) break;
    }
  }
  return windows;
}

async function checkAndRunOverlap(meetingId: string): Promise<void> {
  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("id, duration_minutes, proposed_window_start, proposed_window_end, status, host_id, title, preferred_times, selected_dates")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting || meeting.status !== "collecting_availability") return;

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

  if (overlaps.length === 0) {
    await supabase
      .from("coordinated_meetings")
      .update({ status: "cancelled" })
      .eq("id", meetingId);
    return;
  }

  await supabase
    .from("coordinated_meetings")
    .update({ status: "match_found", confirmed_time: overlaps[0] })
    .eq("id", meetingId);

  const { data: hostProfile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", meeting.host_id)
    .maybeSingle();

  if (hostProfile?.phone) {
    const optionLines = overlaps.map((o, i) => `${i + 1}. ${o}`).join("\n");
    await sendSms(
      hostProfile.phone,
      `Great news! All participants for "${meeting.title}" have responded.\n\nAvailable time slots:\n${optionLines}\n\nVisit your PinOnIt dashboard to confirm a time.`
    );
  }
}

async function handleInitialSend(meetingId: string): Promise<Response> {
  const { data: meeting, error: mErr } = await supabase
    .from("coordinated_meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();

  if (mErr || !meeting) {
    return new Response(JSON.stringify({ error: "Meeting not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: participants, error: pErr } = await supabase
    .from("coordinated_meeting_participants")
    .select("id, name, phone, role, availability_pre_entered")
    .eq("meeting_id", meetingId);

  if (pErr || !participants) {
    return new Response(JSON.stringify({ error: "Failed to load participants" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const windowStr = meeting.proposed_window_start
    ? `between ${new Date(meeting.proposed_window_start).toLocaleDateString()} and ${new Date(meeting.proposed_window_end).toLocaleDateString()}`
    : "in the coming days";

  const slotsStr = formatSlotsForSms(meeting.preferred_times, meeting.selected_dates);
  const timesClause = slotsStr
    ? ` during these times: ${slotsStr}`
    : ` ${windowStr}`;

  const toSms = participants.filter((p) => !p.availability_pre_entered);

  const smsPromises = toSms.map(async (p) => {
    const msg =
      `Hi ${p.name}! You're invited to "${meeting.title}" (${meeting.duration_minutes} min).` +
      ` Please reply with your availability${timesClause}.` +
      (meeting.location ? ` Location: ${meeting.location}.` : "") +
      ` Reply STOP to opt out.`;
    await sendSms(p.phone, msg);
  });

  await Promise.all(smsPromises);
  await checkAndRunOverlap(meetingId);

  return new Response(JSON.stringify({ ok: true, sent: toSms.length, skipped: participants.length - toSms.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleInboundSms(from: string, body: string): Promise<Response> {
  const trimmedBody = body.trim();
  const normalizedFrom = from.replace(/^whatsapp:/, "");

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

async function handleConfirm(meetingId: string, confirmedTime: string): Promise<Response> {
  await supabase
    .from("coordinated_meetings")
    .update({ status: "confirmed", confirmed_time: confirmedTime })
    .eq("id", meetingId);

  const { data: meeting } = await supabase
    .from("coordinated_meetings")
    .select("title, duration_minutes, location")
    .eq("id", meetingId)
    .maybeSingle();

  const { data: participants } = await supabase
    .from("coordinated_meeting_participants")
    .select("name, phone, availability_pre_entered")
    .eq("meeting_id", meetingId)
    .eq("opted_out", false);

  if (meeting && participants) {
    const locationStr = meeting.location ? ` at ${meeting.location}` : "";
    const smsPromises = participants
      .filter((p) => !p.availability_pre_entered)
      .map((p) =>
        sendSms(
          p.phone,
          `Hi ${p.name}! "${meeting.title}" has been scheduled for ${confirmedTime}${locationStr} (${meeting.duration_minutes} min). See you then!`
        )
      );
    await Promise.all(smsPromises);
  }

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

    if (payload.type === "sms_webhook") {
      return await handleInboundSms(payload.From, payload.Body);
    }

    if (payload.type === "confirm") {
      return await handleConfirm(payload.meeting_id, payload.confirmed_time);
    }

    if (payload.meeting_id) {
      return await handleInitialSend(payload.meeting_id);
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
