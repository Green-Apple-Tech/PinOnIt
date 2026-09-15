import { documentsNewPath } from './documentActions';
import type { SmbDocumentType } from './types';

export const STANDING_HORIZON_DAYS = 90;

export type StandingFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type StandingJobStatus = 'active' | 'paused' | 'ended' | 'pending_host_confirmation' | 'declined';
export type StandingJobOrigin = 'host' | 'guest';

export type StandingJob = {
  id: string;
  host_id: string;
  service_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  frequency: StandingFrequency;
  interval_days: number | null;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  ends_at: string | null;
  occurrence_count: number | null;
  price_cents: number;
  notes: string;
  status: StandingJobStatus;
  origin?: StandingJobOrigin;
  first_booking_id?: string | null;
  sms_consent: boolean;
  whatsapp_consent: boolean;
  notify_via: string[] | null;
  reminder_channels: string[] | null;
  reminder_times: string[] | null;
  created_at: string;
  updated_at: string;
  services?: { name: string; duration_minutes: number } | null;
};

export function addStandingOccurrence(date: Date, frequency: StandingFrequency, intervalDays?: number | null): Date {
  const next = new Date(date);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'biweekly') next.setDate(next.getDate() + 14);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + Math.max(1, intervalDays ?? 1));
  return next;
}

export function standingOccurrenceStarts(opts: {
  startsAt: Date;
  frequency: StandingFrequency;
  intervalDays?: number | null;
  horizonEnd: Date;
  endsAt?: Date | null;
  occurrenceCount?: number | null;
  now?: Date;
}): Date[] {
  const now = opts.now ?? new Date();
  const dates: Date[] = [];
  let cur = new Date(opts.startsAt);
  let n = 0;
  while (n < 200 && cur.getTime() <= opts.horizonEnd.getTime()) {
    n += 1;
    if (opts.occurrenceCount != null && dates.length >= opts.occurrenceCount) break;
    if (opts.endsAt && cur.getTime() > opts.endsAt.getTime()) break;
    if (cur.getTime() >= now.getTime() - 60 * 60 * 1000) dates.push(new Date(cur));
    else if (opts.occurrenceCount != null) dates.push(new Date(cur));
    cur = addStandingOccurrence(cur, opts.frequency, opts.intervalDays);
  }
  return dates.filter((d) => d.getTime() >= now.getTime() - 60 * 60 * 1000);
}

export function formatStandingFrequency(frequency: StandingFrequency, intervalDays?: number | null): string {
  if (frequency === 'weekly') return 'Weekly';
  if (frequency === 'biweekly') return 'Every 2 weeks';
  if (frequency === 'monthly') return 'Monthly';
  const n = Math.max(1, intervalDays ?? 1);
  return n === 1 ? 'Every day' : `Every ${n} days`;
}

export function standingComposePath(
  type: Extract<SmbDocumentType, 'quote' | 'receipt'>,
  customer: { name?: string | null; phone?: string | null; email?: string | null },
): string {
  const base = documentsNewPath(null, type);
  const q = new URLSearchParams(base.split('?')[1] || '');
  if (customer.name?.trim()) q.set('name', customer.name.trim());
  if (customer.phone?.trim()) q.set('phone', customer.phone.trim());
  if (customer.email?.trim()) q.set('email', customer.email.trim());
  return `/dashboard/documents/new?${q.toString()}`;
}

export function nextStandingVisit(
  visits: { start_time: string; status: string }[],
  now = new Date(),
): { start_time: string; status: string } | null {
  const upcoming = visits
    .filter((v) => v.status === 'confirmed' && new Date(v.start_time).getTime() >= now.getTime())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  return upcoming[0] ?? null;
}
