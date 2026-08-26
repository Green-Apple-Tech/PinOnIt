import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { loadAuthorizedBooking } from '../_shared/bookingCaller.ts';
import {
  bookingCalendarPayload,
  deleteExternalCalendarEvents,
  parseExternalRefs,
  personalReminderPayload,
  resolveBookingCalendarIds,
  updateExternalCalendarEvents,
  writeEventToCalendars,
  loadWritableCalendars,
} from '../_shared/calendar-write.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isServiceRole(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return !!key && auth === `Bearer ${key}`;
}

async function getUserIdFromJwt(req: Request): Promise<string | null> {
  if (isServiceRole(req)) return null;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json() as {
      action?: 'create' | 'update' | 'delete';
      kind?: 'booking' | 'personal_reminder';
      booking_id?: string;
      host_id?: string;
      action_token?: string;
      personal_reminder_id?: string;
      add_to_calendar?: boolean;
    };

    const action = body.action ?? 'create';
    const kind = body.kind ?? 'booking';

    if (kind === 'booking' && body.booking_id) {
      const hostId = body.host_id;
      if (!hostId) return json({ error: 'host_id required' }, 400);

      const jwtUser = await getUserIdFromJwt(req);
      if (body.action_token) {
        const auth = await loadAuthorizedBooking(supabase, body.booking_id, hostId, body.action_token);
        if ('error' in auth) return json({ error: auth.error }, auth.status);
      } else if (isServiceRole(req)) {
        // Internal edge → edge (booking-reply, complete-reschedule)
      } else if (!jwtUser || jwtUser !== hostId) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const { data: booking } = await supabase
        .from('bookings')
        .select('*, services(name, location)')
        .eq('id', body.booking_id)
        .eq('host_id', hostId)
        .maybeSingle();

      if (!booking) return json({ error: 'Booking not found' }, 404);

      const existingRefs = parseExternalRefs(booking.external_calendar_events);

      if (action === 'delete') {
        await deleteExternalCalendarEvents(supabase, hostId, existingRefs);
        await supabase.from('bookings').update({ external_calendar_events: [] }).eq('id', body.booking_id);
        return json({ success: true, deleted: existingRefs.length });
      }

      const payload = bookingCalendarPayload({
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        start_time: booking.start_time,
        end_time: booking.end_time,
        meet_link: booking.meet_link,
        notes: booking.notes,
        services: booking.services as { name?: string; location?: string | null } | null,
      });

      // Idempotent: create/update both patch existing provider events to avoid orphans
      if (existingRefs.length > 0) {
        await updateExternalCalendarEvents(supabase, hostId, existingRefs, payload);
        return json({ success: true, updated: existingRefs.length });
      }

      const calendarIds = await resolveBookingCalendarIds(supabase, hostId, booking.service_id);
      if (calendarIds.length === 0) {
        return json({ success: true, written: 0, reason: 'no_calendars' });
      }

      const refs = await writeEventToCalendars(supabase, hostId, calendarIds, payload);
      await supabase.from('bookings').update({ external_calendar_events: refs }).eq('id', body.booking_id);
      return json({ success: true, written: refs.length, refs });
    }

    if (kind === 'personal_reminder' && body.personal_reminder_id) {
      const jwtUser = await getUserIdFromJwt(req);
      if (!jwtUser) return json({ error: 'Unauthorized' }, 401);

      const { data: reminder } = await supabase
        .from('personal_reminders')
        .select('*')
        .eq('id', body.personal_reminder_id)
        .eq('host_id', jwtUser)
        .maybeSingle();

      if (!reminder) return json({ error: 'Reminder not found' }, 404);

      const shouldWrite = body.add_to_calendar !== false;
      const existingRefs = parseExternalRefs(reminder.external_calendar_events);

      if (action === 'delete' || !shouldWrite) {
        if (existingRefs.length) {
          await deleteExternalCalendarEvents(supabase, jwtUser, existingRefs);
          await supabase.from('personal_reminders').update({ external_calendar_events: [] }).eq('id', reminder.id);
        }
        return json({ success: true, deleted: existingRefs.length });
      }

      const payload = personalReminderPayload({ title: reminder.title, due_at: reminder.due_at });
      const cals = await loadWritableCalendars(supabase, jwtUser, null, 'reminders');
      const calendarIds = cals.map((c) => c.id);

      if (calendarIds.length === 0) {
        return json({ success: true, written: 0, reason: 'no_calendars' });
      }

      if (existingRefs.length > 0) {
        await updateExternalCalendarEvents(supabase, jwtUser, existingRefs, payload);
        return json({ success: true, updated: existingRefs.length });
      }

      const refs = await writeEventToCalendars(supabase, jwtUser, calendarIds, payload, 'reminders');
      await supabase.from('personal_reminders').update({ external_calendar_events: refs }).eq('id', reminder.id);
      return json({ success: true, written: refs.length, refs });
    }

    return json({ error: 'Invalid request' }, 400);
  } catch (err) {
    console.error('[write-calendar-event]', err);
    return json({ error: (err as Error).message }, 500);
  }
});
