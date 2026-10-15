import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  applyStripeSubscription,
  isRealStripeCustomerId,
  resolveUserId,
  writeProfilePlanFromStripe,
} from '../_shared/stripeSubscription.ts';
import { collectedBasisCents, commissionCents } from '../_shared/creatorProgram.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not set');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deno/Web Crypto requires the async verifier (sync constructEvent always 400s).
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    const syncFromSubscription = async (
      subscription: Stripe.Subscription,
      extras?: {
        clientReferenceId?: string | null;
        metadataUserId?: string | null;
        email?: string | null;
      }
    ) => {
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
      if (!customerId) return;

      const userId = await resolveUserId({
        supabase,
        stripe,
        customerId,
        clientReferenceId: extras?.clientReferenceId,
        metadataUserId: extras?.metadataUserId ?? subscription.metadata?.supabase_user_id,
        email: extras?.email,
      });
      if (!userId) {
        console.error('stripe-webhook: could not resolve user for subscription', subscription.id);
        return;
      }

      await applyStripeSubscription({
        supabase,
        userId,
        customerId,
        subscription,
      });
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        if (!subscriptionId) {
          console.error('stripe-webhook: checkout.session.completed missing subscription', session.id);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        });
        const email = session.customer_details?.email ?? session.customer_email;
        await syncFromSubscription(subscription, {
          clientReferenceId: session.client_reference_id,
          metadataUserId: session.metadata?.supabase_user_id,
          email,
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncFromSubscription(subscription);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
          parent?: { subscription_details?: { subscription?: string } };
        };
        const rawSub = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof rawSub === 'string' ? rawSub : rawSub?.id;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        });
        await syncFromSubscription(subscription, {
          email: invoice.customer_email,
        });
        await noteCreatorInvoice(supabase, subscription, invoice, event.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id;

        const userId = await resolveUserId({
          supabase,
          stripe,
          customerId,
          metadataUserId: subscription.metadata?.supabase_user_id,
        });

        if (userId) {
          await supabase
            .from('subscriptions')
            .update({
              plan: 'expired',
              status: 'canceled',
              stripe_subscription_id: null,
              stripe_price_id: null,
            })
            .eq('user_id', userId);
          await writeProfilePlanFromStripe(supabase, userId, 'expired');
        } else if (isRealStripeCustomerId(customerId ?? null)) {
          await supabase
            .from('subscriptions')
            .update({
              plan: 'expired',
              status: 'canceled',
              stripe_subscription_id: null,
              stripe_price_id: null,
            })
            .eq('stripe_subscription_id', subscription.id);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const invoiceRef = (charge as Stripe.Charge & { invoice?: string | { id?: string } | null }).invoice;
        const invoiceId = typeof invoiceRef === 'string' ? invoiceRef : invoiceRef?.id;
        const refund = charge.refunds?.data?.[0];
        if (invoiceId && refund) {
          await noteCreatorReversal(supabase, {
            eventId: event.id,
            invoiceId,
            kind: 'refund',
            refundId: refund.id,
            refundCents: refund.amount,
            chargeCents: charge.amount,
          });
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
        if (chargeId) {
          try {
            const charge = await stripe.charges.retrieve(chargeId);
            const invoiceRef = (charge as Stripe.Charge & { invoice?: string | { id?: string } | null }).invoice;
            const invoiceId = typeof invoiceRef === 'string' ? invoiceRef : invoiceRef?.id;
            if (invoiceId) {
              await noteCreatorReversal(supabase, {
                eventId: event.id,
                invoiceId,
                kind: 'dispute',
                refundId: null,
                refundCents: dispute.amount,
                chargeCents: charge.amount,
              });
            }
          } catch (err) {
            console.error('creator dispute lookup', err);
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stripe-webhook error', message);
    // Signature / payload verification failures → 400 (Stripe should not retry forever with bad secret).
    // Unexpected processing bugs after a valid event → 200 so Stripe does not disable the endpoint.
    const isVerifyFailure =
      /signature|No signatures|Invalid signature|Webhook payload|constructEvent|SubtleCrypto/i.test(message);
    const status = isVerifyFailure ? 400 : 200;
    return new Response(JSON.stringify({ error: message, received: !isVerifyFailure }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function noteCreatorInvoice(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  invoice: Stripe.Invoice,
  eventId: string,
) {
  try {
    const creatorId = subscription.metadata?.creator_id;
    if (!creatorId || !invoice.id) return;
    const { data: settings, error } = await supabase
      .from('creator_program_settings')
      .select('status, commission_bps, hold_days')
      .eq('id', 1)
      .maybeSingle();
    if (error || !settings || settings.status !== 'active') return;
    const paid = invoice.amount_paid ?? 0;
    const tax = (invoice as Stripe.Invoice & { tax?: number | null }).tax ?? 0;
    const basis = collectedBasisCents(paid, tax);
    const amount = commissionCents(basis, settings.commission_bps);
    if (amount <= 0) return;
    const available = new Date(Date.now() + Number(settings.hold_days) * 86_400_000).toISOString();
    await supabase.rpc('record_creator_commission', {
      p_creator_id: creatorId,
      p_event_id: eventId,
      p_invoice_id: invoice.id,
      p_kind: 'earn',
      p_basis_cents: basis,
      p_amount_cents: amount,
      p_rate_bps: settings.commission_bps,
      p_refund_id: null,
      p_available_at: available,
    });
  } catch (err) {
    console.error('creator commission', err);
  }
}

async function noteCreatorReversal(
  supabase: ReturnType<typeof createClient>,
  input: {
    eventId: string;
    invoiceId: string;
    kind: 'refund' | 'dispute';
    refundId: string | null;
    refundCents: number;
    chargeCents: number;
  },
) {
  try {
    await supabase.rpc('apply_creator_reversal', {
      p_event_id: input.eventId,
      p_invoice_id: input.invoiceId,
      p_kind: input.kind,
      p_refund_id: input.refundId,
      p_refund_cents: input.refundCents,
      p_charge_cents: input.chargeCents,
    });
  } catch (err) {
    console.error('creator reversal', err);
  }
}

