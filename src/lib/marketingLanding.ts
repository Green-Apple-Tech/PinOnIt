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

export type HowItWorksCalendarDate = {
  dow: string;
  day: string;
  month: string;
  selected?: boolean;
};

export type HowItWorksCalendarTime = {
  label: string;
  selected?: boolean;
};

export type HowItWorksCalendar = {
  eventName: string;
  duration: string;
  dates: HowItWorksCalendarDate[];
  heading: string;
  times: HowItWorksCalendarTime[];
  timezone: string;
};

export type HowItWorksStep = {
  id: string;
  label: string;
  scene: string;
  screen?: 'sms' | 'calendar' | 'docs' | 'sign' | 'pin';
  calendar?: HowItWorksCalendar;
  messages: HowItWorksMessage[];
  caption?: string;
  signTitle?: string;
  pinItems?: string[];
};

/** One-line scenes + SMS mock threads / calendar. Edit this array only. */
export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: 'book',
    label: 'BOOK IT',
    scene: 'Customer picks Tuesday at noon from your link',
    screen: 'calendar',
    caption: 'They pick a time on their phone. Nothing to install.',
    calendar: {
      eventName: 'Front yard cleanup',
      duration: '1 hr',
      dates: [
        { dow: 'Mon', day: '21', month: 'Sep' },
        { dow: 'Tue', day: '22', month: 'Sep', selected: true },
        { dow: 'Wed', day: '23', month: 'Sep' },
        { dow: 'Thu', day: '24', month: 'Sep' },
      ],
      heading: 'Tuesday, September 22',
      times: [
        { label: '10:00 AM' },
        { label: '10:30 AM' },
        { label: '11:00 AM' },
        { label: '11:30 AM' },
        { label: '12:00 PM', selected: true },
        { label: '1:00 PM' },
        { label: '1:30 PM' },
        { label: '2:00 PM' },
      ],
      timezone: 'Eastern Time',
    },
    messages: [],
  },
  {
    id: 'remind',
    label: 'REMIND IT',
    scene: 'A text reminder goes out the day before',
    screen: 'sms',
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
    screen: 'docs',
    caption: 'Quotes, NDAs, waivers, invoices — pick a type and send.',
    messages: [],
  },
  {
    id: 'sign',
    label: 'SIGN IT',
    scene: 'They reply and sign from their phone in about 10 seconds',
    screen: 'sign',
    signTitle: 'Front yard cleanup quote',
    caption: 'They sign on their phone. Nothing to install.',
    messages: [],
  },
  {
    id: 'pin',
    label: 'PIN IT',
    scene: 'Everything lands in one place',
    screen: 'pin',
    pinItems: ['Booked · Tue 12:00 PM', 'Reminder sent', 'Quote signed', 'Paid'],
    caption: 'Booked, reminded, signed, paid — one thread.',
    messages: [],
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
