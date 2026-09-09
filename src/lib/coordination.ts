import { supabase } from './supabase';

export type CoordinationContextType = 'meeting' | 'showing' | 'consultation' | 'other';
export type CoordinationSchedulingMode = 'open_availability' | 'proposed_slots';
export type CoordinationResponseStatus = 'pending' | 'responded' | 'confirmed';

export const COORDINATION_CONTEXT_LABELS: Record<CoordinationContextType, string> = {
  meeting: 'Meeting',
  showing: 'Showing',
  consultation: 'Consultation',
  other: 'Meeting',
};

export function coordinationContextLabel(type: string | null | undefined): string {
  if (type === 'showing' || type === 'consultation' || type === 'meeting' || type === 'other') {
    return COORDINATION_CONTEXT_LABELS[type];
  }
  return COORDINATION_CONTEXT_LABELS.meeting;
}

export function coordinationPageUrl(token: string, origin = typeof window !== 'undefined' ? window.location.origin : 'https://pinonit.com') {
  return `${origin.replace(/\/$/, '')}/c/${token}`;
}

/** Flatten host-picked YYYY-MM-DD + HH:MM into timestamptz rows (sort_order 0 = SMS option 1). */
export function flattenSelectedSlotsToProposed(
  selectedSlots: Record<string, string[]>,
  durationMinutes: number,
) {
  const rows: { start_time: string; end_time: string; sort_order: number }[] = [];
  let order = 0;
  for (const date of Object.keys(selectedSlots).sort()) {
    for (const time of [...(selectedSlots[date] ?? [])].sort()) {
      const start = new Date(`${date}T${time}:00`);
      if (Number.isNaN(start.getTime())) continue;
      const end = new Date(start.getTime() + Math.max(1, durationMinutes) * 60_000);
      rows.push({
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        sort_order: order++,
      });
    }
  }
  return rows;
}

export function buildNumberedInviteSmsBody(opts: {
  participantName: string;
  hostName: string;
  title: string;
  contextType?: string | null;
  location?: string | null;
  slots: { start_time: string; end_time: string }[];
  token: string;
  origin?: string;
}) {
  const kind = coordinationContextLabel(opts.contextType).toLowerCase();
  const title = opts.title.trim() || coordinationContextLabel(opts.contextType);
  const loc = opts.location?.trim() ? `\nWhere: ${opts.location.trim()}` : '';
  const lines = opts.slots.map((s, i) => `${i + 1}) ${formatCoordinationSlot(s.start_time, s.end_time)}`);
  const nHint = opts.slots.length <= 1 ? '1' : `1–${opts.slots.length}`;
  const link = coordinationPageUrl(opts.token, opts.origin);
  return `Hi ${opts.participantName}! ${opts.hostName} wants to set a ${kind}: ${title}.${loc}\nPick a time (reply with just the number, or tap the link):\n${lines.join('\n')}\nReply ${nHint}: ${link}`;
}

export function formatCoordinationSlot(startIso: string, endIso?: string | null) {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const startT = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endT = end ? end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  return endT ? `${day} ${startT}–${endT}` : `${day} ${startT}`;
}

export type CoordinationPublicPayload = {
  meeting: {
    id: string;
    title: string;
    location: string | null;
    duration_minutes: number;
    context_type: string;
    scheduling_mode: string;
    status: string;
    confirmed_time: string | null;
  };
  participant: {
    name: string;
    response_status: string;
    token: string;
  };
  slots: {
    id: string;
    start_time: string;
    end_time: string;
    sort_order: number;
    you_said_yes: boolean;
  }[];
};

export async function getCoordinationByToken(token: string) {
  const { data, error } = await supabase.rpc('get_coordination_by_token', { p_token: token });
  if (error || !data) return { data: null as CoordinationPublicPayload | null, error };
  return { data: data as CoordinationPublicPayload, error: null };
}

export async function submitCoordinationSlotVotes(token: string, slotIds: string[]) {
  const { data, error } = await supabase.rpc('submit_coordination_slot_votes', {
    p_token: token,
    p_slot_ids: slotIds,
  });
  return { data: data as { ok?: boolean; error?: string; all_responded?: boolean; overlap_slot_id?: string | null } | null, error };
}

export function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function formatIcsUtc(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Minimal VCALENDAR for a locked coordination / booking. */
export function buildCoordinationIcs(opts: {
  uid: string;
  title: string;
  location?: string | null;
  startIso: string;
  endIso: string;
  description?: string | null;
}) {
  const stamp = formatIcsUtc(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PinOnIt//Coordination//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(opts.uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsUtc(opts.startIso)}`,
    `DTEND:${formatIcsUtc(opts.endIso)}`,
    `SUMMARY:${icsEscape(opts.title)}`,
  ];
  if (opts.location?.trim()) lines.push(`LOCATION:${icsEscape(opts.location.trim())}`);
  if (opts.description?.trim()) lines.push(`DESCRIPTION:${icsEscape(opts.description.trim())}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
