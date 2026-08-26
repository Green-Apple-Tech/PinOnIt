import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { hostRowIsActive, type ProfilePlanRow, type SubscriptionPlanRow } from './planAccess.ts';

/** Host may send reminders and accept bookings. */
export async function hostPlanIsActive(
  supabase: SupabaseClient,
  hostId: string,
): Promise<boolean> {
  const active = await loadActiveHostIds(supabase, [hostId]);
  return active.has(hostId);
}

/** Batch plan check — one query pair instead of N RPC calls. */
export async function loadActiveHostIds(
  supabase: SupabaseClient,
  hostIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(hostIds.filter(Boolean))];
  if (!unique.length) return new Set();

  const [{ data: profiles, error: pErr }, { data: subs, error: sErr }] = await Promise.all([
    supabase.from('profiles').select('id, plan, plan_override').in('id', unique),
    supabase
      .from('subscriptions')
      .select('user_id, plan, status, trial_ends_at, stripe_current_period_end, stripe_customer_id, stripe_subscription_id, updated_at')
      .in('user_id', unique),
  ]);

  if (pErr) console.error('loadActiveHostIds profiles:', pErr.message);
  if (sErr) console.error('loadActiveHostIds subscriptions:', sErr.message);

  const subsByUser = new Map<string, SubscriptionPlanRow[]>();
  for (const row of subs ?? []) {
    const uid = row.user_id as string;
    const list = subsByUser.get(uid) ?? [];
    list.push(row);
    subsByUser.set(uid, list);
  }

  const active = new Set<string>();
  for (const profile of (profiles ?? []) as (ProfilePlanRow & { id: string })[]) {
    if (hostRowIsActive(profile, subsByUser.get(profile.id))) {
      active.add(profile.id);
    }
  }
  return active;
}

/** Expire local trials before dispatch loops. */
export async function expireStaleTrials(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc('expire_stale_trials');
  if (error) console.error('expire_stale_trials failed:', error.message);
}
