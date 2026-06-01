import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PAYPAL_BASE = Deno.env.get("PAYPAL_SANDBOX") === "true"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

async function getPayPalToken(clientId: string, clientSecret: string): Promise<string> {
  const resp = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error_description ?? "PayPal auth failed");
  return data.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, service_id, order_id } = body as {
      action: string;
      service_id?: string;
      order_id?: string;
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const globalClientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
    const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
    const currency = "USD";

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (service_id && !UUID_RE.test(service_id)) {
      return new Response(JSON.stringify({ error: "Invalid service_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "capture" && order_id && !/^[A-Z0-9]{17}$/.test(order_id)) {
      return new Response(JSON.stringify({ error: "Invalid order_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return the public client ID so the frontend can load the PayPal JS SDK
    if (action === "get_client_id") {
      let clientId = globalClientId;
      if (service_id) {
        const svcResp = await fetch(
          `${supabaseUrl}/rest/v1/services?id=eq.${service_id}&select=paypal_client_id`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
        );
        const [svc] = await svcResp.json();
        if (svc?.paypal_client_id) clientId = svc.paypal_client_id;
      }
      return new Response(JSON.stringify({ client_id: clientId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!service_id) {
      return new Response(JSON.stringify({ error: "service_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch service details
    const svcResp = await fetch(
      `${supabaseUrl}/rest/v1/services?id=eq.${service_id}&select=price_cents,paypal_currency,paypal_client_id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const [svc] = await svcResp.json();
    if (!svc) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = svc.paypal_client_id ?? globalClientId;
    const resolvedCurrency = svc.paypal_currency ?? currency;
    const amount = ((svc.price_cents as number) / 100).toFixed(2);

    const token = await getPayPalToken(clientId, clientSecret);

    if (action === "create") {
      const resp = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: { currency_code: resolvedCurrency, value: amount },
          }],
        }),
      });
      const order = await resp.json();
      if (!resp.ok) throw new Error(order.message ?? "Failed to create PayPal order");
      return new Response(JSON.stringify({ order_id: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "capture") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "Missing order_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resp = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${order_id}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const capture = await resp.json();
      if (!resp.ok) throw new Error(capture.message ?? "Failed to capture PayPal order");
      const status = capture.status as string;
      const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? order_id;
      return new Response(JSON.stringify({ status, capture_id: captureId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
