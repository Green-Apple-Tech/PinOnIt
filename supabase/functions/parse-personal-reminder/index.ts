import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { transcript?: string; now?: string; timeZone?: string };
    const transcript = (body.transcript ?? "").trim().slice(0, 1000);
    if (!transcript) {
      return new Response(JSON.stringify({ error: "Missing transcript" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "AI is not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = body.now || new Date().toISOString();
    const timeZone = (body.timeZone || "America/New_York").slice(0, 80);
    const system = `You split a spoken personal reminder into JSON only. No markdown.
The speaker's current time is ${now}. Time zone: ${timeZone}.
Return exactly:
{"title":"short subject","location":"","date":"YYYY-MM-DD","time":"HH:MM","in_minutes":null,"extras":{"day_before":[],"hour_before":[],"ten_min":[]}}
Rules:
- title is a short subject such as "Dentist reminder" or "Stove is on", not the whole sentence.
- location is a place they named (office, address, clinic). Leave "" when they did not name a place. "with the dentist" is the subject, not a place.
- date and time are when the event happens, in the speaker's time zone. "today" is that calendar date. Use 24-hour HH:MM.
- "in 20 minutes" means the reminder is due 20 minutes after the current time. Set in_minutes to 20 and set date and time to that moment. Do not move it earlier.
- extras lists ONLY extra pings they asked to receive, on top of the usual ones. Do not repeat the usual plan.
- Usual plan (do not put these in extras unless they asked for a different channel at that time): email the day before, text 1 hour before, text 10 minutes before.
- "send me a quick reminder 10 min before" with no channel means ten_min sms.
- text / sms → sms. email → email. call me / voice → voice. whatsapp → whatsapp.
- timings are only day_before, hour_before, or ten_min. Map "10 minutes before" to ten_min, "an hour before" to hour_before, "the day before" to day_before.
- If a field is unknown, use "" for location and [] for that extra list. Still return date and time when you can.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: transcript }],
      }),
    });

    if (!aiResponse.ok) {
      return new Response(JSON.stringify({ error: "AI parsing failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await aiResponse.json();
    const text = payload?.content?.find((block: { type?: string }) => block.type === "text")?.text ?? "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < jsonStart) {
      return new Response(JSON.stringify({ error: "AI parsing failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
