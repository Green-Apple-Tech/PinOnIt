import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const HARD_LIMITS = `
CRITICAL PRODUCT LIMITS (never contradict):
- Sign-by-Text / Doc Center: single-signature business documents only (waivers, NDAs, addendums, estimates, job sign-offs).
- NOT for: wills, trusts, powers of attorney, deeds, court filings, notarized instruments, multi-signer closings.
- Builds an evidentiary record (SMS verification, timestamps, confirmation/signature). Does NOT guarantee legal validity; not a law firm or notary.
- PDF uploads: clear, complete PDFs only, up to 5MB.
- Reminders do not send until the host enables them.
`;

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

    const body = await req.json() as {
      question?: string;
      pageTitle?: string;
      contextPack?: string;
    };

    const question = (body.question ?? "").trim().slice(0, 500);
    const contextPack = (body.contextPack ?? "").trim().slice(0, 12000);
    const pageTitle = (body.pageTitle ?? "PinOnIt").trim().slice(0, 120);

    if (!question || !contextPack) {
      return new Response(JSON.stringify({ error: "Missing question or context" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({
          answer:
            "Help chat is not configured yet. Use the How to tab for steps on this page.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const system = `You are PinOnIt's in-product help assistant for hosts.
Page: ${pageTitle}

RULES:
- Answer ONLY using the CONTEXT pack and CRITICAL PRODUCT LIMITS below.
- If the answer is not in context, say you do not know from the help notes and suggest the How to tab or a clearer question. Do not invent features, prices, or legal outcomes.
- Be short (2–6 sentences). Plain language. No markdown headings.
- Never give legal advice. Never claim documents are "legally binding" in all jurisdictions.
- Prefer concrete next steps (which menu / button) when explaining how to do something.

${HARD_LIMITS}

CONTEXT:
${contextPack}`;

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
        messages: [{ role: "user", content: question }],
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error("product-help-chat Anthropic error:", err);
      return new Response(
        JSON.stringify({
          answer:
            "I could not reach help chat just now. Open the How to tab for steps on this page.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = await aiResponse.json() as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const answer = payload.content?.find((c) => c.type === "text")?.text?.trim()
      || "I could not find that in the help notes. Try the How to tab.";

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("product-help-chat error:", e);
    return new Response(JSON.stringify({ error: "Help chat failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
