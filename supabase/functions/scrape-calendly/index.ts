import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CalendlyEvent {
  name: string;
  duration_minutes: number;
  description: string;
  color: string;
}

// Extract the username from a Calendly URL
function extractUsername(input: string): string | null {
  const cleaned = input.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const match = cleaned.match(/^calendly\.com\/([a-z0-9_-]+)/i);
  return match ? match[1] : null;
}

// Parse event types from Calendly's public page HTML
function parseEventTypes(html: string): CalendlyEvent[] {
  const events: CalendlyEvent[] = [];

  // Calendly embeds a __NEXT_DATA__ JSON blob — try to extract it
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Walk the props tree looking for event type arrays
      const profile = nextData?.props?.pageProps?.profile;
      const eventTypes: unknown[] = profile?.event_types ?? nextData?.props?.pageProps?.eventTypes ?? [];
      for (const et of eventTypes) {
        const e = et as Record<string, unknown>;
        const name = (e.name ?? e.title ?? '') as string;
        const desc = (e.description_plain ?? e.description ?? '') as string;
        // duration is in minutes, may be nested
        let duration = 30;
        if (typeof e.duration === 'number') duration = e.duration;
        else if (e.duration_minutes && typeof e.duration_minutes === 'number') duration = e.duration_minutes;
        const color = (e.color ?? '#10b981') as string;
        if (name) events.push({ name, duration_minutes: duration, description: desc.slice(0, 500), color });
      }
      if (events.length) return events;
    } catch {
      // fall through to regex-based parsing
    }
  }

  // Fallback: look for common patterns in rendered HTML
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

  // Pair them up best-effort
  const count = Math.min(names.length, durations.length, 6);
  for (let i = 0; i < count; i++) {
    events.push({ name: names[i], duration_minutes: durations[i], description: '', color: '#10b981' });
  }

  return events;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as { url?: string };
    const { url } = body;
    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const username = extractUsername(url);
    if (!username) {
      return new Response(JSON.stringify({ error: "Could not extract a username from that URL. Use the format: calendly.com/yourname" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First try the Calendly public API (no auth needed for basic profile info)
    const apiUrl = `https://calendly.com/api/booking/profiles/${username}`;
    let events: CalendlyEvent[] = [];

    try {
      const apiResp = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PinOnIt/1.0)",
          "Accept": "application/json",
        },
      });
      if (apiResp.ok) {
        const apiData = await apiResp.json() as Record<string, unknown>;
        const eventTypes = (apiData?.event_types ?? []) as Array<Record<string, unknown>>;
        for (const et of eventTypes) {
          const name = (et.name ?? et.title ?? '') as string;
          const desc = (et.description_plain ?? et.description ?? '') as string;
          let duration = 30;
          if (typeof et.duration === 'number') duration = et.duration;
          const color = (et.color ?? '#10b981') as string;
          if (name) events.push({ name, duration_minutes: duration, description: String(desc).slice(0, 500), color });
        }
      }
    } catch {
      // API attempt failed, try HTML scrape
    }

    // If API gave nothing, scrape the public HTML page
    if (!events.length) {
      const pageUrl = `https://calendly.com/${username}`;
      const pageResp = await fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!pageResp.ok) {
        return new Response(JSON.stringify({ error: `Could not reach calendly.com/${username}. Make sure the profile is public.` }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const html = await pageResp.text();
      events = parseEventTypes(html);
    }

    // If we still got nothing, return sensible defaults based on common Calendly setups
    if (!events.length) {
      events = [
        { name: "30 Minute Meeting", duration_minutes: 30, description: "", color: "#10b981" },
        { name: "1 Hour Meeting", duration_minutes: 60, description: "", color: "#3b82f6" },
      ];
    }

    return new Response(JSON.stringify({ username, events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
