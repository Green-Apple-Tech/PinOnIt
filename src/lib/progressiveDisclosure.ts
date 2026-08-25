import type { HostQuoteLineItem } from './types';
import { taxRateForRegion } from './usSalesTax';

export type UiMode = 'simple' | 'advanced';
export type RevealedToolId = 'paid-booking' | 'quotes' | 'group-scheduling' | 'analytics';

export const ALL_BUSINESS_TYPES = [
  'landscaper',
  'plumber',
  'hvac',
  'electrician',
  'handyman',
  'carpenter',
  'pressure_washer',
  'car_washer',
  'painter',
  'roofer',
  'locksmith',
  'pest_control',
  'appliance_repair',
  'garage_door',
  'carpet_cleaning',
  'junk_removal',
  'pool_service',
  'window_cleaner',
  'house_cleaning',
  'moving',
  'auto_shop',
  'computer_services',
  'dentist',
  'salon',
  'spa',
  'fitness',
  'pet_care',
  'tutoring',
  'photography',
  'therapy',
  'real_estate',
  'legal',
  'accounting',
  'insurance',
  'mortgage',
  'notary',
  'mobile_trade',
  'personal_services',
  'professional_services',
  'other',
] as const;

export type BusinessType = (typeof ALL_BUSINESS_TYPES)[number];

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (ALL_BUSINESS_TYPES as readonly string[]).includes(value);
}

/** Default names seeded for brand-new hosts — safe to overwrite with an industry preset. */
export function isPlaceholderMeetingName(name: string): boolean {
  return /^(15|30|60) minute meeting$/i.test(name.trim());
}

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

export type BusinessTypeOption = { id: BusinessType; label: string; desc: string };

export const BUSINESS_TYPE_GROUPS: { label: string; options: BusinessTypeOption[] }[] = [
  {
    label: 'Home & field service',
    options: [
      { id: 'landscaper', label: 'Landscaping / lawn', desc: 'On-site estimates, drive time, and yard quote lines.' },
      { id: 'plumber', label: 'Plumbing', desc: 'Service calls, travel buffer, parts and labor quotes.' },
      { id: 'hvac', label: 'HVAC', desc: 'Diagnostic visits, travel time, and equipment quotes.' },
      { id: 'electrician', label: 'Electrician', desc: 'On-site calls with labor and materials quotes.' },
      { id: 'handyman', label: 'Handyman', desc: 'Job visits with travel buffer and labor quotes.' },
      { id: 'carpenter', label: 'Carpenter', desc: 'On-site measure/install with materials quotes.' },
      { id: 'pressure_washer', label: 'Pressure washing', desc: 'Driveway and house-wash jobs with travel time.' },
      { id: 'painter', label: 'Painter', desc: 'Estimates, travel buffer, and paint/labor quotes.' },
      { id: 'roofer', label: 'Roofing', desc: 'Inspections and repair quotes with drive time.' },
      { id: 'locksmith', label: 'Locksmith', desc: 'Emergency and scheduled calls with travel time.' },
      { id: 'pest_control', label: 'Pest control', desc: 'Treatments with travel buffer and service quotes.' },
      { id: 'appliance_repair', label: 'Appliance repair', desc: 'In-home diagnostics, parts, and labor.' },
      { id: 'garage_door', label: 'Garage doors', desc: 'Service calls with parts and labor quotes.' },
      { id: 'carpet_cleaning', label: 'Carpet / upholstery', desc: 'In-home jobs with travel time and room quotes.' },
      { id: 'junk_removal', label: 'Junk removal', desc: 'Pickup windows with dump and labor quotes.' },
      { id: 'pool_service', label: 'Pool service', desc: 'Route stops with travel buffer and chemical quotes.' },
      { id: 'window_cleaner', label: 'Window cleaning', desc: 'On-site jobs with pane/story quote lines.' },
      { id: 'house_cleaning', label: 'House cleaning', desc: 'Recurring visits with SMS confirmations.' },
      { id: 'moving', label: 'Moving', desc: 'Move-day windows, travel time, and hourly quotes.' },
    ],
  },
  {
    label: 'Auto & mobile wash',
    options: [
      { id: 'car_washer', label: 'Mobile car wash / detailing', desc: 'On-site washes with travel time and package quotes.' },
      { id: 'auto_shop', label: 'Auto shop / mechanic', desc: 'Drop-off appointments and repair quotes.' },
    ],
  },
  {
    label: 'Tech',
    options: [
      { id: 'computer_services', label: 'Computer / IT services', desc: 'On-site or shop repair with diagnostic, labor, and parts quotes.' },
    ],
  },
  {
    label: 'Personal & health',
    options: [
      { id: 'dentist', label: 'Dental / medical office', desc: 'In-office visits with a confirmation text.' },
      { id: 'salon', label: 'Salon / barber', desc: 'Chair time with confirmation texts.' },
      { id: 'spa', label: 'Spa / massage', desc: 'Appointments with confirmation texts.' },
      { id: 'fitness', label: 'Trainer / fitness', desc: 'Sessions with confirmation texts.' },
      { id: 'pet_care', label: 'Pet grooming / sitting', desc: 'Drop-off or mobile visits with SMS.' },
      { id: 'tutoring', label: 'Tutoring / lessons', desc: 'Sessions with confirmation texts.' },
      { id: 'photography', label: 'Photography', desc: 'Shoots with travel time and package quotes.' },
      { id: 'therapy', label: 'Therapy / counseling', desc: 'Private sessions with confirmation texts.' },
    ],
  },
  {
    label: 'Professional services',
    options: [
      { id: 'real_estate', label: 'Real estate', desc: 'Showings plus group scheduling.' },
      { id: 'legal', label: 'Legal / attorney', desc: 'Consults, retainers, and email reminders.' },
      { id: 'accounting', label: 'Accounting / bookkeeping', desc: 'Tax and bookkeeping consults.' },
      { id: 'insurance', label: 'Insurance', desc: 'Policy reviews with email reminders.' },
      { id: 'mortgage', label: 'Mortgage / lending', desc: 'Application meetings with email reminders.' },
      { id: 'notary', label: 'Notary', desc: 'Signings with travel time if you go to the client.' },
      { id: 'professional_services', label: 'Consulting / other office', desc: 'Video meetings and email reminders.' },
    ],
  },
  {
    label: 'Something else',
    options: [
      { id: 'other', label: 'Other', desc: 'A simple 30-minute meeting. You can change everything later.' },
    ],
  },
];

export const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = BUSINESS_TYPE_GROUPS.flatMap((g) => g.options);

const PARTS_LABOR: HostQuoteLineItem[] = [
  { description: 'Service call', amount: 0 },
  { description: 'Labor', amount: 0 },
  { description: 'Parts / materials', amount: 0 },
];

function field(
  eventName: string,
  bufferAfter: number,
  quoteLines: HostQuoteLineItem[],
  extra: Partial<IndustryPreset> = {},
): IndustryPreset {
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
    ...extra,
  };
}

function chair(eventName: string, durationMinutes = 30, bufferAfter = 5): IndustryPreset {
  return {
    reminderChannel: 'sms',
    locationType: 'in_person',
    eventName,
    durationMinutes,
    bufferBefore: 0,
    bufferAfter,
    meetingBuffer: bufferAfter,
    revealed: ['paid-booking'],
    quoteLines: [],
    usesTax: false,
    confirmationSms: true,
  };
}

function office(eventName: string, extra: Partial<IndustryPreset> = {}): IndustryPreset {
  return {
    reminderChannel: 'email',
    locationType: 'video',
    eventName,
    durationMinutes: 30,
    bufferBefore: 0,
    bufferAfter: 0,
    meetingBuffer: 0,
    revealed: [],
    quoteLines: [],
    usesTax: false,
    confirmationSms: false,
    ...extra,
  };
}

const PRESETS: Record<BusinessType, IndustryPreset> = {
  landscaper: field('60 Min On-Site Estimate', 30, [
    { description: 'Lawn mowing', amount: 0 },
    { description: 'Hedge trimming', amount: 0 },
    { description: 'Mulch / materials', amount: 0 },
    { description: 'Cleanup', amount: 0 },
  ]),
  plumber: field('60 Min Service Call', 20, PARTS_LABOR),
  hvac: field('60 Min Diagnostic Visit', 25, [
    { description: 'Diagnostic', amount: 0 },
    { description: 'Labor', amount: 0 },
    { description: 'Parts / equipment', amount: 0 },
  ]),
  electrician: field('60 Min Service Call', 20, PARTS_LABOR),
  handyman: field('60 Min Job Visit', 20, [
    { description: 'Labor', amount: 0 },
    { description: 'Materials', amount: 0 },
  ]),
  carpenter: field('60 Min On-Site Visit', 25, [
    { description: 'Labor', amount: 0 },
    { description: 'Lumber / materials', amount: 0 },
    { description: 'Finish work', amount: 0 },
  ]),
  pressure_washer: field('60 Min Wash Job', 20, [
    { description: 'Driveway / concrete', amount: 0 },
    { description: 'House wash', amount: 0 },
    { description: 'Deck / patio', amount: 0 },
  ]),
  car_washer: field('45 Min Mobile Detail', 15, [
    { description: 'Exterior wash', amount: 0 },
    { description: 'Interior detail', amount: 0 },
    { description: 'Wax / coating', amount: 0 },
  ], { durationMinutes: 45 }),
  painter: field('60 Min Estimate', 20, [
    { description: 'Labor', amount: 0 },
    { description: 'Paint / materials', amount: 0 },
    { description: 'Prep / cleanup', amount: 0 },
  ]),
  roofer: field('60 Min Inspection', 25, [
    { description: 'Inspection', amount: 0 },
    { description: 'Labor', amount: 0 },
    { description: 'Materials', amount: 0 },
  ]),
  locksmith: field('45 Min Service Call', 20, PARTS_LABOR, { durationMinutes: 45 }),
  pest_control: field('45 Min Treatment', 20, [
    { description: 'Treatment', amount: 0 },
    { description: 'Follow-up visit', amount: 0 },
  ], { durationMinutes: 45 }),
  appliance_repair: field('60 Min Diagnostic', 20, PARTS_LABOR),
  garage_door: field('60 Min Service Call', 20, PARTS_LABOR),
  carpet_cleaning: field('60 Min Cleaning', 20, [
    { description: 'Rooms / area', amount: 0 },
    { description: 'Upholstery', amount: 0 },
    { description: 'Stain treatment', amount: 0 },
  ]),
  junk_removal: field('60 Min Pickup', 20, [
    { description: 'Labor / load', amount: 0 },
    { description: 'Dump fees', amount: 0 },
  ]),
  pool_service: field('30 Min Route Stop', 15, [
    { description: 'Weekly service', amount: 0 },
    { description: 'Chemicals', amount: 0 },
  ], { durationMinutes: 30 }),
  window_cleaner: field('60 Min Window Job', 20, [
    { description: 'Interior panes', amount: 0 },
    { description: 'Exterior panes', amount: 0 },
    { description: 'Screens', amount: 0 },
  ]),
  house_cleaning: chair('2 Hour Cleaning', 120, 15),
  moving: field('2 Hour Move Window', 30, [
    { description: 'Labor (hourly)', amount: 0 },
    { description: 'Truck / mileage', amount: 0 },
    { description: 'Packing materials', amount: 0 },
  ], { durationMinutes: 120 }),
  auto_shop: field('60 Min Drop-Off', 0, PARTS_LABOR, { meetingBuffer: 0, confirmationSms: true }),
  computer_services: field('60 Min Computer Repair', 20, [
    { description: 'Diagnostic', amount: 0 },
    { description: 'Labor', amount: 0 },
    { description: 'Parts / hardware', amount: 0 },
    { description: 'Remote support', amount: 0 },
  ], { confirmationSms: true }),
  dentist: chair('30 Min Appointment', 30, 10),
  salon: chair('45 Min Appointment', 45, 5),
  spa: chair('60 Min Appointment', 60, 10),
  fitness: chair('45 Min Session', 45, 10),
  pet_care: chair('45 Min Grooming', 45, 10),
  tutoring: chair('45 Min Lesson', 45, 5),
  photography: field('60 Min Session', 20, [
    { description: 'Session fee', amount: 0 },
    { description: 'Prints / gallery', amount: 0 },
    { description: 'Travel', amount: 0 },
  ], { confirmationSms: true }),
  therapy: chair('50 Min Session', 50, 10),
  real_estate: {
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
  },
  legal: office('30 Min Consultation', {
    revealed: ['quotes'],
    quoteLines: [
      { description: 'Consultation', amount: 0 },
      { description: 'Retainer', amount: 0 },
      { description: 'Hourly work', amount: 0 },
    ],
  }),
  accounting: office('45 Min Consultation', {
    durationMinutes: 45,
    revealed: ['quotes'],
    quoteLines: [
      { description: 'Bookkeeping (monthly)', amount: 0 },
      { description: 'Tax return', amount: 0 },
      { description: 'Payroll', amount: 0 },
    ],
  }),
  insurance: office('30 Min Review'),
  mortgage: office('45 Min Application Meeting', { durationMinutes: 45 }),
  notary: field('30 Min Signing', 15, [
    { description: 'Notary fee', amount: 0 },
    { description: 'Travel', amount: 0 },
  ], { durationMinutes: 30, confirmationSms: true }),
  mobile_trade: field('60 Min Service Call', 20, PARTS_LABOR),
  personal_services: chair('30 Min Consultation'),
  professional_services: office('30 Min Consultation'),
  other: office('30 Min Consultation'),
};

export function presetsForBusinessType(type: BusinessType): IndustryPreset {
  return PRESETS[type] ?? PRESETS.other;
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
