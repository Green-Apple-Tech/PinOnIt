/** Dismissible marketing-bar copy. Change here only. */
export const MARKETING_ANNOUNCEMENT_TEXT =
  'Switching from Calendly? Import in one click, 60-day free trial.';
export const MARKETING_ANNOUNCEMENT_CTA = 'Learn more';
export const MARKETING_ANNOUNCEMENT_HREF = '/calendly-alternative';
export const MARKETING_ANNOUNCEMENT_STORAGE_KEY = 'pinonit_dismiss_calendly_announce_v1';

/**
 * 14-day Pro trial is started with start_local_trial (no Stripe customer / no card).
 * The 60-day Calendly switcher trial is a separate checkout with a card on file.
 */
export const TRIAL_FRICTION_LINE = '14-day free trial. No credit card required.';

export const LANDING_PRIMARY_CTA = 'Start free trial';
export const LANDING_GOOGLE_CTA = 'Continue with Google';
export const LANDING_CLOSING_HEADLINE = 'Run your business by text.';

export const WORKS_WITH_LABELS = [
  'Google Calendar',
  'Outlook',
  'iCloud',
  'Zelle',
  'Venmo',
  'Cash App',
  'PayPal',
] as const;

export const WORKS_WITH_CAPTION =
  'You get paid through your own accounts. PinOnIt never touches your money.';

export type HowItWorksMessage = {
  role: 'business' | 'customer' | 'system';
  text: string;
};

export type HowItWorksStep = {
  id: string;
  label: string;
  scene: string;
  messages: HowItWorksMessage[];
};

/** One-line scenes + SMS mock threads. Edit this array only. */
export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: 'book',
    label: 'BOOK IT',
    scene: 'Customer picks Tuesday at noon from your link',
    messages: [
      { role: 'business', text: 'Pick a time: pinonit.com/greenlawn' },
      { role: 'customer', text: 'Tuesday at noon works' },
      { role: 'system', text: 'Booked · Tue 12:00 PM' },
    ],
  },
  {
    id: 'remind',
    label: 'REMIND IT',
    scene: 'A text reminder goes out the day before',
    messages: [
      { role: 'business', text: 'Reminder: tomorrow at noon. Reply 1 to cancel, 2 to reschedule.' },
      { role: 'customer', text: 'See you then' },
      { role: 'system', text: 'Delivered · day before' },
    ],
  },
  {
    id: 'send',
    label: 'SEND IT',
    scene: 'You send a quote or waiver by text',
    messages: [
      { role: 'business', text: "Here's your quote for the front yard — $450. View: pinonit.com/d/…" },
      { role: 'system', text: 'Opened · they tapped the text' },
      { role: 'customer', text: 'Looks good' },
    ],
  },
  {
    id: 'sign',
    label: 'SIGN IT',
    scene: 'They reply and sign from their phone in about 10 seconds',
    messages: [
      { role: 'business', text: 'Sign from your phone: pinonit.com/d/…' },
      { role: 'customer', text: 'Signed' },
      { role: 'system', text: 'Signed · about 10 seconds' },
    ],
  },
  {
    id: 'pin',
    label: 'PIN IT',
    scene: 'Everything lands in one place',
    messages: [
      { role: 'system', text: 'Quote · signed · booked · paid' },
      { role: 'business', text: "You're all set. See you Tuesday." },
      { role: 'customer', text: '👍' },
    ],
  },
];

export type TestimonialCard = {
  metric: string;
  quote: string;
  name: string;
  business: string;
};

/**
 * Result-headline testimonials. Keep this array empty until there is a real quote.
 *
 * Example only — do not copy into the live array:
 * {
 *   metric: 'Fewer no-shows',
 *   quote: 'They actually show up now.',
 *   name: 'Jordan M.',
 *   business: 'Mobile detailing',
 * }
 */
export const LANDING_TESTIMONIALS: TestimonialCard[] = [];
