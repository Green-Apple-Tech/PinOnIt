import { supabase } from './supabase';
import { isExamplePaidConsultation } from './eventTypes';
import {
  isPaidMenuPrice,
  paidBookingExampleInsertRows,
  type PaidBookingDemoService,
} from './paidBookingSuggestions';
import type { Service } from './types';

const seedingHosts = new Set<string>();

export async function ensurePaidBookingExamples(opts: {
  hostId: string;
  demos: PaidBookingDemoService[];
  storedExampleIds?: string[] | null;
}): Promise<{ inserted: Service[]; exampleIds: string[]; seeded: boolean }> {
  const { hostId, demos, storedExampleIds } = opts;
  if (seedingHosts.has(hostId)) {
    return { inserted: [], exampleIds: storedExampleIds ?? [], seeded: false };
  }
  seedingHosts.add(hostId);
  try {
    const { data: live } = await supabase
      .from('services')
      .select('id, name, duration_minutes, price_cents')
      .eq('host_id', hostId)
      .eq('is_active', true);

    const existing = (live ?? []) as {
      id: string;
      name: string;
      duration_minutes: number;
      price_cents: number | null;
    }[];

    const paid = existing.filter(
      (s) => isPaidMenuPrice(s.price_cents) && !isExamplePaidConsultation(s),
    );
    if (paid.length > 0) {
      return { inserted: [], exampleIds: storedExampleIds ?? [], seeded: false };
    }
    if (storedExampleIds && storedExampleIds.length > 0) {
      return { inserted: [], exampleIds: storedExampleIds, seeded: false };
    }

    const demoNames = new Set(
      demos.filter((d) => isPaidMenuPrice(d.price_cents)).map((d) => d.name.toLowerCase()),
    );
    const already = existing.filter((s) => demoNames.has(s.name.toLowerCase()) && isPaidMenuPrice(s.price_cents));
    const missingDemos = demos.filter(
      (d) =>
        isPaidMenuPrice(d.price_cents) &&
        !existing.some(
          (s) =>
            s.name.toLowerCase() === d.name.toLowerCase() &&
            s.duration_minutes === d.duration_minutes,
        ),
    );

    if (missingDemos.length === 0 && already.length > 0) {
      return { inserted: [], exampleIds: already.map((s) => s.id), seeded: false };
    }

    const rows = paidBookingExampleInsertRows(hostId, missingDemos.length > 0 ? missingDemos : demos);
    if (rows.length === 0) {
      return { inserted: [], exampleIds: already.map((s) => s.id), seeded: false };
    }

    const { data, error } = await supabase.from('services').insert(rows).select('*');
    if (error || !data?.length) {
      return { inserted: [], exampleIds: already.map((s) => s.id), seeded: false };
    }

    const inserted = data as Service[];
    return {
      inserted,
      exampleIds: [...already.map((s) => s.id), ...inserted.map((s) => s.id)],
      seeded: true,
    };
  } finally {
    seedingHosts.delete(hostId);
  }
}
