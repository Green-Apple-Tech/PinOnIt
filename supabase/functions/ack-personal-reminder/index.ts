import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json() as { token?: string };
    const token = (body.token ?? "").trim();
    if (!UUID.test(token)) return json({ error: "That link is not valid." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: existing } = await admin
      .from("personal_reminders")
      .select("id, title, status, acknowledged_at")
      .eq("ack_token", token)
      .maybeSingle();
    if (!existing) return json({ error: "That reminder was not found." }, 404);
    if (existing.acknowledged_at || existing.status === "done") {
      return json({ ok: true, already: true, title: existing.title });
    }

    const { error } = await admin
      .from("personal_reminders")
      .update({ acknowledged_at: new Date().toISOString(), status: "done" })
      .eq("id", existing.id);
    if (error) return json({ error: "Could not mark that done." }, 500);
    return json({ ok: true, title: existing.title });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
