import type { HostQuoteLineItem } from './types';
import { taxRateForRegion } from './usSalesTax';

export type UiMode = 'simple' | 'advanced';
export type RevealedToolId = 'paid-booking' | 'quotes' | 'group-scheduling' | 'analytics';

/** Specific industries plus the original four buckets (kept so older accounts still load). */
export type BusinessType =
  | 'landscaper'
  | 'plumber'
  | 'dentist'
  | 'real_estate'
  | 'mobile_trade'
  | 'personal_services'
  | 'professional_services'
  | 'other';

export type IndustryPreset = {
  reminderChannel: 'sms' | 'email';
  locationType: 'in_person' | 'video';
  eventName: string;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  meetingBuffer: number;
  revealed: RevealedToolId[];
  quoteLines: HostQuoteLineItem[];
  usesTax: boolean;
  confirmationSms: boolean;
};

export const BUSINESS_TYPE_OPTIONS: { id: BusinessType; label: string; desc: string }[] = [
  { id: 'landscaper', label: 'Landscaping / lawn care', desc: 'Drive-time buffers, quote line items, and tax you can edit.' },
  { id: 'plumber', label: 'Plumbing, HVAC, or home repair', desc: 'On-site service calls with travel buffer and parts/labor quotes.' },
  { id: 'dentist', label: 'Dental or medical office', desc: 'In-office visits with a confirmation text when someone books.' },
  { id: 'real_estate', label: 'Real estate', desc: 'Showings plus group scheduling for buyers and partners.' },
  { id: 'personal_services', label: 'Salon, spa, coaching, or pet care', desc: 'In-person appointments with SMS reminders.' },
  { id: 'professional_services', label: 'Consulting, legal, or finance', desc: 'Video meetings and email reminders.' },
  { id: 'other', label: 'Something else', desc: 'A simple 30-minute meeting to start. You can change everything later.' },
];

const TRADE_QUOTE_LINES: HostQuoteLineItem[] = [
  { description: 'Service call', amount: 0 },
  { description: 'Labor', amount: 0 },
  { description: 'Parts / materials', amount: 0 },
];

function tradePreset(eventName: string, bufferAfter: number, quoteLines: HostQuoteLineItem[]): IndustryPreset {
  return {
    reminderChannel: 'sms',
    locationType: 'in_person',
    eventName,
    durationMinutes: 60,
    bufferBefore: 0,
    bufferAfter,
    meetingBuffer: bufferAfter,
    revealed: ['paid-booking', 'quotes'],
    quoteLines,
    usesTax: true,
    confirmationSms: false,
  };
}

export function presetsForBusinessType(type: BusinessType): IndustryPreset {
  switch (type) {
    case 'landscaper':
      return tradePreset('60 Min On-Site Estimate', 30, [
        { description: 'Lawn mowing', amount: 0 },
        { description: 'Hedge trimming', amount: 0 },
        { description: 'Mulch / materials', amount: 0 },
        { description: 'Cleanup', amount: 0 },
      ]);
    case 'plumber':
    case 'mobile_trade':
      return tradePreset('60 Min Service Call', 20, TRADE_QUOTE_LINES);
    case 'dentist':
      return {
        reminderChannel: 'sms',
        locationType: 'in_person',
        eventName: '30 Min Appointment',
        durationMinutes: 30,
        bufferBefore: 0,
        bufferAfter: 10,
        meetingBuffer: 10,
        revealed: [],
        quoteLines: [],
        usesTax: false,
        confirmationSms: true,
      };
    case 'real_estate':
      return {
        reminderChannel: 'sms',
        locationType: 'in_person',
        eventName: '30 Min Showing',
        durationMinutes: 30,
        bufferBefore: 0,
        bufferAfter: 15,
        meetingBuffer: 15,
        revealed: ['group-scheduling'],
        quoteLines: [],
        usesTax: false,
        confirmationSms: true,
      };
    case 'personal_services':
      return {
        reminderChannel: 'sms',
        locationType: 'in_person',
        eventName: '30 Min Consultation',
        durationMinutes: 30,
        bufferBefore: 0,
        bufferAfter: 5,
        meetingBuffer: 5,
        revealed: ['paid-booking'],
        quoteLines: [],
        usesTax: false,
        confirmationSms: true,
      };
    case 'professional_services':
      return {
        reminderChannel: 'email',
        locationType: 'video',
        eventName: '30 Min Consultation',
        durationMinutes: 30,
        bufferBefore: 0,
        bufferAfter: 0,
        meetingBuffer: 0,
        revealed: [],
        quoteLines: [],
        usesTax: false,
        confirmationSms: false,
      };
    default:
      return {
        reminderChannel: 'email',
        locationType: 'video',
        eventName: '30 Min Consultation',
        durationMinutes: 30,
        bufferBefore: 0,
        bufferAfter: 0,
        meetingBuffer: 0,
        revealed: [],
        quoteLines: [],
        usesTax: false,
        confirmationSms: false,
      };
  }
}

export function profilePatchForBusinessType(
  type: BusinessType,
  region: string | null | undefined,
  currentRevealed: string[] | null | undefined,
) {
  const p = presetsForBusinessType(type);
  const revealed = [...new Set([...parseRevealedTools(currentRevealed), ...p.revealed])];
  return {
    business_type: type,
    default_reminder_channel: p.reminderChannel,
    revealed_tools: revealed,
    meeting_buffer_minutes: p.meetingBuffer,
    default_tax_percent: p.usesTax ? taxRateForRegion(region) : 0,
    quote_line_defaults: p.quoteLines,
    business_region: p.usesTax ? (region || null) : null,
  };
}

export function servicePatchForBusinessType(type: BusinessType) {
  const p = presetsForBusinessType(type);
  return {
    name: p.eventName,
    location_type: p.locationType,
    duration_minutes: p.durationMinutes,
    buffer_before_minutes: p.bufferBefore,
    buffer_after_minutes: p.bufferAfter,
  };
}

export function parseRevealedTools(value: unknown): RevealedToolId[] {
  const allowed = new Set<RevealedToolId>(['paid-booking', 'quotes', 'group-scheduling', 'analytics']);
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is RevealedToolId => typeof id === 'string' && allowed.has(id as RevealedToolId));
}

export async function revealTool(
  userId: string,
  tool: RevealedToolId,
  current: string[] | null | undefined,
): Promise<RevealedToolId[]> {
  const next = new Set(parseRevealedTools(current));
  if (next.has(tool)) return [...next];
  next.add(tool);
  const list = [...next];
  const { supabase } = await import('./supabase');
  await supabase.from('profiles').update({ revealed_tools: list }).eq('id', userId);
  return list;
}
