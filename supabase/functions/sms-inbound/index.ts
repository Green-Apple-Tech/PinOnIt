import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { appendSmsOptOut } from "../_shared/sms-opt-out.ts";
import { NOREPLY_FROM } from "../_shared/contact-email.ts";
import { isValidSlackWebhookUrl, notifySlackWebhook } from "../_shared/slack-webhook.ts";
import { hostAllowsSms } from "../_shared/sms-compliance.ts";
import { assertTwilioSignature } from "../_shared/twilio-signature.ts";

const APP_URL = (Deno.env.get("APP_URL") || "https://pinonit.com").replace(/\/$/, "");
const OPT_OUT = new Set(["stop", "start", "help", "unsubscribe", "unstop"]);

function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function emptyTwiml(): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function forbidden(): Response {
  return new Response("Forbidden", { status: 403 });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function digits(phone: string | null | undefined): string {
  return (phone || "").replace(/\D/g, "");
}

function last10(phone: string | null | undefined): string {
  const d = digits(phone);
  return d.length > 10 ? d.slice(-10) : d;
}

function normalizeInboundBody(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

function clipSms(text: string, max = 160): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function businessName(host: Record<string, unknown> | null | undefined): string {
  const settings = host?.paid_booking_settings as { display_name?: string } | null;
  const name =
    (settings?.display_name as string) ||
    (host?.business_name as string) ||
    (host?.full_name as string) ||
    "";
  return name.trim() || "the business";
}

async function formParams(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") || "";
  const params: Record<string, string> = {};
  if (contentType.includes("application/json")) {
    const json = await req.json() as Record<string, unknown>;
    for (const [k, v] of Object.entries(json)) {
      if (v == null) continue;
      params[k] = String(v);
    }
    return params;
  }
  const form = await req.formData();
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") params[k] = v;
  }
  return params;
}

async function logMessage(
  supabase: SupabaseClient,
  row: { direction: "inbound" | "outbound"; body: string; twilio_sid?: string | null; booking_id?: string | null },
) {
  const { error } = await supabase.from("messages").insert({
    direction: row.direction,
    body: row.body,
    twilio_sid: row.twilio_sid ?? null,
    booking_id: row.booking_id ?? null,
  });
  if (error) console.error("messages insert:", error.message);
}

async function upsertConversation(
  supabase: SupabaseClient,
  phone: string,
  bookingId: string | null,
  intent: string,
  state: string,
) {
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("sms_conversations")
    .select("id")
    .eq("phone", phone)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await supabase.from("sms_conversations").update({
      booking_id: bookingId,
      last_intent: intent,
      state,
      expires_at: expires,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return;
  }
  await supabase.from("sms_conversations").insert({
    phone,
    booking_id: bookingId,
    last_intent: intent,
    state,
    expires_at: expires,
  });
}

async function sendTwilioSms(to: string, body: string): Promise<string | null> {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
  if (!twilioSid || !twilioToken || !messagingServiceSid || !to) return null;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          MessagingServiceSid: messagingServiceSid,
          To: to,
          Body: appendSmsOptOut(body),
        }),
      },
    );
    if (!res.ok) {
      console.error("Twilio SMS failed:", await res.text());
      return null;
    }
    const json = await res.json() as { sid?: string };
    return json.sid ?? null;
  } catch (e) {
    console.error("Twilio SMS error:", e);
    return null;
  }
}

async function sendResendEmail(to: string[], subject: string, text: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || to.length === 0) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: NOREPLY_FROM, to, subject, text }),
    });
  } catch (e) {
    console.error("host email failed:", e);
  }
}

type BookingRow = {
  id: string;
  guest_phone: string | null;
  guest_name: string | null;
  start_time: string;
  status: string;
  host_id: string;
  service_id: string | null;
  action_token: string | null;
  services: Record<string, unknown> | null;
  profiles: Record<string, unknown> | null;
};

async function findUpcomingBooking(
  supabase: SupabaseClient,
  from10: string,
): Promise<BookingRow | null> {
  const now = new Date();
  const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, guest_phone, guest_name, start_time, status, host_id, service_id, action_token, services(allow_reschedule, name), profiles(full_name, business_name, email, notification_email, phone, sms_opt_in, default_reminder_channel, slack_webhook_url, reschedule_cutoff_hours, paid_booking_settings)")
    .in("status", ["confirmed", "pending_approval", "tentative"])
    .gt("start_time", now.toISOString())
    .lte("start_time", until.toISOString())
    .not("guest_phone", "is", null)
    .order("start_time", { ascending: true })
    .limit(500);
  return ((bookings ?? []) as BookingRow[]).find((b) => last10(b.guest_phone) === from10) ?? null;
}

async function lookupBusinessName(supabase: SupabaseClient, from10: string): Promise<string> {
  const { data: rows } = await supabase
    .from("bookings")
    .select("guest_phone, profiles(full_name, business_name, paid_booking_settings)")
    .not("guest_phone", "is", null)
    .order("start_time", { ascending: false })
    .limit(80);
  const hit = (rows ?? []).find((b) => last10(b.guest_phone as string) === from10);
  return businessName(hit?.profiles as Record<string, unknown> | null);
}

async function notifyOwner(
  host: Record<string, unknown> | null,
  line: string,
  subject: string,
) {
  const hostEmail = (host?.notification_email as string) || (host?.email as string);
  if (hostEmail) await sendResendEmail([hostEmail], subject, line);
  if (hostAllowsSms({
    sms_opt_in: host?.sms_opt_in as boolean | null,
    default_reminder_channel: host?.default_reminder_channel as string | null,
  }) && host?.phone) {
    await sendTwilioSms(String(host.phone), line);
  }
  await notifySlackWebhook(host?.slack_webhook_url, line);
}

async function cancelBooking(
  supabase: SupabaseClient,
  booking: BookingRow,
  from: string,
): Promise<string> {
  await supabase
    .from("bookings")
    .update({ status: "canceled", cancel_reason: "canceled_by_invitee_sms" })
    .eq("id", booking.id);

  const host = booking.profiles;
  const service = booking.services;
  const serviceName = (service?.name as string) || "appointment";
  const dateStr = new Date(booking.start_time).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const guest = booking.guest_name || "Your guest";
  const inviteeMsg = clipSms(`Canceled: your ${serviceName} on ${dateStr} is canceled.`);
  const hostLine = `${guest} canceled their ${serviceName} on ${dateStr} by text.`;

  await logMessage(supabase, {
    direction: "outbound",
    body: inviteeMsg,
    booking_id: booking.id,
  });
  await notifyOwner(host, hostLine, `Canceled: ${serviceName} with ${guest}`);

  if (booking.action_token) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await fetch(`${supabaseUrl}/functions/v1/write-calendar-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          kind: "booking",
          action: "delete",
          booking_id: booking.id,
          host_id: booking.host_id,
          action_token: booking.action_token,
        }),
      });
    } catch (e) {
      console.error("[sms-inbound] calendar delete failed:", e);
    }
  }

  await upsertConversation(supabase, from, booking.id, "cancel", "canceled");
  return inviteeMsg;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let params: Record<string, string>;
  try {
    params = await formParams(req);
  } catch {
    return forbidden();
  }

  const signed = await assertTwilioSignature(req, params);
  if (!signed) return forbidden();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const from = String(params.From ?? params.from ?? "");
  const body = String(params.Body ?? params.body ?? "");
  const inboundSid = params.MessageSid || params.SmsSid || null;
  const key = normalizeInboundBody(body);

  await logMessage(supabase, {
    direction: "inbound",
    body,
    twilio_sid: inboundSid,
    booking_id: null,
  });

  if (OPT_OUT.has(key)) return emptyTwiml();

  const wantCancel = key === "1" || key === "cancel";
  const wantReschedule = key === "2" || key === "reschedule";
  if (!wantCancel && !wantReschedule) return emptyTwiml();

  const from10 = last10(from);
  const intent = wantCancel ? "cancel" : "reschedule";

  if (from10.length < 10) {
    const name = "the business";
    const msg = `We couldn't find an upcoming appointment for this number — please contact ${name} directly.`;
    await logMessage(supabase, { direction: "outbound", body: msg, booking_id: null });
    return twiml(clipSms(msg));
  }

  const booking = await findUpcomingBooking(supabase, from10);
  if (!booking) {
    const name = await lookupBusinessName(supabase, from10);
    const msg = `We couldn't find an upcoming appointment for this number — please contact ${name} directly.`;
    await logMessage(supabase, { direction: "outbound", body: msg, booking_id: null });
    await upsertConversation(supabase, from, null, intent, "no_match");
    return twiml(clipSms(msg));
  }

  if (wantCancel) {
    const msg = await cancelBooking(supabase, booking, from);
    return twiml(msg);
  }

  const host = booking.profiles;
  const service = booking.services;
  const contact =
    (host?.phone as string) ||
    (host?.notification_email as string) ||
    (host?.email as string) ||
    "";
  const hostName = businessName(host);
  const cutoff = Number(host?.reschedule_cutoff_hours ?? 4);
  const startMs = Date.parse(String(booking.start_time));
  const insideCutoff = Number.isFinite(startMs) && startMs < Date.now() + cutoff * 60 * 60 * 1000;

  if (service?.allow_reschedule === false || insideCutoff) {
    const msg = contact
      ? `Too close to reschedule online. Contact ${hostName}: ${contact}`
      : `Too close to reschedule online. Contact ${hostName}.`;
    const clipped = clipSms(msg);
    await logMessage(supabase, { direction: "outbound", body: clipped, booking_id: booking.id });
    await upsertConversation(supabase, from, booking.id, "reschedule", "blocked");
    return twiml(clipped);
  }

  const { data: token, error } = await supabase.rpc("ensure_reschedule_token", {
    p_booking_id: booking.id,
  });
  if (error || !token) {
    const msg = contact
      ? `Reply with a new time request to ${hostName}: ${contact}`
      : `Contact ${hostName} to reschedule.`;
    const clipped = clipSms(msg);
    await logMessage(supabase, { direction: "outbound", body: clipped, booking_id: booking.id });
    await upsertConversation(supabase, from, booking.id, "reschedule", "token_failed");
    return twiml(clipped);
  }

  const reply = clipSms(`Pick a new time: ${APP_URL}/r/${token}`);
  await logMessage(supabase, { direction: "outbound", body: reply, booking_id: booking.id });
  await upsertConversation(supabase, from, booking.id, "reschedule", "link_sent");
  return twiml(reply);
});
