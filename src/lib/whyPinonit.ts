export type CompareValue = boolean | string;

export type WhyFeature = {
  id: string;
  label: string;
  pinonit: CompareValue;
  calendly: CompareValue;
};

export type WhyScenario = {
  id: string;
  title: string;
  audience: string;
  pain: string;
  handle: string;
};

export type ExclusiveFeature = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  tag: string;
};

/** Things Calendly genuinely does not do. Source of truth for homepage + /why-pinonit. */
export const CALENDLY_EXCLUSIVES: ExclusiveFeature[] = [
  {
    id: 'whatsapp',
    icon: '💬',
    title: 'WhatsApp reminders',
    desc: 'Calendly has none, period. Reach clients in the chat they already live in — not another ignored email.',
    tag: 'Not on Calendly',
  },
  {
    id: 'voice',
    icon: '📞',
    title: 'Voice reminders & critical alerts',
    desc: 'An actual call before the meeting. Critical alerts ring you minutes out. Nobody else in this category does this.',
    tag: 'Not on Calendly',
  },
  {
    id: 'personal',
    icon: '🗣️',
    title: 'Host “remind me to…”',
    desc: 'Type or record a personal reminder — optionally add it to Google or Outlook, not just PinOnIt’s calendar.',
    tag: 'Not on Calendly',
  },
  {
    id: 'writeback',
    icon: '📆',
    title: 'Calendar write-back',
    desc: 'Confirmed bookings land on Google or Outlook automatically. Cancel or reschedule removes the old event.',
    tag: 'Not on Calendly',
  },
  {
    id: 'coworkers',
    icon: '👥',
    title: 'Remind coworkers / an assistant',
    desc: 'Copy extra people on a booking — a tech, a spouse, a front desk. Calendly notifies invitees and hosts, not arbitrary third parties.',
    tag: 'Not on Calendly',
  },
  {
    id: 'twoway',
    icon: '↩️',
    title: 'Two-way SMS: text back to cancel or reschedule',
    desc: 'Guests text 2 or reschedule and get a link to pick a new time. Calendly SMS is one-way only.',
    tag: 'Not on Calendly',
  },
  {
    id: 'quotes',
    icon: '🧾',
    title: 'NDAs, waivers, contracts, invoices',
    desc: 'Send an NDA, waiver, contract, invoice, quote, or receipt over SMS. They verify and sign on their phone. Calendly has none of this.',
    tag: 'Not on Calendly',
  },
  {
    id: 'storefront',
    icon: '🛍️',
    title: 'Paid Booking storefront',
    desc: 'A real service menu with themes, categories, and photos. Calendly has no storefront concept.',
    tag: 'Not on Calendly',
  },
  {
    id: 'qr',
    icon: '📲',
    title: 'QR code generator',
    desc: 'Print a booking QR on a card, flyer, or shop door. Scan to book — no app, no account.',
    tag: 'Not on Calendly',
  },
  {
    id: 'signature',
    icon: '✍️',
    title: 'Email signature generator',
    desc: 'A professional signature with your booking link built in. Copy, paste, done.',
    tag: 'Not on Calendly',
  },
  {
    id: 'smsalign',
    icon: '🤝',
    title: 'Align & book over SMS',
    desc: 'Collect availability by text and find the overlap. Calendly Meeting Polls are web-only.',
    tag: 'Not on Calendly',
  },
  {
    id: 'preenter',
    icon: '📝',
    title: 'Pre-enter someone’s availability',
    desc: 'Fill in a coworker’s or client’s times on their behalf so they don’t even need to reply.',
    tag: 'Not on Calendly',
  },
  {
    id: 'import',
    icon: '⬇️',
    title: 'Calendly import',
    desc: 'Bring over your event types and keep your old Calendly link working while you switch.',
    tag: 'Not on Calendly',
  },
  {
    id: 'referral',
    icon: '💵',
    title: 'Referral program: $1/mo credit',
    desc: 'Refer 9 people and Pro is covered. Refer more and PinOnIt pays you $1/month per person.',
    tag: 'Not on Calendly',
  },
];

export const WHY_PINONIT = {
  seoTitle: 'Calendly alternative for small business | PinOnIt',
  seoDescription:
    'PinOnIt is the Calendly alternative for small business: Sign by Text, easy booking, WhatsApp and voice reminders, two-way SMS, quotes, QR codes — from $8.99/mo.',
  ogImage: 'https://pinonit.com/og-why-pinonit.png',
  canonical: 'https://pinonit.com/why-pinonit',
  heroHeadline: 'Calendly books meetings. PinOnIt runs your business.',
  heroSubhead:
    'Sign by Text, easy booking, WhatsApp reminders, calendar write-back, two-way SMS, and a paid storefront — things Calendly does not do. $8.99/mo after trial.',
  exclusiveHeadline: 'What Calendly genuinely doesn’t do',
  exclusiveSubhead: 'These are not “Calendly charges extra.” These are missing.',
  priceLine: '$8.99/mo after trial · cancel anytime',
  trialCta: 'Start 14-day trial',
  features: [
    { id: 'whatsapp', label: 'WhatsApp reminders', pinonit: true, calendly: false },
    { id: 'voice', label: 'Voice reminders & critical alerts', pinonit: true, calendly: false },
    { id: 'personal', label: 'Host “remind me to…” + calendar sync', pinonit: true, calendly: false },
    { id: 'writeback', label: 'Bookings write back to Google / Outlook', pinonit: true, calendly: false },
    { id: 'coworkers', label: 'Remind coworkers / assistant', pinonit: true, calendly: false },
    { id: 'twoway', label: 'Two-way SMS cancel/reschedule', pinonit: true, calendly: false },
    { id: 'sms', label: 'SMS reminders', pinonit: true, calendly: 'One-way, $16+/mo' },
    { id: 'quotes', label: 'NDAs, waivers, contracts, invoices', pinonit: true, calendly: false },
    { id: 'storefront', label: 'Paid Booking storefront', pinonit: true, calendly: false },
    { id: 'qr', label: 'QR code generator', pinonit: true, calendly: false },
    { id: 'signature', label: 'Email signature generator', pinonit: true, calendly: false },
    { id: 'smsalign', label: 'Align & book over SMS', pinonit: true, calendly: false },
    { id: 'preenter', label: 'Pre-enter someone’s availability', pinonit: true, calendly: false },
    { id: 'import', label: 'Calendly import', pinonit: true, calendly: false },
    { id: 'referral', label: 'Referral credit', pinonit: '$1/mo', calendly: false },
    { id: 'deposits', label: 'Deposits at booking', pinonit: true, calendly: '$16+/mo' },
    { id: 'types', label: 'Unlimited event types', pinonit: true, calendly: '$16+/mo' },
    { id: 'price', label: 'Monthly price', pinonit: '$8.99', calendly: '$16+' },
  ] satisfies WhyFeature[],
  scenarios: [
    {
      id: 'trades',
      title: 'Mobile trades',
      audience: 'HVAC, plumbing, lawn, pool',
      pain: 'A no-show burns a drive across town and a half-day of work.',
      handle: 'PinOnIt texts and WhatsApps the job, then lets the client reply 2 to pick a new slot.',
    },
    {
      id: 'solo',
      title: 'Solo professional',
      audience: 'Consultants, coaches, accountants',
      pain: 'Calendly books the call — you still chase invoices and reminders in three other apps.',
      handle: 'One link for the meeting, the deposit, and the quote. Reminders go out without you.',
    },
    {
      id: 'personal',
      title: 'Personal services',
      audience: 'Salons, tutors, trainers',
      pain: 'Clients live on their phones, not email, and they forget 24-hour cancellation policies.',
      handle: 'SMS/WhatsApp reminders plus a QR code on the door. They reschedule in one tap, not a voicemail.',
    },
  ] satisfies WhyScenario[],
};
