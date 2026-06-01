import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedSlot {
  date: string;        // YYYY-MM-DD
  start_time: string;  // HH:MM (24h)
  end_time: string;    // HH:MM (24h)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { response, timeframe } = await req.json() as {
      response: string;
      timeframe: { start: string; end: string };
    };

    if (!response || !timeframe) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: response, timeframe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an availability parser. Extract specific time slots from natural language availability responses.
The meeting is being coordinated within this timeframe: ${timeframe.start} to ${timeframe.end}.
Return ONLY valid JSON matching this schema: {"slots": [{"date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM"}]}
- Use 24-hour time format
- If someone says "morning" assume 9:00-12:00; "afternoon" assume 12:00-17:00; "evening" assume 17:00-20:00
- If only a start time is given, infer a 1-hour window
- If dates are relative (tomorrow, next Monday), resolve them based on the timeframe provided
- Only include slots that fall within the given timeframe
- If no valid slots can be extracted, return {"slots": []}
- Do NOT include any explanation, only the JSON`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: response }],
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error("Anthropic API error:", err);
      return new Response(
        JSON.stringify({ error: "AI parsing failed", slots: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.content?.[0]?.text ?? "{}";

    let slots: ParsedSlot[] = [];
    try {
      const parsed = JSON.parse(rawText);
      slots = Array.isArray(parsed.slots) ? parsed.slots : [];
    } catch {
      console.error("Failed to parse AI JSON response:", rawText);
    }

    return new Response(
      JSON.stringify({ slots }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in parse-availability:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", slots: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
