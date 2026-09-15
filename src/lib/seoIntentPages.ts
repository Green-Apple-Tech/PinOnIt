import {
  COMPARE_NOTE,
  COMPETITOR_PRICING_AS_OF,
  PINONIT_BOOKING_HOW,
  PINONIT_CORE_SENTENCE,
  PINONIT_COST,
  PINONIT_PRICE_LABEL,
  PINONIT_PRICE_MO,
  PINONIT_PRICE_MONTHLY,
  PINONIT_SIGN_HOW,
  PINONIT_VS_APPS,
  PINONIT_WHO,
  intentCanonical,
} from './seoIdentity';
import { MORE_INTENT_PAGES } from './seoMoreIntentPages';

export type IntentFaq = { q: string; a: string };

export type IntentCompareRow = {
  feature: string;
  pinonit: string;
  other: string;
};

export type IntentRelated = { path: string; label: string };

export type IntentSection = { h2: string; text: string };

export type IntentHubGroup = { heading: string; links: IntentRelated[] };

export type IntentPage = {
  slug: string;
  path: string;
  h1: string;
  eyebrow: string;
  opening: string;
  body: string[];
  audience?: string;
  features?: string[];
  workflow?: string;
  sections?: IntentSection[];
  related?: IntentRelated[];
  hubGroups?: IntentHubGroup[];
  compareTitle?: string;
  compareOther?: string;
  compareRows?: IntentCompareRow[];
  compareNote?: string;
  faq: IntentFaq[];
  cta: string;
  ctaTo: string;
  metaTitle: string;
  metaDescription: string;
  canonical: string;
};

const OG = 'https://pinonit.com/og-why-pinonit.png';
export const INTENT_OG_IMAGE = OG;

export { COMPARE_NOTE, intentCanonical };

const CORE_INTENT_PAGES: IntentPage[] = [
  {
    slug: 'calendly-alternative',
    path: '/calendly-alternative',
    eyebrow: 'For contractors, venues, and local services',
    h1: 'Calendly alternative for small business',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Calendly is built around a booking page for meetings. That is useful if your work is a Zoom slot on a laptop. Most small businesses are not that: a painter quoting from the driveway, a trampoline park collecting a waiver, a lawn crew that no-shows if the reminder is an email.',
      'Someone running a small service company may use Calendly primarily for appointment booking and reminders. For that specific workflow, PinOnIt still gives you a booking link and Google / Outlook / Apple busy times — then it keeps going. NeverMiss reminds them by text, WhatsApp, email, or a voice call, and they can reply 1 to cancel or 2 to reschedule.',
      'PinOnIt is not a full Calendly replacement. It does not try to match every Calendly feature, workflow, or integration. If you only need a prettier Calendly clone, stay on Calendly. If the job after they pick a time is a quote, a waiver, or a text reminder, that is this product.',
    ],
    audience:
      'Independent operators and small crews who book jobs on a phone — contractors, venues, lawn and pool routes — not teams whose whole day is video meetings.',
    features: [
      'Booking link with calendar busy times',
      'SMS reminders, plus WhatsApp, email, and voice',
      'Guest reply 1 to cancel or 2 to reschedule',
      'Quote-by-Text and Sign-by-Text in the same plan',
      `One Pro plan at ${PINONIT_PRICE_MONTHLY} after a 14-day trial`,
    ],
    workflow:
      'Share your booking link in the same text that confirms the address. They pick a slot. You turn on NeverMiss so a text goes out before the visit. If they cannot make it, they reply 1 or 2 instead of calling the shop.',
    sections: [
      { h2: 'What is PinOnIt?', text: PINONIT_CORE_SENTENCE },
      { h2: 'Who is PinOnIt for?', text: PINONIT_WHO },
      { h2: 'How booking works', text: PINONIT_BOOKING_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
      { h2: 'PinOnIt vs. using multiple apps', text: PINONIT_VS_APPS },
    ],
    related: [
      { path: '/booking-with-sms-reminders', label: 'Booking with SMS reminders' },
      { path: '/calendly-docusign-alternative', label: 'Booking and signatures in one app' },
      { path: '/contractor-booking-app', label: 'Contractor booking app' },
      { path: '/sms-appointment-reminders', label: 'SMS appointment reminders' },
    ],
    compareTitle: 'PinOnIt vs Calendly for field and venue work',
    compareOther: 'Calendly',
    compareRows: [
      { feature: 'Paid plan (typical small-business seat)', pinonit: PINONIT_PRICE_MO, other: '$16/mo Teams-class plans' },
      { feature: 'Booking link + calendar busy times', pinonit: 'Yes', other: 'Yes' },
      { feature: 'Quote a job by SMS', pinonit: 'Yes', other: 'No' },
      { feature: 'Waiver / NDA / invoice by text', pinonit: 'Yes', other: 'No' },
      { feature: 'SMS reminders', pinonit: 'Included on Pro', other: 'Limited; paid add-on on higher plans' },
      { feature: 'WhatsApp + voice reminders', pinonit: 'Yes', other: 'No' },
      { feature: 'Guest replies 1 cancel / 2 reschedule', pinonit: 'Yes', other: 'No two-way SMS like this' },
    ],
    compareNote: COMPARE_NOTE,
    faq: [
      {
        q: 'What is a cheap Calendly alternative with text reminders?',
        a: `PinOnIt is ${PINONIT_PRICE_MONTHLY} after trial and includes booking plus SMS reminders on Pro. It is built for field and venue work, not as a feature-for-feature Calendly clone.`,
      },
      {
        q: 'Does PinOnIt replace every Calendly feature?',
        a: 'No. PinOnIt covers the basic booking-and-reminders use case many small businesses actually run, plus quotes and Sign-by-Text. Stay on Calendly if you need its full meeting-platform feature set.',
      },
      {
        q: 'Can I import from Calendly?',
        a: 'Yes. You can import event types and keep an old Calendly link working while you switch.',
      },
      {
        q: 'Do my customers need an account?',
        a: 'No. They open a normal text and sign or book in the phone browser.',
      },
    ],
    cta: 'Start 14-day trial',
    ctaTo: '/signup',
    metaTitle: 'Calendly alternative for small business | PinOnIt',
    metaDescription: `PinOnIt is a Calendly alternative for small business: quote, sign, book, and remind by SMS for ${PINONIT_PRICE_MONTHLY}. Built for contractors and venues, not just Zoom meetings.`,
    canonical: intentCanonical('/calendly-alternative'),
  },
  {
    slug: 'docusign-alternative-simple-signatures',
    path: '/docusign-alternative-simple-signatures',
    eyebrow: 'When the other person will not open an envelope',
    h1: 'A simpler alternative to DocuSign for everyday signatures',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'DocuSign is the right tool for contract desks, bulk envelopes, and enterprise routing. It is a heavy tool if you need a liability waiver at the gate or an NDA before a walkthrough — and the other person is standing in a parking lot with a phone.',
      'Sign-by-Text sends a link by SMS. They enter a one-time code, draw a signature with a finger, and check ESIGN consent. PinOnIt stores an audit record (verified number, timestamps, IP/user agent, document hash, signature image). It is not a CLM suite, not a notary, and not multi-signer closing software.',
      `DocuSign Personal is built around a small monthly envelope cap. PinOnIt Pro is a flat ${PINONIT_PRICE_MONTHLY} for the office tools together — quotes, booking, reminders, and signatures — with no per-envelope meter on Sign-by-Text.`,
    ],
    audience:
      'Shops that send the same waiver, NDA, or job sign-off over and over, and whose customers will tap a text faster than they will open an email envelope.',
    features: [
      'SMS link + one-time code + finger signature',
      'ESIGN consent checkbox and audit record',
      'Upload your own PDF once and reuse it',
      'No Sign-by-Text envelope cap on Pro',
      'Quotes, booking, and reminders on the same plan',
    ],
    workflow:
      'Upload the waiver once. At the gate or after the walkthrough, send Sign-by-Text. They tap, enter the code, sign with a finger. You see the signed file without chasing an email.',
    sections: [
      { h2: 'How Sign-by-Text works', text: PINONIT_SIGN_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    related: [
      { path: '/docusign-alternative', label: 'DocuSign alternative for one signature' },
      { path: '/sign-by-text', label: 'Sign-by-Text' },
      { path: '/forms-and-waivers', label: 'Forms and waivers' },
      { path: '/esignature-by-text', label: 'eSignature by text' },
    ],
    compareTitle: 'PinOnIt Sign-by-Text vs DocuSign eSignature',
    compareOther: 'DocuSign',
    compareRows: [
      { feature: 'Entry paid plan', pinonit: `${PINONIT_PRICE_MO} (whole product)`, other: 'About $10–$15/mo Personal (annual vs monthly)' },
      { feature: 'How they sign', pinonit: 'SMS link + code + finger', other: 'Email envelope in DocuSign' },
      { feature: 'Signer account', pinonit: 'None', other: 'Often an email + DocuSign flow' },
      { feature: 'Send limits', pinonit: 'No envelope cap on Sign-by-Text', other: 'Personal: 5 envelopes/month' },
      { feature: 'Team CLM / bulk send / payments in-envelope', pinonit: 'No', other: 'Higher DocuSign plans' },
      { feature: 'Also quotes, booking, SMS reminders', pinonit: `Yes, same ${PINONIT_PRICE_LABEL}`, other: 'Separate products' },
    ],
    compareNote: COMPARE_NOTE,
    faq: [
      {
        q: 'Does PinOnIt replace DocuSign for everything?',
        a: 'No. Use DocuSign (or a lawyer) for complex routing, bulk send, and deals that need that stack. Use PinOnIt when the signature has to happen by text on a phone.',
      },
      {
        q: 'Is Sign-by-Text an electronic signature under ESIGN?',
        a: 'It is designed to meet federal ESIGN Act requirements for electronic signatures and captures an audit record. PinOnIt does not provide legal advice.',
      },
      {
        q: 'Can they sign a PDF I already have?',
        a: 'Yes. Upload a named PDF once (attorney-reviewed waiver, for example) and send it as many times as you need.',
      },
    ],
    cta: 'Start 14-day trial',
    ctaTo: '/signup',
    metaTitle: 'DocuSign alternative for simple signatures | PinOnIt',
    metaDescription: `Skip envelope caps for everyday waivers and NDAs. PinOnIt Sign-by-Text collects a signature over SMS for ${PINONIT_PRICE_MONTHLY} — not a DocuSign clone for enterprise CLM.`,
    canonical: intentCanonical('/docusign-alternative-simple-signatures'),
  },
  {
    slug: 'send-quote-by-text',
    path: '/send-quote-by-text',
    eyebrow: 'Quote-by-Text',
    h1: 'Send a quote by text',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Most quotes still leave the driveway as a PDF in email — or a number shouted at the door. Quote-by-Text is the same compose screen as your other docs: line items, tax, optional note, how many days it is good for. You send; they open the link on their phone.',
      'Pay Now uses the Zelle, Cash App, Venmo, or PayPal link you paste. PinOnIt never takes the money. When it lands, one tap marks the quote paid and can text the receipt.',
      'Signature is off by default on quotes. Turn on Sign-by-Text only when you need a signed approval. That is the opposite of making every estimate an envelope.',
    ],
    audience: 'Trades and local services who price the job on site and need the customer to approve before anyone drives back.',
    features: [
      'Line items, tax, and an expiration window',
      'Status: sent, viewed, approved, paid',
      'Pay Now with your own Zelle, Cash App, Venmo, or PayPal link',
      'Optional Sign-by-Text when you need a signed approval',
      'Receipt by text after you mark it paid',
    ],
    workflow:
      'Finish the walkthrough. Open Quote-by-Text, drop in the lines you already saved, send. They tap the SMS, approve, and pay in the app they already use. You mark it paid and send the receipt before you leave the street.',
    sections: [
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
      { h2: 'PinOnIt vs. using multiple apps', text: PINONIT_VS_APPS },
    ],
    related: [
      { path: '/send-estimate-by-text', label: 'Send an estimate by text' },
      { path: '/sign-by-text', label: 'Sign-by-Text' },
      { path: '/contractor-booking-app', label: 'Contractor booking app' },
      { path: '/service-business-software', label: 'Service business software' },
    ],
    compareTitle: 'Texting a quote vs emailing a PDF',
    compareOther: 'Email PDF',
    compareRows: [
      { feature: 'Customer action', pinonit: 'Open the SMS link', other: 'Find the email, download, reply' },
      { feature: 'Pay with their existing app', pinonit: 'Your Zelle / Cash App / Venmo / PayPal', other: 'Separate invoice later' },
      { feature: 'PinOnIt processing fee', pinonit: 'None — we never take the money', other: 'n/a' },
      { feature: 'Status', pinonit: 'Sent, viewed, approved, paid', other: 'You guess from silence' },
      { feature: 'Cost', pinonit: `${PINONIT_PRICE_MO} with booking + reminders`, other: 'Free and slow' },
    ],
    compareNote: `PinOnIt pricing as of ${COMPETITOR_PRICING_AS_OF}.`,
    faq: [
      {
        q: 'Do they have to sign the quote?',
        a: 'No. Quotes default to view + Pay Now. Check “Require a signature & SMS verify” only when you need Sign-by-Text.',
      },
      {
        q: 'Can I save line items I use every week?',
        a: 'Yes. Docs defaults remember tax and common lines. You can still edit any one send.',
      },
      {
        q: 'What if they never open the text?',
        a: 'The list shows Sent vs Viewed so you know a silent quote from a text that never landed.',
      },
    ],
    cta: 'Send a quote',
    ctaTo: '/signup',
    metaTitle: 'Send a quote by text | PinOnIt Quote-by-Text',
    metaDescription: `Price the job on your phone and text the quote. They approve and pay with your Zelle or Cash App link. PinOnIt is ${PINONIT_PRICE_MONTHLY} and never takes the money.`,
    canonical: intentCanonical('/send-quote-by-text'),
  },
  {
    slug: 'sms-appointment-reminders',
    path: '/sms-appointment-reminders',
    eyebrow: 'NeverMiss',
    h1: 'SMS appointment reminders',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'A booking is wasted if nobody shows. PinOnIt sends NeverMiss reminders on the channel people answer: SMS first, plus WhatsApp, email, and an actual voice call when the hour matters.',
      'Guests who opted in can reply 1 to cancel or 2 to reschedule. That is two-way text, not a one-way blast. You can copy a coworker or assistant on the same reminder when you need a backup.',
      'The same engine covers PinOnIt bookings and personal “remind me…” items you add yourself. Reminders stay off until you turn them on for that booking or event — we do not spam your list.',
    ],
    audience: 'Anyone whose no-show rate is an email problem: venues, lessons, in-home services, and one-person shops.',
    features: [
      'SMS reminders on Pro',
      'WhatsApp, email, and voice as backup',
      'Reply 1 cancel / 2 reschedule',
      'Optional copy to a coworker',
      'Personal “remind me…” items in the same product',
    ],
    workflow:
      'They book. You turn reminders on for that visit. Before the slot, they get a text. If the day fell apart, they reply 1 or 2 and you stop waiting on a driveway.',
    sections: [
      { h2: 'How booking works', text: PINONIT_BOOKING_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    related: [
      { path: '/booking-with-sms-reminders', label: 'Booking with SMS reminders' },
      { path: '/calendly-alternative', label: 'Calendly alternative' },
      { path: '/small-business-booking-app', label: 'Small-business booking app' },
      { path: '/contractor-booking-app', label: 'Contractor booking app' },
    ],
    compareTitle: 'Reminder channels vs a typical scheduler',
    compareOther: 'Calendly-style email reminders',
    compareRows: [
      { feature: 'Email reminder', pinonit: 'Yes', other: 'Yes' },
      { feature: 'SMS reminder', pinonit: 'Yes, on Pro', other: 'Often one-way, higher plan or add-on' },
      { feature: 'WhatsApp', pinonit: 'Yes', other: 'Usually no' },
      { feature: 'Voice call', pinonit: 'Yes', other: 'Usually no' },
      { feature: 'Reply 1 / 2 cancel or reschedule', pinonit: 'Yes', other: 'No' },
      { feature: 'Price for the whole office', pinonit: PINONIT_PRICE_MO, other: 'Scheduler fee + SMS add-on' },
    ],
    compareNote: COMPARE_NOTE,
    faq: [
      {
        q: 'Do SMS reminders start automatically?',
        a: 'No. You turn reminders on per booking or event. STOP works for opt-out. Message rates may apply.',
      },
      {
        q: 'Can I remind myself, not just the client?',
        a: 'Yes. Personal reminders and on-my-way texts are in the same product.',
      },
      {
        q: 'Is this the same as marketing SMS?',
        a: 'No. These are appointment reminders the guest opted into. We do not sell a blast campaign tool.',
      },
    ],
    cta: 'Start 14-day trial',
    ctaTo: '/signup',
    metaTitle: 'SMS appointment reminders | PinOnIt NeverMiss',
    metaDescription: `SMS appointment reminders with WhatsApp, email, and voice as backup. Guests reply 1 to cancel or 2 to reschedule. PinOnIt is ${PINONIT_PRICE_MONTHLY} after trial.`,
    canonical: intentCanonical('/sms-appointment-reminders'),
  },
  {
    slug: 'esignature-by-text',
    path: '/esignature-by-text',
    eyebrow: 'Sign-by-Text',
    h1: 'eSignature by text',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'eSignature by text means the request arrives as an SMS, not as an envelope in a desktop inbox. They tap the link, enter a 6-digit code we text them, read the document, check ESIGN consent, and sign with a finger.',
      'The audit record includes the verified mobile number, name, event timestamps, IP and user agent, SHA-256 hash, document snapshot, signature image, consent text, and a unique document ID. Built-in templates are starting language; upload your own attorney-reviewed PDF when you need a state-specific waiver.',
      'This flow is for lawful single-signature business documents (waivers, NDAs, addendums, job sign-offs). It is not for wills, notarized deeds, or multi-signer closings.',
    ],
    audience: 'Anyone who already has the wording and just needs the other person to sign on a phone.',
    features: [
      'SMS delivery and SMS one-time code',
      'Finger signature on the phone',
      'ESIGN consent and audit record',
      'Built-in templates or your own PDF',
      'Single signer per send',
    ],
    workflow:
      'Pick the document, enter their mobile number, send. They tap the text, verify, sign. You download the signed copy from the same thread.',
    sections: [
      { h2: 'How Sign-by-Text works', text: PINONIT_SIGN_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    related: [
      { path: '/sign-by-text', label: 'How Sign-by-Text works' },
      { path: '/electronic-signature-by-text', label: 'Electronic signature by text' },
      { path: '/docusign-alternative', label: 'DocuSign alternative' },
      { path: '/forms-and-waivers', label: 'Forms and waivers' },
    ],
    faq: [
      {
        q: 'What do they need besides a phone?',
        a: 'A working number for the SMS code. No app, no PinOnIt account, no download.',
      },
      {
        q: 'Can I use my own wording?',
        a: 'Yes. Edit a built-in template, or upload a PDF once and reuse it.',
      },
      {
        q: 'Where is the legal-templates page?',
        a: 'pinonit.com/legal-templates explains that built-ins are starting points and links example form sites — not partnerships.',
      },
    ],
    cta: 'Try Sign-by-Text',
    ctaTo: '/signup',
    metaTitle: 'eSignature by text | PinOnIt Sign-by-Text',
    metaDescription: `Collect an eSignature by text: SMS link, one-time code, finger signature, ESIGN audit record. PinOnIt is ${PINONIT_PRICE_MONTHLY} for small-business Sign-by-Text.`,
    canonical: intentCanonical('/esignature-by-text'),
  },
];

export const INTENT_PAGES: IntentPage[] = [...CORE_INTENT_PAGES, ...MORE_INTENT_PAGES];

export function intentPageBySlug(slug: string) {
  return INTENT_PAGES.find((p) => p.slug === slug) ?? null;
}

export function intentPageByPath(path: string) {
  return INTENT_PAGES.find((p) => p.path === path) ?? null;
}

export const INTENT_PATHS = INTENT_PAGES.map((p) => p.path);

export const INTENT_RESERVED_SLUGS = INTENT_PAGES.map((p) => p.slug);
