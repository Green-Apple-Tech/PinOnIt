import { supabase } from './supabase';

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/write-calendar-event`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };
}

/** Fire-and-forget: write booking using guest action_token (public book page). */
export function syncBookingToExternalCalendars(opts: {
  bookingId: string;
  hostId: string;
  actionToken?: string | null;
  action?: 'create' | 'update' | 'delete';
}) {
  void fetch(FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      kind: 'booking',
      action: opts.action ?? 'create',
      booking_id: opts.bookingId,
      host_id: opts.hostId,
      action_token: opts.actionToken ?? undefined,
    }),
  }).catch(() => {});
}

/** Fire-and-forget: host dashboard — uses signed-in session JWT. */
export async function syncBookingToExternalCalendarsAsHost(opts: {
  bookingId: string;
  hostId: string;
  action?: 'create' | 'update' | 'delete';
}) {
  const headers = await authHeaders();
  void fetch(FN, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind: 'booking',
      action: opts.action ?? 'create',
      booking_id: opts.bookingId,
      host_id: opts.hostId,
    }),
  }).catch(() => {});
}

/** Host-authenticated personal reminder calendar sync. */
export async function syncPersonalReminderToExternalCalendars(opts: {
  reminderId: string;
  addToCalendar: boolean;
  action?: 'create' | 'update' | 'delete';
}) {
  const headers = await authHeaders();
  await fetch(FN, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind: 'personal_reminder',
      action: opts.action ?? 'create',
      personal_reminder_id: opts.reminderId,
      add_to_calendar: opts.addToCalendar,
    }),
  });
}
