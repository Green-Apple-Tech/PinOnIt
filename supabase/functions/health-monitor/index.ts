import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const ALERT_PHONE = "+13053212060";
const APP_URL = "https://pinonit.com";

const SERVICES = [
  { name: "Booking Page", url: `${APP_URL}/` },
  { name: "Dashboard", url: `${APP_URL}/login` },
  { name: "Database", url: `${SUPABASE_URL}/rest/v1/`, checkFn: "db" },
  { name: "Email/SMS Reminders", url: `${SUPABASE_URL}/functions/v1/send-reminder`, checkFn: "reminder" },
];

async function checkService(svc: typeof SERVICES[0]): Promise<{ status: "ok" | "degraded" | "down"; response_time_ms: number; error_message: string | null }> {
  const start = Date.now();
  try {
    let res: Response;
    if (svc.checkFn === "db") {
      res = await fetch(`${SUPABASE_URL}/rest/v1/uptime_logs?limit=1`, {
        headers: {
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
        },
        signal: AbortSignal.timeout(8000),
      });
    } else if (svc.checkFn === "reminder") {
      // Just ping the function endpoint for CORS/availability — don't actually send
      res = await fetch(svc.url, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(8000),
      });
    } else {
      res = await fetch(svc.url, {
        signal: AbortSignal.timeout(8000),
      });
    }
    const ms = Date.now() - start;
    if (res.status >= 500) {
      return { status: "down", response_time_ms: ms, error_message: `HTTP ${res.status}` };
    }
    if (ms > 5000) {
      return { status: "degraded", response_time_ms: ms, error_message: "Slow response (>5s)" };
    }
    return { status: "ok", response_time_ms: ms, error_message: null };
  } catch (err) {
    const ms = Date.now() - start;
    return { status: "down", response_time_ms: ms, error_message: String(err).slice(0, 200) };
  }
}

async function sendSms(body: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({ To: ALERT_PHONE, From: TWILIO_PHONE_NUMBER, Body: body });
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
    },
    body: params.toString(),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    // Run all service checks in parallel
    const results = await Promise.all(
      SERVICES.map(async (svc) => {
        const result = await checkService(svc);
        return { service_name: svc.name, checked_at: now, ...result };
      })
    );

    // Insert logs
    await supabase.from("uptime_logs").insert(results);

    // Determine overall health
    const anyDown = results.some((r) => r.status === "down");
    const anyDegraded = results.some((r) => r.status === "degraded");
    const overallStatus = anyDown ? "down" : anyDegraded ? "degraded" : "ok";

    // Check recent history for SMS alerting (last 2 checks for "2 consecutive failures")
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: recentLogs } = await supabase
      .from("uptime_logs")
      .select("status, checked_at, service_name")
      .gte("checked_at", thirtyMinAgo)
      .order("checked_at", { ascending: false })
      .limit(60);

    const logs = recentLogs ?? [];

    // Check if we already sent an alert in the last 30 minutes (prevent repeat alerts)
    // We use service_name='_sms_alert' as a sentinel
    const { data: recentAlert } = await supabase
      .from("uptime_logs")
      .select("checked_at")
      .eq("service_name", "_sms_alert")
      .gte("checked_at", thirtyMinAgo)
      .maybeSingle();

    // Determine if we had 2 consecutive down checks across all services
    const recentOverallStatuses = logs
      .reduce((acc: Record<string, string[]>, l) => {
        if (!acc[l.service_name]) acc[l.service_name] = [];
        acc[l.service_name].push(l.status);
        return acc;
      }, {});

    const consecutiveDownServices = Object.entries(recentOverallStatuses)
      .filter(([, statuses]) => statuses.slice(0, 2).every((s) => s === "down"))
      .map(([name]) => name);

    const isConsecutivelyDown = consecutiveDownServices.length > 0;

    // Check if down for 15+ minutes
    const { data: longDownLogs } = await supabase
      .from("uptime_logs")
      .select("status")
      .gte("checked_at", fifteenMinAgo)
      .in("service_name", SERVICES.map((s) => s.name));

    const allRecentDown = (longDownLogs ?? []).length > 0 &&
      (longDownLogs ?? []).every((l) => l.status === "down");

    // Send alerts if needed
    if (isConsecutivelyDown && !recentAlert) {
      const timeStr = new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
      await sendSms(
        `PinOnIt is DOWN as of ${timeStr}. Check ${APP_URL}/status`
      );
      // Record sentinel
      await supabase.from("uptime_logs").insert({
        service_name: "_sms_alert",
        status: "down",
        checked_at: now,
        error_message: "SMS alert sent: down",
      });
    } else if (allRecentDown && !recentAlert) {
      // 15+ min down
      const timeStr = new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
      await sendSms(
        `PinOnIt has been down 15+ min. Check ${APP_URL}/status and redeploy via Bolt Cloud if needed.`
      );
      await supabase.from("uptime_logs").insert({
        service_name: "_sms_alert",
        status: "down",
        checked_at: now,
        error_message: "SMS alert sent: 15min down",
      });
    }

    // Recovery alert — if previous check was down and now ok
    if (overallStatus === "ok") {
      const { data: prevDown } = await supabase
        .from("uptime_logs")
        .select("status, checked_at, service_name")
        .not("service_name", "eq", "_sms_alert")
        .lt("checked_at", now)
        .order("checked_at", { ascending: false })
        .limit(SERVICES.length * 2);

      const wasDown = (prevDown ?? []).slice(0, SERVICES.length).some((l) => l.status === "down");
      const prevAlert = await supabase
        .from("uptime_logs")
        .select("checked_at, error_message")
        .eq("service_name", "_sms_alert")
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (wasDown && prevAlert.data && !prevAlert.data.error_message?.includes("recovery")) {
        const timeStr = new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
        const downSince = prevAlert.data.checked_at;
        const downtimeMin = Math.round((Date.now() - new Date(downSince).getTime()) / 60000);
        await sendSms(
          `PinOnIt is back ONLINE as of ${timeStr}. Downtime: ~${downtimeMin} min`
        );
        await supabase.from("uptime_logs").insert({
          service_name: "_sms_alert",
          status: "ok",
          checked_at: now,
          error_message: "SMS alert sent: recovery",
        });
      }
    }

    return new Response(
      JSON.stringify({ status: overallStatus, results, checked_at: now }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
