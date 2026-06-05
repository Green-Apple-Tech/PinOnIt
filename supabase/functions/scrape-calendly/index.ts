import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchCalendlyImportViaOAuth } from "../_shared/calendly-api.ts";
import type { CalendlyImportEvent } from "../_shared/calendly-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LegacyCalendlyEvent {
  name: string;
  duration_minutes: number;
  description: string;
  color: string;
}

function extractUsername(input: string): string | null {
  const cleaned = input.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const match = cleaned.match(/^calendly\.com\/([a-z0-9_-]+)/i);
  return match ? match[1] : null;
}

function parseEventTypes(html: string): LegacyCalendlyEvent[] {
  const events: LegacyCalendlyEvent[] = [];
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const profile = nextData?.props?.pageProps?.profile;
      const eventTypes: unknown[] = profile?.event_types ?? nextData?.props?.pageProps?.eventTypes ?? [];
      for (const et of eventTypes) {
        const e = et as Record<string, unknown>;
        const name = (e.name ?? e.title ?? "") as string;
        const desc = (e.description_plain ?? e.description ?? "") as string;
        let duration = 30;
        if (typeof e.duration === "number") duration = e.duration;
        else if (e.duration_minutes && typeof e.duration_minutes === "number") duration = e.duration_minutes;
        const color = (e.color ?? "#10b981") as string;
        if (name) events.push({ name, duration_minutes: duration, description: desc.slice(0, 500), color });
      }
      if (events.length) return events;
    } catch {
      // fall through
    }
  }

  const durationPattern = /(\d+)\s*(?:min(?:utes?)?|hr?s?)/gi;
  const headingPattern = /<h[23][^>]*>([^<]{3,80})<\/h[23]>/gi;
  let m: RegExpExecArray | null;
  const names: string[] = [];
  const durations: number[] = [];

  while ((m = headingPattern.exec(html)) !== null) names.push(m[1].trim());
  while ((m = durationPattern.exec(html)) !== null) {
    let n = parseInt(m[1]);
    if (/hr?/i.test(m[0])) n *= 60;
    durations.push(n);
  }

  const count = Math.min(names.length, durations.length, 6);
  for (let i = 0; i < count; i++) {
    events.push({ name: names[i], duration_minutes: durations[i], description: "", color: "#10b981" });
  }
  return events;
}

async function publicScrape(username: string): Promise<LegacyCalendlyEvent[]> {
  let events: LegacyCalendlyEvent[] = [];

  try {
    const apiResp = await fetch(`https://calendly.com/api/booking/profiles/${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PinOnIt/1.0)",
        Accept: "application/json",
      },
    });
    if (apiResp.ok) {
      const apiData = await apiResp.json() as Record<string, unknown>;
      const eventTypes = (apiData?.event_types ?? []) as Array<Record<string, unknown>>;
      for (const et of eventTypes) {
        const name = (et.name ?? et.title ?? "") as string;
        const desc = (et.description_plain ?? et.description ?? "") as string;
        let duration = 30;
        if (typeof et.duration === "number") duration = et.duration;
        const color = (et.color ?? "#10b981") as string;
        if (name) events.push({ name, duration_minutes: duration, description: String(desc).slice(0, 500), color });
      }
    }
  } catch {
    // try HTML
  }

  if (!events.length) {
    const pageResp = await fetch(`https://calendly.com/${username}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!pageResp.ok) {
      throw new Error(`Could not reach calendly.com/${username}. Make sure the profile is public.`);
    }
    events = parseEventTypes(await pageResp.text());
  }

  if (!events.length) {
    events = [
      { name: "30 Minute Meeting", duration_minutes: 30, description: "", color: "#10b981" },
      { name: "1 Hour Meeting", duration_minutes: 60, description: "", color: "#3b82f6" },
    ];
  }

  return events;
}

function legacyToRich(events: LegacyCalendlyEvent[]): CalendlyImportEvent[] {
  return events.map((e) => ({
    ...e,
    location_type: "video" as const,
    location: "",
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    is_active: true,
    calendly_slug: null,
    calendly_event_type_uri: null,
    booking_method: null,
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const body = await req.json() as { url?: string; action?: string };

    // Authenticated status check (OAuth connected?)
    if (body.action === "status") {
      if (!authHeader) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: row } = await admin
        .from("integrations")
        .select("provider_slug, provider_account_name")
        .eq("host_id", user.id)
        .eq("provider", "calendly")
        .maybeSingle();
      return new Response(
        JSON.stringify({
          connected: !!row,
          username: row?.provider_slug ?? null,
          account_name: row?.provider_account_name ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OAuth import path — requires authenticated user + stored token
    if (authHeader) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();

      if (user) {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: integration } = await admin
          .from("integrations")
          .select("id, host_id, access_token, refresh_token, expires_at")
          .eq("host_id", user.id)
          .eq("provider", "calendly")
          .maybeSingle();

        if (integration) {
          const clientId = Deno.env.get("CALENDLY_CLIENT_ID");
          const clientSecret = Deno.env.get("CALENDLY_CLIENT_SECRET");
          if (!clientId || !clientSecret) {
            return new Response(JSON.stringify({ error: "Calendly OAuth not configured on server." }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const imported = await fetchCalendlyImportViaOAuth(
            admin,
            integration,
            clientId,
            clientSecret
          );

          return new Response(JSON.stringify(imported), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Public scrape fallback
    const { url } = body;
    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const username = extractUsername(url);
    if (!username) {
      return new Response(
        JSON.stringify({ error: "Could not extract a username from that URL. Use the format: calendly.com/yourname" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const events = legacyToRich(await publicScrape(username));

    return new Response(
      JSON.stringify({
        source: "scrape",
        username,
        oauth_recommended: true,
        oauth_banner:
          "Connect your Calendly account to import your full schedule, availability, and meeting links.",
        profile: null,
        availability: [],
        events,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
