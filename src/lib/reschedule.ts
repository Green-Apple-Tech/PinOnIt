import type { Profile, Service } from './types';

export type RescheduleBlockReason = 'expired' | 'used' | 'cutoff' | 'not_found' | 'not_allowed';

export interface RescheduleContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  slug?: string | null;
}

export interface RescheduleSession {
  token: string;
  bookingId: string;
  host: Profile;
  service: Service;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestTimezone?: string;
}

export const RESCHEDULE_BLOCK_COPY: Record<RescheduleBlockReason, string> = {
  expired: 'This reschedule link has expired.',
  used: 'This reschedule link was already used.',
  cutoff: 'It is too close to the appointment to change the time online.',
  not_found: 'This reschedule link is not valid.',
  not_allowed: 'This appointment cannot be rescheduled online.',
};
