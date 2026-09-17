import {
  BUSINESS_TYPE_OPTIONS,
  isBusinessType,
  presetsForBusinessType,
  type BusinessType,
} from './progressiveDisclosure';

export type PaidBookingQuickStartId = 'photo' | 'consult' | 'wellness' | 'home' | 'creative';

export interface PaidBookingDemoService {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  color: string;
  description: string;
  category: string | null;
  banner_image_url: string | null;
  show_description_on_paid_booking?: boolean;
}

export interface PaidBookingSuggestion {
  source: 'business_type' | 'email_domain' | 'default';
  sourceLabel: string;
  quickStartId: PaidBookingQuickStartId;
  displayName: string;
  tagline: string;
  bio: string;
  demoServices: PaidBookingDemoService[];
}

const BRAND = '#5864C6';

/** $10 or less is a show-up hold, not an item on a paid price list. */
export const PAID_MENU_MIN_CENTS = 1001;

export function isPaidMenuPrice(cents: number | null | undefined): boolean {
  return (cents ?? 0) >= PAID_MENU_MIN_CENTS;
}

export type PaidBookingFontId = 'sans' | 'serif' | 'rounded';

export const PAID_BOOKING_FONTS: {
  id: PaidBookingFontId;
  label: string;
  stack: string;
  sample: string;
}[] = [
  {
    id: 'sans',
    label: 'Sans',
    stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    sample: 'Clean and modern',
  },
  {
    id: 'serif',
    label: 'Serif',
    stack: 'Georgia, "Iowan Old Style", "Palatino Linotype", ui-serif, serif',
    sample: 'Classic and editorial',
  },
  {
    id: 'rounded',
    label: 'Rounded',
    stack: 'ui-rounded, "Avenir Next Rounded", "Nunito", "Avenir Next", system-ui, sans-serif',
    sample: 'Friendly and soft',
  },
];

export function paidBookingFontStack(font?: string | null): string | undefined {
  return PAID_BOOKING_FONTS.find((f) => f.id === font)?.stack;
}

export function isPersistedServiceId(id: string | undefined | null): boolean {
  return Boolean(id && !id.startsWith('__'));
}

/** Rows to insert so starter price-list items are real, bookable event types. */
export function paidBookingExampleInsertRows(hostId: string, demos: PaidBookingDemoService[]) {
  return demos
    .filter((d) => isPaidMenuPrice(d.price_cents))
    .slice(0, 3)
    .map((d) => ({
      host_id: hostId,
      name: d.name,
      description: d.description || '',
      duration_minutes: d.duration_minutes,
      color: d.color || BRAND,
      price_cents: d.price_cents,
      is_active: true,
      meeting_type: 'one_on_one' as const,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 1,
      booking_window_days: 60,
      slot_increment_minutes: 15,
      allow_cancellation: true,
      allow_reschedule: true,
      cancellation_policy: '',
      location: '',
      location_type: 'video' as const,
      payment_provider: 'none' as const,
      paypal_currency: 'USD',
      booking_calendar_ids: [] as string[],
      show_description_on_booking_page: false,
      show_description_on_paid_booking: true,
    }));
}

const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'mail.com',
  'yandex.com',
  'zoho.com',
  'fastmail.com',
  'gmx.com',
  'comcast.net',
  'att.net',
  'verizon.net',
]);

const DOMAIN_NOISE = new Set(['www', 'mail', 'get', 'my', 'the', 'go', 'app', 'book', 'booking', 'team', 'hq']);

const DOMAIN_HINTS: { pattern: RegExp; type: BusinessType }[] = [
  { pattern: /photo|portrait|headshot|studio/i, type: 'photography' },
  { pattern: /landscap|lawn|yard|mow/i, type: 'landscaper' },
  { pattern: /plumb|pipe/i, type: 'plumber' },
  { pattern: /hvac|heat|cool|air/i, type: 'hvac' },
  { pattern: /electric/i, type: 'electrician' },
  { pattern: /handyman|repair/i, type: 'handyman' },
  { pattern: /clean/i, type: 'house_cleaning' },
  { pattern: /salon|barber|hair/i, type: 'salon' },
  { pattern: /spa|massage|wellness/i, type: 'spa' },
  { pattern: /fit|train|gym/i, type: 'fitness' },
  { pattern: /pet|groom|vet/i, type: 'pet_care' },
  { pattern: /tutor|lesson|learn/i, type: 'tutoring' },
  { pattern: /legal|law|attorney/i, type: 'legal' },
  { pattern: /account|tax|bookkeep/i, type: 'accounting' },
  { pattern: /realty|realtor|homes/i, type: 'real_estate' },
  { pattern: /dent|dental/i, type: 'dentist' },
  { pattern: /detail|wash|auto/i, type: 'car_washer' },
  { pattern: /computer|tech|it/i, type: 'computer_services' },
];

const QUICK_START_COPY: Record<
  PaidBookingQuickStartId,
  { tagline: string; bio: string }
> = {
  photo: {
    tagline: 'Professional Photography & Portrait Sessions',
    bio: 'Capturing your best moments in a relaxed, modern setting. Book your session online in seconds.',
  },
  consult: {
    tagline: 'Expert Consulting & Strategy Sessions',
    bio: 'Practical advice to help you move forward. Book a call and tell me what you need.',
  },
  wellness: {
    tagline: 'Appointments That Fit Your Schedule',
    bio: 'Quality care in a calm, welcoming space. Choose a time that works for you.',
  },
  home: {
    tagline: 'Reliable Service You Can Book Online',
    bio: 'Quality work, clear pricing, and easy online booking. Pick a time that fits your schedule.',
  },
  creative: {
    tagline: 'Design, Content & Creative Sessions',
    bio: 'From first ideas to finished work — book a session to get started.',
  },
};

const TYPE_QUICK_START: Record<BusinessType, PaidBookingQuickStartId> = {
  landscaper: 'home',
  plumber: 'home',
  hvac: 'home',
  electrician: 'home',
  handyman: 'home',
  carpenter: 'home',
  pressure_washer: 'home',
  painter: 'home',
  roofer: 'home',
  locksmith: 'home',
  pest_control: 'home',
  appliance_repair: 'home',
  garage_door: 'home',
  carpet_cleaning: 'home',
  junk_removal: 'home',
  pool_service: 'home',
  window_cleaner: 'home',
  house_cleaning: 'home',
  moving: 'home',
  car_washer: 'home',
  auto_shop: 'home',
  mobile_trade: 'home',
  computer_services: 'consult',
  dentist: 'wellness',
  salon: 'wellness',
  spa: 'wellness',
  fitness: 'wellness',
  pet_care: 'wellness',
  tutoring: 'wellness',
  photography: 'photo',
  therapy: 'wellness',
  real_estate: 'consult',
  legal: 'consult',
  accounting: 'consult',
  insurance: 'consult',
  mortgage: 'consult',
  notary: 'consult',
  personal_services: 'wellness',
  professional_services: 'consult',
  other: 'consult',
};

function titleCase(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function emailDomain(email: string | null | undefined): string | null {
  const raw = (email ?? '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 0) return null;
  const domain = raw.slice(at + 1).replace(/^www\./, '');
  return domain || null;
}

export function isConsumerEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return true;
  const d = domain.toLowerCase();
  if (CONSUMER_EMAIL_DOMAINS.has(d)) return true;
  // school / ISP patterns — treat as personal
  if (d.endsWith('.edu')) return true;
  return false;
}

const DOMAIN_SUFFIX_WORDS = [
  'photography', 'landscaping', 'plumbing', 'electric', 'cleaning', 'consulting',
  'studio', 'salon', 'dental', 'legal', 'realty', 'insurance', 'fitness', 'therapy',
];

function splitDomainWords(base: string): string[] {
  let work = base.toLowerCase();
  for (const word of DOMAIN_SUFFIX_WORDS) {
    if (work.includes(word) && work !== word) {
      work = work.replace(word, ` ${word}`);
    }
  }
  return work.split(/[.\-_/\s]+/).filter((p) => p && !DOMAIN_NOISE.has(p));
}

export function businessNameFromDomain(domain: string): string {
  const base = domain
    .toLowerCase()
    .replace(/\.(com|net|org|io|co|biz|us|uk|ca|app|dev|info|me|tv|shop|services|studio|photography)$/i, '');
  const parts = splitDomainWords(base);
  if (parts.length === 0) return titleCase(base);
  return parts.map(titleCase).join(' ');
}

export function guessBusinessTypeFromDomain(domain: string): BusinessType | null {
  for (const { pattern, type } of DOMAIN_HINTS) {
    if (pattern.test(domain)) return type;
  }
  return null;
}

function businessTypeLabel(type: BusinessType): string {
  return BUSINESS_TYPE_OPTIONS.find((o) => o.id === type)?.label ?? 'Your business';
}

function demoService(
  id: string,
  name: string,
  duration_minutes: number,
  price_cents: number,
  description: string,
): PaidBookingDemoService {
  return {
    id,
    name,
    duration_minutes,
    price_cents,
    color: BRAND,
    description,
    category: null,
    banner_image_url: null,
    show_description_on_paid_booking: true,
  };
}

export function demoServicesForBusinessType(type: BusinessType): PaidBookingDemoService[] {
  const preset = presetsForBusinessType(type);
  const quick = TYPE_QUICK_START[type] ?? 'consult';
  const label = businessTypeLabel(type).replace(/\s*\/.*$/, '').trim();
  const paidDesc =
    preset.quoteLines[0]?.description
      ? `${preset.quoteLines[0].description} and more — pricing confirmed before work starts.`
      : 'Professional service with clear pricing. Book online in seconds.';

  if (quick === 'photo') {
    return [
      demoService('__demo_1', 'Mini Session', 30, 14900, 'Quick portraits — great for headshots or socials.'),
      demoService('__demo_2', 'Portrait Session', 90, 34900, 'Full session with guidance and a set of edited photos.'),
      demoService('__demo_3', 'Event Coverage', 180, 79900, 'Half-day coverage for weddings, parties, or brand events.'),
    ];
  }

  if (quick === 'home') {
    const standardPrice = type === 'house_cleaning' || type === 'moving' ? 15000 : 9900;
    return [
      demoService('__demo_1', '30 Min Walkthrough', 30, 4900, 'See the job, confirm the scope, and leave a written price.'),
      demoService('__demo_2', preset.eventName, preset.durationMinutes, standardPrice, paidDesc),
      demoService('__demo_3', 'Half-Day Project', 240, 39900, `A booked block for larger ${label.toLowerCase()} work.`),
    ];
  }

  if (quick === 'wellness') {
    return [
      demoService('__demo_1', '30 Min Session', 30, 6500, 'A focused visit — new clients or a check-in.'),
      demoService('__demo_2', preset.eventName, preset.durationMinutes, 12000, paidDesc),
      demoService('__demo_3', '90 Min Session', 90, 17500, 'Extra time for a full treatment or first visit.'),
    ];
  }

  return [
    demoService('__demo_1', '30 Min Consultation', 30, 7500, 'Map the problem and leave with next steps.'),
    demoService('__demo_2', '60 Min Strategy Session', 60, 15000, 'Go deep on the plan, numbers, and who does what.'),
    demoService('__demo_3', 'Half-Day Working Session', 180, 45000, 'Work through it together, then leave with a written recap.'),
  ];
}

function suggestionForBusinessType(type: BusinessType, displayName: string): PaidBookingSuggestion {
  const quickStartId = TYPE_QUICK_START[type] ?? 'consult';
  const copy = QUICK_START_COPY[quickStartId];
  const label = businessTypeLabel(type);
  return {
    source: 'business_type',
    sourceLabel: label,
    quickStartId,
    displayName: displayName || label,
    tagline: copy.tagline.replace(/^Expert Consulting/, `${label} — book online`),
    bio: copy.bio,
    demoServices: demoServicesForBusinessType(type),
  };
}

function suggestionForDomain(domain: string, fullName: string): PaidBookingSuggestion | null {
  if (isConsumerEmailDomain(domain)) return null;
  const guessed = guessBusinessTypeFromDomain(domain);
  const nameFromDomain = businessNameFromDomain(domain);
  const displayName = nameFromDomain || fullName.trim() || 'Your business';

  if (guessed) {
    const base = suggestionForBusinessType(guessed, displayName);
    return {
      ...base,
      source: 'email_domain',
      sourceLabel: domain,
      displayName,
    };
  }

  const quickStartId: PaidBookingQuickStartId = 'consult';
  const copy = QUICK_START_COPY[quickStartId];
  return {
    source: 'email_domain',
    sourceLabel: domain,
    quickStartId,
    displayName,
    tagline: copy.tagline,
    bio: copy.bio,
    demoServices: demoServicesForBusinessType('professional_services'),
  };
}

export function defaultPaidBookingSuggestion(fullName: string): PaidBookingSuggestion {
  const copy = QUICK_START_COPY.consult;
  return {
    source: 'default',
    sourceLabel: 'Example content',
    quickStartId: 'consult',
    displayName: fullName.trim() || 'Your business',
    tagline: copy.tagline,
    bio: copy.bio,
    demoServices: demoServicesForBusinessType('other'),
  };
}

export function resolvePaidBookingSuggestion(input: {
  email?: string | null;
  businessType?: string | null;
  fullName?: string | null;
}): PaidBookingSuggestion {
  const fullName = (input.fullName ?? '').trim();
  const domain = emailDomain(input.email);

  if (isBusinessType(input.businessType)) {
    const fromDomain = domain && !isConsumerEmailDomain(domain) ? businessNameFromDomain(domain) : '';
    return suggestionForBusinessType(input.businessType, fromDomain || fullName);
  }

  if (domain) {
    const fromDomain = suggestionForDomain(domain, fullName);
    if (fromDomain) return fromDomain;
  }

  return defaultPaidBookingSuggestion(fullName);
}

export function isStoredPaidBookingCustomized(
  stored: Record<string, unknown> | null | undefined,
): boolean {
  if (!stored || typeof stored !== 'object') return false;
  return ['display_name', 'tagline', 'bio'].some((k) => String(stored[k] ?? '').trim().length > 0);
}

export function mergePaidBookingSuggestion(
  current: {
    display_name?: string;
    tagline?: string;
    bio?: string;
  },
  suggestion: PaidBookingSuggestion,
  opts?: { onlyEmpty?: boolean },
): {
  display_name: string;
  tagline: string;
  bio: string;
  filled: ('display_name' | 'tagline' | 'bio')[];
} {
  const onlyEmpty = opts?.onlyEmpty ?? true;
  const filled: ('display_name' | 'tagline' | 'bio')[] = [];
  const out = {
    display_name: current.display_name ?? '',
    tagline: current.tagline ?? '',
    bio: current.bio ?? '',
  };

  (['display_name', 'tagline', 'bio'] as const).forEach((key) => {
    const cur = out[key].trim();
    const next = (key === 'display_name' ? suggestion.displayName : suggestion[key]).trim();
    if (!next) return;
    if (!onlyEmpty || !cur) {
      out[key] = next;
      if (!cur) filled.push(key);
    }
  });

  return { ...out, filled };
}

/** Quick-start chips shown in the editor (subset of industries). */
export const PAID_BOOKING_QUICK_STARTS = [
  { id: 'photo' as const, label: 'Photography', tagline: QUICK_START_COPY.photo.tagline, bio: QUICK_START_COPY.photo.bio },
  { id: 'consult' as const, label: 'Consulting', tagline: QUICK_START_COPY.consult.tagline, bio: QUICK_START_COPY.consult.bio },
  { id: 'wellness' as const, label: 'Wellness', tagline: QUICK_START_COPY.wellness.tagline, bio: QUICK_START_COPY.wellness.bio },
  { id: 'home' as const, label: 'Home services', tagline: QUICK_START_COPY.home.tagline, bio: QUICK_START_COPY.home.bio },
  { id: 'creative' as const, label: 'Creative', tagline: QUICK_START_COPY.creative.tagline, bio: QUICK_START_COPY.creative.bio },
];
