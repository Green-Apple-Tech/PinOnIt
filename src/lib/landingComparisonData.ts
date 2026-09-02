export type LandingCompRow = {
  section?: string;
  feature?: string;
  pinonit?: boolean | string;
  calendly?: boolean | string;
  acuity?: boolean | string;
};

export const LANDING_COMP_ROWS: LandingCompRow[] = [
  { section: 'Pricing' },
  { feature: 'Starting price', pinonit: 'Free', calendly: 'Free', acuity: '$16/mo' },
  { feature: 'Pro / Paid plan', pinonit: '$6/mo', calendly: '$16/mo', acuity: '$20/mo' },
  { feature: 'Referral earnings', pinonit: '$1/mo/user', calendly: false, acuity: false },
  { section: 'Calendly does not do this' },
  { feature: 'WhatsApp reminders', pinonit: true, calendly: false, acuity: false },
  { feature: 'Voice reminders & critical alerts', pinonit: true, calendly: false, acuity: false },
  { feature: 'Personal “remind me…” + calendar write-back', pinonit: true, calendly: false, acuity: false },
  { feature: 'Bookings write to Google / Outlook', pinonit: true, calendly: false, acuity: false },
  { feature: 'Remind coworkers / assistant', pinonit: true, calendly: false, acuity: false },
  { feature: 'Two-way SMS cancel/reschedule', pinonit: true, calendly: false, acuity: false },
  { feature: 'NDAs, waivers, contracts, invoices', pinonit: true, calendly: false, acuity: false },
  { feature: 'Paid Booking storefront', pinonit: true, calendly: false, acuity: false },
  { feature: 'QR code generator', pinonit: true, calendly: false, acuity: false },
  { feature: 'Email signature generator', pinonit: true, calendly: false, acuity: false },
  { feature: 'Align & book over SMS', pinonit: true, calendly: false, acuity: false },
  { feature: 'Pre-enter someone’s availability', pinonit: true, calendly: false, acuity: false },
  { feature: 'Calendly import', pinonit: true, calendly: false, acuity: false },
  { section: 'Reminders' },
  { feature: 'Email reminders', pinonit: 'Pro', calendly: 'All plans', acuity: 'All plans' },
  { feature: 'SMS reminders', pinonit: 'Pro', calendly: 'One-way, $16+', acuity: 'Emerging+' },
  { section: 'Calendar Sync' },
  { feature: 'Google Calendar', pinonit: true, calendly: true, acuity: true },
  { feature: 'Outlook / Office 365', pinonit: true, calendly: true, acuity: true },
  { feature: 'Write bookings back to calendar', pinonit: true, calendly: false, acuity: false },
  { feature: 'Apple Calendar / iCal link', pinonit: true, calendly: false, acuity: false },
  { section: 'Payments' },
  { feature: 'Stripe payments', pinonit: 'Pro', calendly: 'Standard+', acuity: 'Emerging+' },
  { feature: 'PayPal payments', pinonit: 'Pro', calendly: false, acuity: false },
];

export const LANDING_PRICING_BULLETS_TEXT_FIRST = [
  'Scheduling page (your booking page and links, synced to your calendar)',
  'Smart reminders (SMS, WhatsApp, and voice)',
  'Doc Center (waivers, NDAs, contracts, quotes, invoices, receipts)',
  'Paid booking (take payment when they book)',
  'QR code creator (truck, mirror, business card)',
  'Email signature (Schedule a meeting button)',
];
