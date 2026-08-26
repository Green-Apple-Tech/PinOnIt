import {
  ensureCalendarAccessToken,
  type ConnectedCalendarRow,
} from './calendar-tokens.ts';

export type ExternalCalendarEventRef = {
  connected_calendar_id: string;
  provider: 'google' | 'outlook';
  provider_event_id: string;
};

export type CalendarEventPayload = {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  guest_email?: string | null;
  guest_name?: string | null;
  location?: string | null;
  meet_link?: string | null;
};

function googleCalendarId(cal: ConnectedCalendarRow): string {
  return cal.calendar_id?.trim() || 'primary';
}

async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  payload: CalendarEventPayload,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    summary: payload.title,
    description: [payload.description, payload.meet_link ? `Join: ${payload.meet_link}` : '']
      .filter(Boolean)
      .join('\n\n'),
    start: { dateTime: payload.start_time, timeZone: 'UTC' },
    end: { dateTime: payload.end_time, timeZone: 'UTC' },
  };
  if (payload.location) body.location = payload.location;
  if (payload.guest_email) {
    body.attendees = [{ email: payload.guest_email, displayName: payload.guest_name ?? undefined }];
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    console.error('[calendar-write] Google create failed:', res.status, await res.text());
    return null;
  }
  const data = await res.json() as { id?: string };
  return data.id ?? null;
}

async function createOutlookEvent(
  accessToken: string,
  payload: CalendarEventPayload,
): Promise<string | null> {
  const body = {
    subject: payload.title,
    body: {
      contentType: 'Text',
      content: [payload.description, payload.meet_link ? `Join: ${payload.meet_link}` : '']
        .filter(Boolean)
        .join('\n\n'),
    },
    start: { dateTime: payload.start_time.replace(/\.\d{3}Z$/, 'Z'), timeZone: 'UTC' },
    end: { dateTime: payload.end_time.replace(/\.\d{3}Z$/, 'Z'), timeZone: 'UTC' },
    location: payload.location ? { displayName: payload.location } : undefined,
  };

  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error('[calendar-write] Outlook create failed:', res.status, await res.text());
    return null;
  }
  const data = await res.json() as { id?: string };
  return data.id ?? null;
}

async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.ok || res.status === 404 || res.status === 410;
}

async function deleteOutlookEvent(accessToken: string, eventId: string): Promise<boolean> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok || res.status === 404;
}

async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  payload: CalendarEventPayload,
): Promise<boolean> {
  const body: Record<string, unknown> = {
    summary: payload.title,
    description: [payload.description, payload.meet_link ? `Join: ${payload.meet_link}` : '']
      .filter(Boolean)
      .join('\n\n'),
    start: { dateTime: payload.start_time, timeZone: 'UTC' },
    end: { dateTime: payload.end_time, timeZone: 'UTC' },
  };
  if (payload.location) body.location = payload.location;

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  return res.ok;
}

async function updateOutlookEvent(
  accessToken: string,
  eventId: string,
  payload: CalendarEventPayload,
): Promise<boolean> {
  const body = {
    subject: payload.title,
    body: {
      contentType: 'Text',
      content: [payload.description, payload.meet_link ? `Join: ${payload.meet_link}` : '']
        .filter(Boolean)
        .join('\n\n'),
    },
    start: { dateTime: payload.start_time.replace(/\.\d{3}Z$/, 'Z'), timeZone: 'UTC' },
    end: { dateTime: payload.end_time.replace(/\.\d{3}Z$/, 'Z'), timeZone: 'UTC' },
    location: payload.location ? { displayName: payload.location } : undefined,
  };

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function parseExternalRefs(raw: unknown): ExternalCalendarEventRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is ExternalCalendarEventRef =>
    !!r && typeof r === 'object' &&
    typeof (r as ExternalCalendarEventRef).connected_calendar_id === 'string' &&
    ((r as ExternalCalendarEventRef).provider === 'google' || (r as ExternalCalendarEventRef).provider === 'outlook') &&
    typeof (r as ExternalCalendarEventRef).provider_event_id === 'string'
  );
}

// deno-lint-ignore no-explicit-any
export async function loadWritableCalendars(
  supabase: any,
  hostId: string,
  calendarIds: string[] | null | undefined,
  purpose: 'scheduling' | 'reminders',
): Promise<ConnectedCalendarRow[]> {
  const { data: all } = await supabase
    .from('connected_calendars')
    .select('id, host_id, provider, access_token, refresh_token, token_expires_at, calendar_id, sync_enabled, use_for_scheduling, use_for_reminders')
    .eq('host_id', hostId)
    .eq('sync_enabled', true)
    .in('provider', ['google', 'outlook']);

  const rows = (all ?? []) as ConnectedCalendarRow[];
  const purposeOk = (c: ConnectedCalendarRow) =>
    purpose === 'scheduling' ? c.use_for_scheduling !== false : c.use_for_reminders !== false;

  let filtered = rows.filter(purposeOk);
  if (calendarIds && calendarIds.length > 0) {
    const idSet = new Set(calendarIds);
    filtered = filtered.filter((c) => idSet.has(c.id));
  }
  return filtered;
}

// deno-lint-ignore no-explicit-any
export async function resolveBookingCalendarIds(
  supabase: any,
  hostId: string,
  serviceId: string | null,
): Promise<string[]> {
  if (!serviceId) {
    const cals = await loadWritableCalendars(supabase, hostId, null, 'scheduling');
    return cals.map((c) => c.id);
  }
  const { data: svc } = await supabase
    .from('services')
    .select('booking_calendar_ids')
    .eq('id', serviceId)
    .maybeSingle();
  const ids = (svc?.booking_calendar_ids as string[] | null) ?? [];
  if (ids.length === 0) {
    const cals = await loadWritableCalendars(supabase, hostId, null, 'scheduling');
    return cals.map((c) => c.id);
  }
  return ids;
}

// deno-lint-ignore no-explicit-any
export async function writeEventToCalendars(
  supabase: any,
  hostId: string,
  calendarIds: string[],
  payload: CalendarEventPayload,
  purpose: 'scheduling' | 'reminders' = 'scheduling',
): Promise<ExternalCalendarEventRef[]> {
  const calendars = await loadWritableCalendars(supabase, hostId, calendarIds, purpose);
  const refs: ExternalCalendarEventRef[] = [];

  for (const cal of calendars) {
    const token = await ensureCalendarAccessToken(supabase, cal);
    if (!token) continue;

    let eventId: string | null = null;
    if (cal.provider === 'google') {
      eventId = await createGoogleEvent(token, googleCalendarId(cal), payload);
      if (eventId) refs.push({ connected_calendar_id: cal.id, provider: 'google', provider_event_id: eventId });
    } else if (cal.provider === 'outlook') {
      eventId = await createOutlookEvent(token, payload);
      if (eventId) refs.push({ connected_calendar_id: cal.id, provider: 'outlook', provider_event_id: eventId });
    }
  }
  return refs;
}

// deno-lint-ignore no-explicit-any
export async function deleteExternalCalendarEvents(
  supabase: any,
  hostId: string,
  refs: ExternalCalendarEventRef[],
): Promise<void> {
  if (!refs.length) return;

  const { data: cals } = await supabase
    .from('connected_calendars')
    .select('id, host_id, provider, access_token, refresh_token, token_expires_at, calendar_id')
    .eq('host_id', hostId)
    .in('id', refs.map((r) => r.connected_calendar_id));

  const calMap = new Map((cals ?? []).map((c: ConnectedCalendarRow) => [c.id, c]));

  for (const ref of refs) {
    const cal = calMap.get(ref.connected_calendar_id);
    if (!cal) continue;
    const token = await ensureCalendarAccessToken(supabase, cal);
    if (!token) continue;

    if (ref.provider === 'google') {
      await deleteGoogleEvent(token, googleCalendarId(cal), ref.provider_event_id);
    } else if (ref.provider === 'outlook') {
      await deleteOutlookEvent(token, ref.provider_event_id);
    }
  }
}

// deno-lint-ignore no-explicit-any
export async function updateExternalCalendarEvents(
  supabase: any,
  hostId: string,
  refs: ExternalCalendarEventRef[],
  payload: CalendarEventPayload,
): Promise<void> {
  if (!refs.length) return;

  const { data: cals } = await supabase
    .from('connected_calendars')
    .select('id, host_id, provider, access_token, refresh_token, token_expires_at, calendar_id')
    .eq('host_id', hostId)
    .in('id', refs.map((r) => r.connected_calendar_id));

  const calMap = new Map((cals ?? []).map((c: ConnectedCalendarRow) => [c.id, c]));

  for (const ref of refs) {
    const cal = calMap.get(ref.connected_calendar_id);
    if (!cal) continue;
    const token = await ensureCalendarAccessToken(supabase, cal);
    if (!token) continue;

    if (ref.provider === 'google') {
      await updateGoogleEvent(token, googleCalendarId(cal), ref.provider_event_id, payload);
    } else if (ref.provider === 'outlook') {
      await updateOutlookEvent(token, ref.provider_event_id, payload);
    }
  }
}

export function bookingCalendarPayload(booking: {
  guest_name: string;
  guest_email?: string | null;
  start_time: string;
  end_time: string;
  meet_link?: string | null;
  notes?: string | null;
  services?: { name?: string; location?: string | null } | null;
}): CalendarEventPayload {
  const svcName = booking.services?.name ?? 'Meeting';
  return {
    title: `${svcName} with ${booking.guest_name}`,
    description: [
      `Guest: ${booking.guest_name}`,
      booking.guest_email ? `Email: ${booking.guest_email}` : '',
      booking.notes ? `Notes: ${booking.notes}` : '',
      'Scheduled via PinOnIt',
    ].filter(Boolean).join('\n'),
    start_time: booking.start_time,
    end_time: booking.end_time,
    guest_email: booking.guest_email,
    guest_name: booking.guest_name,
    location: booking.services?.location ?? null,
    meet_link: booking.meet_link ?? null,
  };
}

export function personalReminderPayload(reminder: {
  title: string;
  due_at: string;
}): CalendarEventPayload {
  const start = new Date(reminder.due_at);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    title: reminder.title,
    description: 'Personal reminder from PinOnIt',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  };
}

export { parseExternalRefs };
