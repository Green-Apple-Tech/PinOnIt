import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { publicBusyWindow } from './queryWindow';

/**
 * Live guest-path smoke: the public book / action / poll RPCs as anon.
 * Unit tests historically ran as a signed-in host, which hid the RLS break.
 *
 * Runs only when URL + anon key + service role are set (local .env or CI secrets).
 * Seeds a throwaway host, then deletes it — does not book on a real business.
 */
const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  '';
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const required = process.env.GUEST_SMOKE_REQUIRED === '1';
const enabled = Boolean(url && anonKey && serviceKey);

if (required && !enabled) {
  throw new Error(
    'Guest smoke is required but VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are not all set.',
  );
}

const SMOKE_EMAIL_PREFIX = 'pinonit.guest-smoke.';
const AUTH_OPTS = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

function asRecord(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') return JSON.parse(data) as Record<string, unknown>;
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  throw new Error(`expected JSON object, got ${typeof data}`);
}

describe.skipIf(!enabled)('guest paths as anonymous client', () => {
  let admin: SupabaseClient;
  let guest: SupabaseClient;
  let hostId = '';
  let serviceId = '';
  let pollId = '';
  let slotId = '';
  let bookingId = '';
  let actionToken = '';
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const hostEmail = `${SMOKE_EMAIL_PREFIX}${runId}@example.com`;
  const hostPassword = `Smk-${runId}-Aa1!`;
  const guestEmail = `${SMOKE_EMAIL_PREFIX}invitee.${runId}@example.com`;
  const start = new Date(Date.now() + 21 * 86400000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  async function sweepOrphanSmokeHosts() {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: leftovers } = await admin
      .from('profiles')
      .select('id')
      .like('email', `${SMOKE_EMAIL_PREFIX}%`)
      .lt('created_at', cutoff);
    for (const row of leftovers ?? []) {
      await admin.auth.admin.deleteUser(row.id);
    }
  }

  beforeAll(async () => {
    admin = createClient(url, serviceKey, { auth: AUTH_OPTS });
    guest = createClient(url, anonKey, { auth: AUTH_OPTS });
    await sweepOrphanSmokeHosts();

    const created = await admin.auth.admin.createUser({
      email: hostEmail,
      password: hostPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Guest Smoke Host' },
    });
    if (created.error || !created.data.user) {
      throw new Error(`smoke host create failed: ${created.error?.message}`);
    }
    hostId = created.data.user.id;

    const { error: planErr } = await admin
      .from('profiles')
      .update({ plan_override: 'pro', plan: 'pro' })
      .eq('id', hostId);
    if (planErr) throw new Error(`smoke host plan: ${planErr.message}`);

    const { data: service, error: svcErr } = await admin
      .from('services')
      .insert({
        host_id: hostId,
        name: 'Guest smoke 30m',
        duration_minutes: 30,
        is_active: true,
        price_cents: 0,
      })
      .select('id')
      .single();
    if (svcErr || !service) throw new Error(`smoke service: ${svcErr?.message}`);
    serviceId = service.id;

    const { data: poll, error: pollErr } = await admin
      .from('meeting_polls')
      .insert({
        host_id: hostId,
        title: 'Guest smoke poll',
        duration_minutes: 30,
        status: 'open',
      })
      .select('id')
      .single();
    if (pollErr || !poll) throw new Error(`smoke poll: ${pollErr?.message}`);
    pollId = poll.id;

    const { data: slot, error: slotErr } = await admin
      .from('meeting_poll_slots')
      .insert({
        poll_id: pollId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      })
      .select('id')
      .single();
    if (slotErr || !slot) throw new Error(`smoke poll slot: ${slotErr?.message}`);
    slotId = slot.id;
  }, 60_000);

  afterAll(async () => {
    if (hostId) {
      await admin.auth.admin.deleteUser(hostId);
    }
  }, 30_000);

  it('has no auth session on the guest client', async () => {
    const { data } = await guest.auth.getSession();
    expect(data.session).toBeNull();
  });

  it('creates a booking via create_guest_booking without signing in', async () => {
    const { data, error } = await guest.rpc('create_guest_booking', {
      p_payload: {
        service_id: serviceId,
        host_id: hostId,
        guest_name: 'Smoke Guest',
        guest_email: guestEmail,
        guest_phone: null,
        guest_address: null,
        notify_via: null,
        guest_timezone: 'America/New_York',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: 'guest-path smoke',
        is_recurring: false,
        recurrence_frequency: null,
        reminder_channels: ['email'],
        reminder_times: [],
        stripe_payment_id: null,
      },
    });
    expect(error, error?.message).toBeNull();
    const row = asRecord(data);
    expect(row.id).toEqual(expect.any(String));
    expect(row.action_token).toEqual(expect.any(String));
    bookingId = String(row.id);
    actionToken = String(row.action_token);

    const { data: leaked } = await guest.from('bookings').select('id').eq('id', bookingId).maybeSingle();
    expect(leaked).toBeNull();

    const host = createClient(url, anonKey, { auth: AUTH_OPTS });
    const { error: signErr } = await host.auth.signInWithPassword({
      email: hostEmail,
      password: hostPassword,
    });
    expect(signErr, signErr?.message).toBeNull();
    const { data: asHost } = await host.from('bookings').select('id').eq('id', bookingId).maybeSingle();
    expect(asHost?.id).toBe(bookingId);
    await host.auth.signOut();
    const { data: stillGuest } = await guest.auth.getSession();
    expect(stillGuest.session).toBeNull();
  }, 30_000);

  it('loads public busy times as anon and sees that booking', async () => {
    const { from, to } = publicBusyWindow();
    const { data, error } = await guest.rpc('get_public_busy_times', {
      p_host_id: hostId,
      p_from: from,
      p_to: to,
    });
    expect(error, error?.message).toBeNull();
    const payload = asRecord(data);
    const bookings = (payload.bookings ?? []) as { id: string; status: string }[];
    expect(bookings.some((b) => b.id === bookingId && b.status === 'confirmed')).toBe(true);
    expect(Array.isArray(payload.events)).toBe(true);
  }, 30_000);

  it('opens the booking-action token page as anon', async () => {
    const { data, error } = await guest.rpc('get_booking_for_guest_action', {
      p_booking_id: bookingId,
      p_action_token: actionToken,
    });
    expect(error, error?.message).toBeNull();
    const row = asRecord(data);
    expect(row.id).toBe(bookingId);
    expect(row.action_token).toBe(actionToken);
    expect(row.status).toBe('confirmed');

    const { data: rejected } = await guest.rpc('get_booking_for_guest_action', {
      p_booking_id: bookingId,
      p_action_token: 'not-the-token',
    });
    expect(rejected).toBeNull();
  }, 30_000);

  it('loads an open poll and submits a vote as anon', async () => {
    const { data: pollRow, error: pollErr } = await guest
      .from('meeting_polls')
      .select('id, title, status')
      .eq('id', pollId)
      .maybeSingle();
    expect(pollErr, pollErr?.message).toBeNull();
    expect(pollRow?.status).toBe('open');

    const { data: slots, error: slotErr } = await guest
      .from('meeting_poll_slots')
      .select('id')
      .eq('poll_id', pollId);
    expect(slotErr, slotErr?.message).toBeNull();
    expect(slots?.some((s) => s.id === slotId)).toBe(true);

    const { data, error } = await guest.rpc('submit_meeting_poll_response', {
      p_poll_id: pollId,
      p_name: 'Smoke Voter',
      p_email: guestEmail,
      p_slot_ids: [slotId],
    });
    expect(error, error?.message).toBeNull();
    const response = asRecord(data);
    expect(response.poll_id).toBe(pollId);
    expect(String(response.invitee_email).toLowerCase()).toBe(guestEmail.toLowerCase());

    const { data: tally, error: tallyErr } = await guest.rpc('get_meeting_poll_tally', {
      p_poll_id: pollId,
    });
    expect(tallyErr, tallyErr?.message).toBeNull();
    const tallyRow = asRecord(tally);
    expect(Number(tallyRow.total_responses)).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
