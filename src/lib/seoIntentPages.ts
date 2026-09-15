import { PINONIT_CORE_SENTENCE, COMPETITOR_PRICING_AS_OF } from './seoIdentity';

export type IntentFaq = { q: string; a: string };

export type IntentCompareRow = {
  feature: string;
  pinonit: string;
  other: string;
};

export type IntentPage = {
  slug: string;
  path: string;
  h1: string;
  eyebrow: string;
  opening: string;
  body: string[];
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

const COMPARE_NOTE = `Prices checked ${COMPETITOR_PRICING_AS_OF}. Competitor list prices change; confirm on their site. PinOnIt Pro is $8.99/month.`;

export const INTENT_PAGES: IntentPage[] = [
  {
    slug: 'calendly-alternative',
    path: '/calendly-alternative',
    eyebrow: 'For contractors, venues, and local services',
    h1: 'Calendly alternative for small business',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Calendly is built around a booking page for meetings. That is useful if your work is a Zoom slot on a laptop. Most small businesses are not that: a painter quoting from the driveway, a trampoline park collecting a waiver, a lawn crew that no-shows if the reminder is an email.',
      'PinOnIt still gives you a booking link and Google / Outlook / Apple busy times — then it keeps going. Quote-by-Text prices the job. Sign-by-Text collects a waiver or NDA by SMS. NeverMiss reminds them by text, WhatsApp, email, or a voice call, and they can reply 1 to cancel or 2 to reschedule.',
      'If you only need a prettier Calendly clone, stay on Calendly. If you need the office that happens after they pick a time, that is this product.',
    ],
    compareTitle: 'PinOnIt vs Calendly for field and venue work',
    compareOther: 'Calendly',
    compareRows: [
      { feature: 'Paid plan (typical small-business seat)', pinonit: '$8.99/mo', other: '$16/mo Teams-class plans' },
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
        q: 'Is PinOnIt a Calendly clone at a lower price?',
        a: 'No. Booking is one piece. The product is quote, sign, book, and remind by text for $8.99/month — work Calendly does not do.',
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
    metaDescription:
      'PinOnIt is a Calendly alternative for small business: quote, sign, book, and remind by SMS for $8.99/month. Built for contractors and venues, not just Zoom meetings.',
    canonical: 'https://pinonit.com/calendly-alternative',
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
      'DocuSign Personal is built around a small monthly envelope cap. PinOnIt Pro is a flat $8.99/month for the office tools together — quotes, booking, reminders, and signatures — with no per-envelope meter on Sign-by-Text.',
    ],
    compareTitle: 'PinOnIt Sign-by-Text vs DocuSign eSignature',
    compareOther: 'DocuSign',
    compareRows: [
      { feature: 'Entry paid plan', pinonit: '$8.99/mo (whole product)', other: 'About $10–$15/mo Personal (annual vs monthly)' },
      { feature: 'How they sign', pinonit: 'SMS link + code + finger', other: 'Email envelope in DocuSign' },
      { feature: 'Signer account', pinonit: 'None', other: 'Often an email + DocuSign flow' },
      { feature: 'Send limits', pinonit: 'No envelope cap on Sign-by-Text', other: 'Personal: 5 envelopes/month' },
      { feature: 'Team CLM / bulk send / payments in-envelope', pinonit: 'No', other: 'Higher DocuSign plans' },
      { feature: 'Also quotes, booking, SMS reminders', pinonit: 'Yes, same $8.99', other: 'Separate products' },
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
    metaDescription:
      'Skip envelope caps for everyday waivers and NDAs. PinOnIt Sign-by-Text collects a signature over SMS for $8.99/month — not a DocuSign clone for enterprise CLM.',
    canonical: 'https://pinonit.com/docusign-alternative-simple-signatures',
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
    compareTitle: 'Texting a quote vs emailing a PDF',
    compareOther: 'Email PDF',
    compareRows: [
      { feature: 'Customer action', pinonit: 'Open the SMS link', other: 'Find the email, download, reply' },
      { feature: 'Pay with their existing app', pinonit: 'Your Zelle / Cash App / Venmo / PayPal', other: 'Separate invoice later' },
      { feature: 'PinOnIt processing fee', pinonit: 'None — we never take the money', other: 'n/a' },
      { feature: 'Status', pinonit: 'Sent, viewed, approved, paid', other: 'You guess from silence' },
      { feature: 'Cost', pinonit: '$8.99/mo with booking + reminders', other: 'Free and slow' },
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
    metaDescription:
      'Price the job on your phone and text the quote. They approve and pay with your Zelle or Cash App link. PinOnIt is $8.99/month and never takes the money.',
    canonical: 'https://pinonit.com/send-quote-by-text',
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
    compareTitle: 'Reminder channels vs a typical scheduler',
    compareOther: 'Calendly-style email reminders',
    compareRows: [
      { feature: 'Email reminder', pinonit: 'Yes', other: 'Yes' },
      { feature: 'SMS reminder', pinonit: 'Yes, on Pro', other: 'Often one-way, higher plan or add-on' },
      { feature: 'WhatsApp', pinonit: 'Yes', other: 'Usually no' },
      { feature: 'Voice call', pinonit: 'Yes', other: 'Usually no' },
      { feature: 'Reply 1 / 2 cancel or reschedule', pinonit: 'Yes', other: 'No' },
      { feature: 'Price for the whole office', pinonit: '$8.99/mo', other: 'Scheduler fee + SMS add-on' },
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
    metaDescription:
      'SMS appointment reminders with WhatsApp, email, and voice as backup. Guests reply 1 to cancel or 2 to reschedule. PinOnIt is $8.99/month after trial.',
    canonical: 'https://pinonit.com/sms-appointment-reminders',
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
    metaDescription:
      'Collect an eSignature by text: SMS link, one-time code, finger signature, ESIGN audit record. PinOnIt is $8.99/month for small-business Sign-by-Text.',
    canonical: 'https://pinonit.com/esignature-by-text',
  },
];

export function intentPageBySlug(slug: string) {
  return INTENT_PAGES.find((p) => p.slug === slug) ?? null;
}

export const INTENT_PATHS = INTENT_PAGES.map((p) => p.path);
