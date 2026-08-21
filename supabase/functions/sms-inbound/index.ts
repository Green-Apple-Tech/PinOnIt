import { createClient } from "npm:@supabase/supabase-js@2";

const APP_URL = (Deno.env.get("APP_URL") || "https://pinonit.com").replace(/\/$/, "");

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const contentType = req.headers.get("content-type") || "";
  let from = "";
  let body = "";
  try {
    if (contentType.includes("application/json")) {
      const json = await req.json();
      from = String(json.From ?? json.from ?? "");
      body = String(json.Body ?? json.body ?? "");
    } else {
      const form = await req.formData();
      from = String(form.get("From") ?? "");
      body = String(form.get("Body") ?? "");
    }
  } catch {
    return emptyTwiml();
  }

  const key = normalizeInboundBody(body);
  if (key === "stop" || key === "start" || key === "help" || key === "unstop") {
    return emptyTwiml();
  }

  const wantReschedule = key === "2" || key === "reschedule";
  if (!wantReschedule) {
    return emptyTwiml();
  }

  const from10 = last10(from);
  if (from10.length < 10) {
    return twiml(clipSms("We could not match a booking to this number."));
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, guest_phone, start_time, status, host_id, service_id, services(allow_reschedule, name), profiles(full_name, email, notification_email, phone, reschedule_cutoff_hours)")
    .in("status", ["confirmed", "pending_approval", "tentative"])
    .gt("start_time", new Date().toISOString())
    .not("guest_phone", "is", null)
    .order("start_time", { ascending: true })
    .limit(40);

  const booking = (bookings ?? []).find((b) => last10(b.guest_phone as string) === from10);
  if (!booking) {
    return twiml(clipSms("No upcoming appointment found for this number."));
  }

  const host = booking.profiles as Record<string, unknown> | null;
  const service = booking.services as Record<string, unknown> | null;
  const contact =
    (host?.phone as string) ||
    (host?.notification_email as string) ||
    (host?.email as string) ||
    "";
  const hostName = (host?.full_name as string) || "the host";
  const cutoff = Number(host?.reschedule_cutoff_hours ?? 4);
  const startMs = Date.parse(String(booking.start_time));
  const insideCutoff = Number.isFinite(startMs) && startMs < Date.now() + cutoff * 60 * 60 * 1000;

  if (service?.allow_reschedule === false || insideCutoff) {
    const msg = contact
      ? `Too close to reschedule online. Contact ${hostName}: ${contact}`
      : `Too close to reschedule online. Contact ${hostName}.`;
    return twiml(clipSms(msg));
  }

  const { data: token, error } = await supabase.rpc("ensure_reschedule_token", {
    p_booking_id: booking.id,
  });
  if (error || !token) {
    const msg = contact
      ? `Reply with a new time request to ${hostName}: ${contact}`
      : `Contact ${hostName} to reschedule.`;
    return twiml(clipSms(msg));
  }

  return twiml(clipSms(`Pick a new time: ${APP_URL}/r/${token}`));
});
