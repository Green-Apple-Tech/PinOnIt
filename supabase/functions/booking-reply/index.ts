import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { booking_id, action_token, action } = await req.json();
    if (!booking_id || !action_token || !action) {
      return jsonResponse({ error: 'Missing booking_id, action_token, or action' }, 400);
    }

    const validActions = ['confirm', 'cancel', 'reschedule'];
    if (!validActions.includes(action)) {
      return jsonResponse({ error: 'Invalid action. Use: confirm, cancel, reschedule' }, 400);
    }

    // Require both booking_id AND action_token to match — prevents enumeration
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, services(name), profiles(full_name, slug)')
      .eq('id', booking_id)
      .eq('action_token', action_token)
      .maybeSingle();

    if (!booking) {
      return jsonResponse({ error: 'Booking not found or invalid token' }, 404);
    }

    if (action === 'confirm') {
      await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', booking_id);

      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        await fetch(`${supabaseUrl}/functions/v1/write-calendar-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            kind: 'booking',
            action: 'create',
            booking_id,
            host_id: booking.host_id,
            action_token,
          }),
        });
      } catch (e) {
        console.error('[booking-reply] calendar write failed:', e);
      }

      return jsonResponse({
        success: true,
        message: 'Booking confirmed',
        booking_id,
        status: 'confirmed',
      });
    }

    if (action === 'cancel') {
      await supabase
        .from('bookings')
        .update({ status: 'canceled' })
        .eq('id', booking_id);

      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        await fetch(`${supabaseUrl}/functions/v1/write-calendar-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            kind: 'booking',
            action: 'delete',
            booking_id,
            host_id: booking.host_id,
            action_token,
          }),
        });
      } catch (e) {
        console.error('[booking-reply] calendar delete failed:', e);
      }

      return jsonResponse({
        success: true,
        message: 'Booking canceled',
        booking_id,
        status: 'canceled',
      });
    }

    if (action === 'reschedule') {
      const { data: token } = await supabase.rpc('ensure_reschedule_token', {
        p_booking_id: booking_id,
      });
      const baseUrl = (Deno.env.get('APP_URL') || 'https://pinonit.com').replace(/\/$/, '');
      const rescheduleUrl = token ? `${baseUrl}/r/${token}` : null;

      return jsonResponse({
        success: true,
        message: 'Please book a new time',
        booking_link: rescheduleUrl,
        reschedule_url: rescheduleUrl,
        old_booking_canceled: false,
      });
    }

    return jsonResponse({ error: 'Unhandled action' }, 400);
  } catch (err) {
    return jsonResponse({ error: 'An error occurred processing your request' }, 500);
  }
});
