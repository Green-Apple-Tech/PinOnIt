import { createClient } from "npm:@supabase/supabase-js@2";
import { appendSmsOptOut } from "../_shared/sms-opt-out.ts";
import { NOREPLY_FROM } from "../_shared/contact-email.ts";
import { isValidSlackWebhookUrl, notifySlackWebhook } from "../_shared/slack-webhook.ts";
import { hostAllowsSms } from "../_shared/sms-compliance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rpcReason(err: { message?: string } | null): string {
  const msg = (err?.message || "").toLowerCase();
  for (const key of ["not_found", "used", "expired", "cutoff", "not_allowed", "slot_taken", "invalid_slot"]) {
    if (msg.includes(key)) return key;
  }
  return "error";
}

async function sendTwilioSms(to: string, body: string): Promise<void> {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
  if (!twilioSid || !twilioToken || !messagingServiceSid || !to) return;
  try {
    await fetch(
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
  } catch (e) {
    console.error("host SMS failed:", e);
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const startTime = typeof body.start_time === "string" ? body.start_time : "";
    const endTime = typeof body.end_time === "string" ? body.end_time : "";
    const guestTimezone = typeof body.guest_timezone === "string" ? body.guest_timezone : null;

    if (!token || !startTime || !endTime) {
      return jsonResponse({ error: "Missing token or slot" }, 400);
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("complete_guest_reschedule", {
      p_token: token,
      p_start_time: startTime,
      p_end_time: endTime,
      p_guest_timezone: guestTimezone,
    });

    if (rpcError) {
      return jsonResponse({ error: rpcReason(rpcError) }, 400);
    }

    const newId = (rpcData as { new_booking_id?: string } | null)?.new_booking_id;
    if (!newId) {
      return jsonResponse({ error: "error" }, 500);
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("*, services(name, duration_minutes), profiles(full_name, slug, timezone, email, notification_email, phone, sms_opt_in, slack_webhook_url)")
      .eq("id", newId)
      .maybeSingle();

    if (!booking) {
      return jsonResponse({ error: "error" }, 500);
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { data: rules } = await supabase
        .from("reminder_rules")
        .select("template_id, timing_offset_minutes, service_id")
        .eq("host_id", booking.host_id)
        .eq("is_active", true);

      for (const rule of rules ?? []) {
        if ((rule.timing_offset_minutes ?? 0) !== 0) continue;
        if (rule.service_id && rule.service_id !== booking.service_id) continue;
        await fetch(`${supabaseUrl}/functions/v1/send-reminder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            booking_id: booking.id,
            template_id: rule.template_id,
            action_token: booking.action_token,
          }),
        });
      }
    } catch (e) {
      console.error("confirmation send failed:", e);
    }

    const host = booking.profiles as Record<string, unknown> | null;
    const service = booking.services as Record<string, unknown> | null;
    const dateStr = new Date(booking.start_time).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const timeStr = new Date(booking.start_time).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const hostLine = `${booking.guest_name} rescheduled ${(service?.name as string) || "an appointment"} to ${dateStr} at ${timeStr}.`;

    const hostEmail = (host?.notification_email as string) || (host?.email as string);
    if (hostEmail) {
      await sendResendEmail(
        [hostEmail],
        `Rescheduled: ${service?.name || "Appointment"} with ${booking.guest_name}`,
        hostLine,
      );
    }
    if (hostAllowsSms({
      sms_opt_in: host?.sms_opt_in as boolean | null,
      default_reminder_channel: host?.default_reminder_channel as string | null,
    }) && host?.phone) {
      await sendTwilioSms(String(host.phone), hostLine);
    }
    await notifySlackWebhook(host?.slack_webhook_url, hostLine);

    return jsonResponse({ ok: true, booking });
  } catch (e) {
    console.error("complete-reschedule:", e);
    return jsonResponse({ error: "error" }, 500);
  }
});
