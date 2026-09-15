import {
  COMPARE_NOTE,
  PINONIT_BOOKING_HOW,
  PINONIT_CORE_SENTENCE,
  PINONIT_COST,
  PINONIT_PRICE_MO,
  PINONIT_PRICE_MONTHLY,
  PINONIT_SIGN_HOW,
  PINONIT_VS_APPS,
  PINONIT_WHO,
  intentCanonical,
} from './seoIdentity';
import type { IntentPage } from './seoIntentPages';

const CTA = 'Start 14-day trial';

export const MORE_INTENT_PAGES: IntentPage[] = [
  {
    slug: 'docusign-alternative',
    path: '/docusign-alternative',
    eyebrow: 'One customer, one document, one phone',
    h1: 'A simple DocuSign alternative for a contractor',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Plenty of contractors open DocuSign for one job: get this customer to sign this document. They do not need bulk send, template libraries for a legal team, or routing across a company. They need a signed waiver, change order, or job sign-off before work starts.',
      'PinOnIt Sign-by-Text is built for that use case. You send the file by SMS. They tap, enter a code, and sign with a finger. You keep an audit record. That is the basic signature workflow — not every feature DocuSign sells.',
      'Stay with DocuSign when the deal needs envelopes, multiple signers, or a contract desk. Use PinOnIt when the other person is on a job site with a phone and will not hunt for an email.',
    ],
    audience:
      'Contractors and independent operators who need one customer to sign a basic document — not enterprises running a closing desk.',
    features: [
      'Send a PDF or template by text',
      'SMS verification before they sign',
      'Finger signature and ESIGN consent',
      'Audit record on the signed file',
      `Same ${PINONIT_PRICE_MONTHLY} plan as booking and reminders`,
    ],
    workflow:
      'The homeowner agrees to the work in the driveway. You send the change order or waiver by text. They sign before you order materials. You are not waiting on an envelope that landed in spam.',
    sections: [
      { h2: 'How Sign-by-Text works', text: PINONIT_SIGN_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
      {
        h2: 'PinOnIt vs DocuSign for this use case',
        text: 'PinOnIt can replace the basic “one customer signs one document on a phone” job. It does not replace DocuSign’s full eSignature, CLM, or notary products.',
      },
    ],
    related: [
      { path: '/docusign-alternative-simple-signatures', label: 'Everyday signatures without envelope caps' },
      { path: '/sign-by-text', label: 'Sign-by-Text' },
      { path: '/forms-and-waivers', label: 'Forms and waivers' },
      { path: '/contractor-booking-app', label: 'Contractor booking app' },
    ],
    compareTitle: 'One-document signature: PinOnIt vs a DocuSign envelope',
    compareOther: 'DocuSign (basic envelope)',
    compareRows: [
      { feature: 'Typical job', pinonit: 'One SMS, one signer, one file', other: 'Email envelope' },
      { feature: 'Customer account', pinonit: 'None', other: 'Often required in the DocuSign flow' },
      { feature: 'Works from a phone in the field', pinonit: 'Yes — that is the design', other: 'Possible, heavier' },
      { feature: 'Multi-signer / bulk / CLM', pinonit: 'No', other: 'Yes on higher plans' },
      { feature: 'Price for this plus booking', pinonit: PINONIT_PRICE_MO, other: 'E-sign plan + a scheduler' },
    ],
    compareNote: COMPARE_NOTE,
    faq: [
      {
        q: "What's a simple DocuSign alternative for a contractor?",
        a: `PinOnIt Sign-by-Text is ${PINONIT_PRICE_MONTHLY} after trial and sends one document to one customer by SMS. It is not a full DocuSign replacement.`,
      },
      {
        q: 'Can I send a document by text and have them sign it?',
        a: 'Yes. That is Sign-by-Text: SMS link, one-time code, finger signature, audit record.',
      },
      {
        q: 'Does PinOnIt have every DocuSign feature?',
        a: 'No. PinOnIt covers the basic single-signature job. Use DocuSign when you need its full platform.',
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'DocuSign alternative for contractors | PinOnIt',
    metaDescription: `A simple DocuSign alternative for a contractor: send one document by text, get a signature on a phone. PinOnIt Sign-by-Text is ${PINONIT_PRICE_MONTHLY} after trial.`,
    canonical: intentCanonical('/docusign-alternative'),
  },
  {
    slug: 'sign-by-text',
    path: '/sign-by-text',
    eyebrow: 'The Sign-by-Text workflow',
    h1: 'Sign a document by text',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Sign-by-Text is how PinOnIt collects a signature without an email envelope. The request is a normal SMS. The other person does not install an app or create a PinOnIt account.',
      'They open the link, enter a 6-digit code we text to the same number, read the document, check ESIGN consent, and draw a signature with a finger. You get the signed file plus an audit record: verified number, timestamps, IP and user agent, document hash, and signature image.',
      'Use it for waivers, NDAs, addendums, and job sign-offs. Do not use it for wills, notarized deeds, or closings that need several signers.',
    ],
    audience: 'Anyone who already talks to customers by text and needs a signature in that same thread.',
    features: [
      'SMS link and SMS verification code',
      'Finger signature on a phone',
      'ESIGN consent checkbox',
      'Audit record stored with the file',
      'Reuse a PDF or start from a template',
    ],
    workflow:
      'You finish the walkthrough. Open Sign-by-Text, pick the file, send to their mobile number. They tap the text in the driveway and sign before you leave.',
    sections: [
      { h2: 'How Sign-by-Text works', text: PINONIT_SIGN_HOW },
      { h2: 'What is PinOnIt?', text: PINONIT_CORE_SENTENCE },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    related: [
      { path: '/electronic-signature-by-text', label: 'Electronic signature by text' },
      { path: '/docusign-alternative', label: 'DocuSign alternative' },
      { path: '/forms-and-waivers', label: 'Forms and waivers' },
      { path: '/esignature-by-text', label: 'eSignature by text' },
    ],
    faq: [
      {
        q: 'How can I send a document to a customer by text and have them sign it?',
        a: 'Use Sign-by-Text: send the SMS, they enter a one-time code, they sign with a finger. No customer account.',
      },
      {
        q: 'Do they need email?',
        a: 'No. The request and the verification code both go by SMS.',
      },
      {
        q: 'Is this legal advice?',
        a: 'No. PinOnIt does not provide legal advice. Built-in templates are starting language. Upload attorney-reviewed PDFs when the job requires it.',
      },
    ],
    cta: 'Try Sign-by-Text',
    ctaTo: '/signup',
    metaTitle: 'Sign by text | PinOnIt Sign-by-Text',
    metaDescription: `Send a document by text and get a signature on a phone. Sign-by-Text uses an SMS link, a one-time code, and a finger signature. PinOnIt is ${PINONIT_PRICE_MONTHLY}.`,
    canonical: intentCanonical('/sign-by-text'),
  },
  {
    slug: 'electronic-signature-by-text',
    path: '/electronic-signature-by-text',
    eyebrow: 'ESIGN-oriented Sign-by-Text',
    h1: 'Electronic signature by text',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'An electronic signature by text is still an electronic signature: the person intends to sign, the record can be retained, and the process can be reproduced. PinOnIt Sign-by-Text is designed to meet federal ESIGN Act requirements for that kind of signature.',
      'The difference from a typical email envelope is the channel. Delivery and identity check both use the mobile number. Consent language is on the screen before they draw. The audit record keeps the verified number, timestamps, IP/user agent, SHA-256 hash, document snapshot, signature image, consent text, and a unique document ID.',
      'That is enough for many everyday business documents. It is not a notary, not a court filing system, and not legal advice. State rules and document types still matter — especially real estate, wills, and anything that requires a wet-ink original.',
    ],
    audience: 'Owners who need an electronic signature they can explain, without standing up a contract-management stack.',
    features: [
      'ESIGN consent on the signing screen',
      'SMS one-time code tied to the signer’s number',
      'Document hash and snapshot in the audit record',
      'Single-signer business documents',
      'Your own PDF when templates are not enough',
    ],
    workflow:
      'Upload the attorney-reviewed file. Send Sign-by-Text. They check consent, sign, and you download the record if a customer later asks how the signature was captured.',
    sections: [
      { h2: 'How Sign-by-Text works', text: PINONIT_SIGN_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    related: [
      { path: '/sign-by-text', label: 'Sign-by-Text' },
      { path: '/esignature-by-text', label: 'eSignature by text' },
      { path: '/docusign-alternative-simple-signatures', label: 'Simple DocuSign alternative' },
      { path: '/forms-and-waivers', label: 'Forms and waivers' },
    ],
    faq: [
      {
        q: 'Is a signature collected by text an electronic signature?',
        a: 'Sign-by-Text is designed to meet federal ESIGN Act requirements for electronic signatures and stores an audit record. PinOnIt does not provide legal advice.',
      },
      {
        q: 'What is in the audit record?',
        a: 'Verified mobile number, name, timestamps, IP and user agent, SHA-256 hash, document snapshot, signature image, consent text, and a unique document ID.',
      },
      {
        q: 'Can this replace a notary?',
        a: 'No. It is not a notary and not for documents that the law says must be notarized or wet-inked.',
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Electronic signature by text | PinOnIt',
    metaDescription: `Collect an electronic signature by text with SMS verification, ESIGN consent, and an audit record. PinOnIt Sign-by-Text is ${PINONIT_PRICE_MONTHLY} after trial.`,
    canonical: intentCanonical('/electronic-signature-by-text'),
  },
  {
    slug: 'booking-with-sms-reminders',
    path: '/booking-with-sms-reminders',
    eyebrow: 'Book, then remind',
    h1: 'Customers book and get text reminders',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Booking without a reminder is a slot on a calendar. Booking with SMS reminders is the same slot plus a text people actually see. PinOnIt is the booking link and the NeverMiss reminder in one product.',
      'The guest picks a time on their phone. Google, Outlook, and Apple busy times stay blocked. You turn reminders on for that visit. They can get SMS, with WhatsApp, email, or a voice call as backup, and reply 1 to cancel or 2 to reschedule.',
      'That is the combined workflow. A standalone scheduler that emails a calendar invite is a different product. PinOnIt is for shops whose customers live in Messages.',
    ],
    audience: 'Service businesses whose customers will tap a booking link in a text, then need a reminder the morning of the job.',
    features: [
      'Public booking link',
      'Calendar busy times',
      'SMS reminders on Pro',
      'Reply 1 / 2 cancel or reschedule',
      'WhatsApp, email, and voice backup',
    ],
    workflow:
      'Text the booking link after the estimate. They pick Thursday. You enable NeverMiss. Wednesday night they get a text. If the sprinkler guy already came, they reply 1 and you fill the slot.',
    sections: [
      { h2: 'How booking works', text: PINONIT_BOOKING_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
      { h2: 'PinOnIt vs. using multiple apps', text: PINONIT_VS_APPS },
    ],
    related: [
      { path: '/sms-appointment-reminders', label: 'SMS appointment reminders' },
      { path: '/calendly-alternative', label: 'Calendly alternative' },
      { path: '/small-business-booking-app', label: 'Small-business booking app' },
      { path: '/calendly-docusign-alternative', label: 'Booking plus signatures' },
    ],
    faq: [
      {
        q: 'Can customers book an appointment and receive text reminders?',
        a: 'Yes. They book on your PinOnIt link, then NeverMiss can text them. Reminders stay off until you turn them on for that visit.',
      },
      {
        q: 'Is this a Calendly SMS add-on?',
        a: 'No. Booking and SMS reminders are the same PinOnIt Pro plan. PinOnIt is not a full Calendly clone.',
      },
      {
        q: 'Do they need the PinOnIt app?',
        a: 'No. Booking and reminders use a phone browser and SMS.',
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Booking with SMS reminders | PinOnIt',
    metaDescription: `Customers book on a phone and can receive SMS reminders. Reply 1 to cancel or 2 to reschedule. PinOnIt is ${PINONIT_PRICE_MONTHLY} after a 14-day trial.`,
    canonical: intentCanonical('/booking-with-sms-reminders'),
  },
  {
    slug: 'send-estimate-by-text',
    path: '/send-estimate-by-text',
    eyebrow: 'Approval before the work starts',
    h1: 'Send an estimate by text',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'An estimate is the number you are willing to stand behind before materials are ordered. Emailing a PDF estimate often means waiting. Texting the estimate puts the same line items on the phone they already use to say yes.',
      'In PinOnIt, estimates use the same compose tools as quotes: lines, tax, a note, and how long the number is good for. You send by SMS. Status shows whether they opened it. Turn on Sign-by-Text when you need a signed approval, not on every send.',
      'Quotes on this product also support Pay Now with your Zelle, Cash App, Venmo, or PayPal link, and a receipt after you mark it paid. PinOnIt never takes that money. Use the quote flow when you are ready to collect; use the estimate when you need a yes first.',
    ],
    audience: 'Contractors and trades who walk a property, write a number, and need approval before they buy materials.',
    features: [
      'Line items and tax on your phone',
      'SMS delivery and viewed status',
      'Optional signed approval',
      'Pay Now when you are ready to collect',
      'Receipt by text after you mark it paid',
    ],
    workflow:
      'Measure the fence. Enter the lines. Text the estimate. They approve from the couch. You order lumber the same afternoon instead of calling twice.',
    sections: [
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
      { h2: 'PinOnIt vs. using multiple apps', text: PINONIT_VS_APPS },
    ],
    related: [
      { path: '/send-quote-by-text', label: 'Send a quote by text' },
      { path: '/sign-by-text', label: 'Sign-by-Text' },
      { path: '/contractor-booking-app', label: 'Contractor booking app' },
      { path: '/service-business-software', label: 'Service business software' },
    ],
    faq: [
      {
        q: 'How can I send an estimate by text and get customer approval?',
        a: 'Compose the estimate on your phone, send the SMS, and watch viewed vs approved. Require Sign-by-Text only when you need a signed yes.',
      },
      {
        q: 'Is an estimate different from a quote in PinOnIt?',
        a: 'The compose screen is the same family of documents. Use it as an estimate when you need approval first; add Pay Now when you are ready to collect. PinOnIt never takes the money.',
      },
      {
        q: 'Can they pay after they approve?',
        a: 'Yes. Paste your own Zelle, Cash App, Venmo, or PayPal link. After it lands, mark paid and text a receipt.',
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Send an estimate by text | PinOnIt',
    metaDescription: `Text an estimate from the job site and get approval on a phone. Optional Sign-by-Text and Pay Now with your own payment link. PinOnIt is ${PINONIT_PRICE_MONTHLY}.`,
    canonical: intentCanonical('/send-estimate-by-text'),
  },
  {
    slug: 'forms-and-waivers',
    path: '/forms-and-waivers',
    eyebrow: 'Waivers, NDAs, and simple forms',
    h1: 'Forms and waivers by text',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Venues, rentals, and contractors collect the same form over and over: a liability waiver at check-in, an NDA before a walkthrough, a job sign-off when the work is done. Paper stacks. Email forms get lost. PinOnIt sends the form as Sign-by-Text.',
      'Built-in templates are starting language, not legal advice. Upload your attorney-reviewed PDF once and reuse it. Each send is still one signer, one file, with an audit record.',
      'If you need a full forms product with branching logic, payment inside the form, or multi-signer packets, that is a different category of software. PinOnIt covers the simple form you already have wording for.',
    ],
    audience: 'Parks, parties, rentals, and contractors who collect a waiver or NDA from people who will not sit at a laptop.',
    features: [
      'Reuse a waiver or NDA PDF',
      'Starting templates on /legal-templates',
      'Sign-by-Text delivery',
      'Audit record per signed copy',
      'Booking and reminders in the same plan',
    ],
    workflow:
      'Guest arrives. You send the waiver to the number they just gave you. They sign on the phone at the gate. You keep the signed copy with the booking.',
    sections: [
      { h2: 'How Sign-by-Text works', text: PINONIT_SIGN_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    related: [
      { path: '/sign-by-text', label: 'Sign-by-Text' },
      { path: '/electronic-signature-by-text', label: 'Electronic signature by text' },
      { path: '/docusign-alternative', label: 'DocuSign alternative' },
      { path: '/legal-templates', label: 'Waiver templates' },
    ],
    faq: [
      {
        q: 'Are the built-in waivers legal in my state?',
        a: 'Built-ins are starting points, not legal advice. Upload an attorney-reviewed PDF for the form you actually need. See /legal-templates.',
      },
      {
        q: 'Can I send the same waiver all day?',
        a: 'Yes. Upload once, send as many times as you need. There is no Sign-by-Text envelope cap on Pro.',
      },
      {
        q: 'Does the guest need an account?',
        a: 'No. They open the SMS and sign in the phone browser.',
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Forms and waivers by text | PinOnIt',
    metaDescription: `Send waivers, NDAs, and simple forms by text. Guests sign on a phone with Sign-by-Text. PinOnIt is ${PINONIT_PRICE_MONTHLY} after trial — not a full forms suite.`,
    canonical: intentCanonical('/forms-and-waivers'),
  },
  {
    slug: 'contractor-booking-app',
    path: '/contractor-booking-app',
    eyebrow: 'Built for the job site',
    h1: 'Contractor booking app',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'A contractor booking app has to work in a driveway, not only on a desktop calendar. PinOnIt is a mobile-first booking page plus the office work around the visit: text the estimate, collect a signature, remind them the morning of the job.',
      'Share a link. They pick a time against your real busy times. After the visit, send a quote or a sign-off by SMS. Recurring jobs on the host side keep a rolling calendar for routes you already run.',
      'This is not a full construction ERP, estimating CAD tool, or payroll system. It is the booking-and-paperwork layer a one-crew shop actually uses between jobs.',
    ],
    audience: 'Independent contractors and small crews who quote, book, and collect signatures from a phone.',
    features: [
      'Booking link for site visits',
      'SMS reminders before the job',
      'Estimates and quotes by text',
      'Sign-by-Text for waivers and change orders',
      'Receipts after you mark a quote paid',
    ],
    workflow:
      'Walk the roof. Text the estimate. They approve. Send the booking link for the install day. NeverMiss texts them the morning of. After the job, send the waiver or sign-off if you still need it.',
    sections: [
      { h2: 'Who is PinOnIt for?', text: PINONIT_WHO },
      { h2: 'How booking works', text: PINONIT_BOOKING_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    related: [
      { path: '/send-estimate-by-text', label: 'Send an estimate by text' },
      { path: '/docusign-alternative', label: 'DocuSign alternative for contractors' },
      { path: '/booking-with-sms-reminders', label: 'Booking with SMS reminders' },
      { path: '/service-business-software', label: 'Service business software' },
    ],
    faq: [
      {
        q: "What's simple software for a contractor who books from a phone?",
        a: `PinOnIt is a contractor-friendly booking app with estimates, Sign-by-Text, and SMS reminders on one ${PINONIT_PRICE_MONTHLY} plan.`,
      },
      {
        q: 'Does it replace my accounting software?',
        a: 'No. Paste your own payment links. PinOnIt never takes the money. Keep QuickBooks or whatever you already use for books.',
      },
      {
        q: 'Can I import from Calendly if I used that for site visits?',
        a: 'Yes. You can import event types while you switch.',
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Contractor booking app | PinOnIt',
    metaDescription: `A contractor booking app with estimates by text, Sign-by-Text, and SMS reminders. PinOnIt is ${PINONIT_PRICE_MONTHLY} after trial — mobile-first, not a construction ERP.`,
    canonical: intentCanonical('/contractor-booking-app'),
  },
  {
    slug: 'small-business-booking-app',
    path: '/small-business-booking-app',
    eyebrow: 'One-person shops and tiny teams',
    h1: 'Small-business booking app',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Most small-business booking apps assume you are selling 30-minute meetings. PinOnIt assumes you are selling a visit: a chair, a lawn, a party room, a repair window. The customer books on a phone. You remind them by text.',
      'The same login sends quotes, simple documents, and Sign-by-Text. That is the point for a one-person service business: one affordable plan instead of a scheduler plus a reminder add-on plus an e-sign envelope.',
      'PinOnIt is mobile-first by design. It is not a franchise OS, not a full POS, and not a replacement for every tool a large team already standardized on.',
    ],
    audience: 'One-person service businesses and independent operators who need booking without a stack of subscriptions.',
    features: [
      'Booking page customers can use on a phone',
      'SMS reminders and two-way 1 / 2 replies',
      'Quotes, estimates, and simple documents',
      'Sign-by-Text',
      `Pro at ${PINONIT_PRICE_MONTHLY} after a 14-day trial`,
    ],
    workflow:
      'A new customer texts you. You reply with your booking link. They pick a time. You send a reminder. After the visit you text the receipt if they paid via your Zelle link.',
    sections: [
      { h2: 'What is PinOnIt?', text: PINONIT_CORE_SENTENCE },
      { h2: 'Who is PinOnIt for?', text: PINONIT_WHO },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
      { h2: 'PinOnIt vs. using multiple apps', text: PINONIT_VS_APPS },
    ],
    related: [
      { path: '/service-business-software', label: 'Service business software' },
      { path: '/booking-with-sms-reminders', label: 'Booking with SMS reminders' },
      { path: '/calendly-alternative', label: 'Calendly alternative' },
      { path: '/calendly-docusign-alternative', label: 'Scheduling plus signatures' },
    ],
    faq: [
      {
        q: "What's simple software for a one-person service business?",
        a: `PinOnIt is an affordable, mobile-first booking app with SMS reminders, Sign-by-Text, and quotes. Pro is ${PINONIT_PRICE_MONTHLY} after trial.`,
      },
      {
        q: 'Do I need a website?',
        a: 'You share a booking link. Customers do not need an account. You can still keep any website you already have.',
      },
      {
        q: 'Is there a per-booking fee?',
        a: `Pro is a flat ${PINONIT_PRICE_MONTHLY}. PinOnIt never takes a cut of Zelle, Cash App, Venmo, or PayPal.`,
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Small business booking app | PinOnIt',
    metaDescription: `Simple booking software for a one-person service business: appointments, SMS reminders, quotes, and Sign-by-Text. PinOnIt is ${PINONIT_PRICE_MONTHLY} after trial.`,
    canonical: intentCanonical('/small-business-booking-app'),
  },
  {
    slug: 'service-business-software',
    path: '/service-business-software',
    eyebrow: 'The text-first office',
    h1: 'Service business software on your phone',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Service business software usually means a stack: a scheduler, a document tool, a reminder product, and something for invoices. PinOnIt is an affordable, mobile-first platform for small service businesses that need the basic version of those jobs in one place.',
      'Core capabilities: appointment booking, SMS reminders, Sign-by-Text electronic signatures, sending simple documents and forms, quotes and estimates, approvals, receipts and invoices where supported, and payment collection where supported (your own Zelle, Cash App, Venmo, or PayPal link — PinOnIt never takes the money).',
      'It can replace the basic functionality some shops currently split across separate scheduling, reminder, document-signing, and customer-communication tools. It does not claim every feature of those specialized products.',
    ],
    audience: PINONIT_WHO,
    features: [
      'Appointment booking with calendar busy times',
      'SMS reminders (WhatsApp, email, and voice as backup)',
      'Sign-by-Text electronic signatures',
      'Quotes, estimates, and simple documents',
      'Approvals, receipts, and Pay Now via your own links',
    ],
    workflow:
      'Quote in the driveway. Get approval. Book the work. Remind them by text. Collect a signature if the job needs one. Mark paid and send a receipt — without switching apps.',
    sections: [
      { h2: 'What is PinOnIt?', text: PINONIT_CORE_SENTENCE },
      { h2: 'Who is PinOnIt for?', text: PINONIT_WHO },
      { h2: 'How booking works', text: PINONIT_BOOKING_HOW },
      { h2: 'How Sign-by-Text works', text: PINONIT_SIGN_HOW },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
      { h2: 'PinOnIt vs. using multiple apps', text: PINONIT_VS_APPS },
    ],
    related: [
      { path: '/small-business-booking-app', label: 'Small-business booking app' },
      { path: '/contractor-booking-app', label: 'Contractor booking app' },
      { path: '/calendly-docusign-alternative', label: 'Calendly + DocuSign for basic jobs' },
      { path: '/solutions', label: 'All solutions' },
    ],
    faq: [
      {
        q: 'Is there an app that combines scheduling, SMS reminders and electronic signatures?',
        a: `Yes. PinOnIt combines booking, NeverMiss SMS reminders, and Sign-by-Text on one ${PINONIT_PRICE_MONTHLY} plan. It does not include every feature of Calendly or DocuSign.`,
      },
      {
        q: 'What does PinOnIt cost?',
        a: PINONIT_COST,
      },
      {
        q: 'Who is it for?',
        a: PINONIT_WHO,
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Service business software | PinOnIt',
    metaDescription: `Affordable, mobile-first software for small service businesses: booking, SMS reminders, Sign-by-Text, quotes, and simple documents. PinOnIt is ${PINONIT_PRICE_MONTHLY} after trial.`,
    canonical: intentCanonical('/service-business-software'),
  },
  {
    slug: 'calendly-docusign-alternative',
    path: '/calendly-docusign-alternative',
    eyebrow: 'Two jobs, one product',
    h1: 'Booking and signatures without two extra apps',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'Some shops pay for Calendly because they need a booking link and a reminder, and they pay for DocuSign because they need a signature on a waiver. Those are two basic jobs. They are not “every feature both companies sell.”',
      'PinOnIt covers that combined use case: a booking page with SMS reminders, and Sign-by-Text for a single customer signature, plus quotes when you still price jobs by text. One Pro plan. The customer still does not need an account.',
      'PinOnIt is not a Calendly clone and not a DocuSign clone. If you need Calendly’s full meeting platform or DocuSign’s full envelope and CLM stack, keep those products. If you need the field version of both jobs, this is the alternative.',
    ],
    audience: 'Small service businesses that currently split scheduling and e-sign across two subscriptions.',
    features: [
      'Booking link and calendar busy times',
      'SMS reminders with 1 / 2 replies',
      'Sign-by-Text for one-document signatures',
      'Quotes and estimates by text',
      `Flat ${PINONIT_PRICE_MONTHLY} after trial`,
    ],
    workflow:
      'Customer books the party. You send the waiver by text before they arrive. NeverMiss reminds them the day of. You are not jumping from a scheduler to an envelope tool.',
    sections: [
      { h2: 'What is PinOnIt?', text: PINONIT_CORE_SENTENCE },
      { h2: 'How booking works', text: PINONIT_BOOKING_HOW },
      { h2: 'How Sign-by-Text works', text: PINONIT_SIGN_HOW },
      { h2: 'PinOnIt vs. using multiple apps', text: PINONIT_VS_APPS },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    related: [
      { path: '/calendly-alternative', label: 'Calendly alternative' },
      { path: '/docusign-alternative', label: 'DocuSign alternative' },
      { path: '/service-business-software', label: 'Service business software' },
      { path: '/booking-with-sms-reminders', label: 'Booking with SMS reminders' },
    ],
    compareTitle: 'Basic booking + basic signature vs two specialized apps',
    compareOther: 'Calendly + DocuSign (typical small-shop stack)',
    compareRows: [
      { feature: 'Booking link', pinonit: 'Yes', other: 'Calendly' },
      { feature: 'SMS reminders', pinonit: 'Yes, on Pro', other: 'Often extra on the scheduler' },
      { feature: 'One-document e-sign by text', pinonit: 'Sign-by-Text', other: 'DocuSign envelope' },
      { feature: 'Quotes by text', pinonit: 'Yes', other: 'Usually a third tool' },
      { feature: 'Full meeting platform / full CLM', pinonit: 'No', other: 'Yes, in those products' },
      { feature: 'Typical small-shop cost', pinonit: PINONIT_PRICE_MO, other: 'Two subscriptions' },
    ],
    compareNote: COMPARE_NOTE,
    faq: [
      {
        q: 'Is there an app that combines scheduling, SMS reminders and electronic signatures?',
        a: 'PinOnIt does, for the basic versions of those jobs. It does not include every Calendly or DocuSign feature.',
      },
      {
        q: 'Will PinOnIt replace both Calendly and DocuSign for my company?',
        a: 'Only if your real use is a booking link, reminders, and one-customer signatures. Keep Calendly or DocuSign when you need the rest of their platforms.',
      },
      {
        q: `Is it cheaper than two apps?`,
        a: `PinOnIt Pro is ${PINONIT_PRICE_MONTHLY} after trial for booking, reminders, Sign-by-Text, and quotes together. Compare against the two list prices you actually pay.`,
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Calendly and DocuSign alternative for small shops | PinOnIt',
    metaDescription: `PinOnIt covers basic Calendly-style booking with SMS reminders and basic DocuSign-style signatures by text. ${PINONIT_PRICE_MONTHLY} after trial — not a full clone of either product.`,
    canonical: intentCanonical('/calendly-docusign-alternative'),
  },
  {
    slug: 'solutions',
    path: '/solutions',
    eyebrow: 'Use cases',
    h1: 'Solutions for small service businesses',
    opening: PINONIT_CORE_SENTENCE,
    body: [
      'These pages explain specific jobs PinOnIt is built for. Each one is a real workflow — not a keyword swap. Start with the problem you actually have.',
      PINONIT_VS_APPS,
    ],
    audience: PINONIT_WHO,
    sections: [
      { h2: 'What is PinOnIt?', text: PINONIT_CORE_SENTENCE },
      { h2: 'Who is PinOnIt for?', text: PINONIT_WHO },
      { h2: 'What does PinOnIt cost?', text: PINONIT_COST },
    ],
    hubGroups: [
      {
        heading: 'Compare',
        links: [
          { path: '/calendly-alternative', label: 'Calendly alternative' },
          { path: '/docusign-alternative', label: 'DocuSign alternative' },
          { path: '/calendly-docusign-alternative', label: 'Booking + signatures in one app' },
          { path: '/docusign-alternative-simple-signatures', label: 'Everyday signatures' },
        ],
      },
      {
        heading: 'Book and remind',
        links: [
          { path: '/booking-with-sms-reminders', label: 'Booking with SMS reminders' },
          { path: '/sms-appointment-reminders', label: 'SMS appointment reminders' },
          { path: '/contractor-booking-app', label: 'Contractor booking app' },
          { path: '/small-business-booking-app', label: 'Small-business booking app' },
        ],
      },
      {
        heading: 'Sign and send',
        links: [
          { path: '/sign-by-text', label: 'Sign-by-Text' },
          { path: '/electronic-signature-by-text', label: 'Electronic signature by text' },
          { path: '/esignature-by-text', label: 'eSignature by text' },
          { path: '/forms-and-waivers', label: 'Forms and waivers' },
          { path: '/send-quote-by-text', label: 'Send a quote by text' },
          { path: '/send-estimate-by-text', label: 'Send an estimate by text' },
        ],
      },
      {
        heading: 'Product',
        links: [
          { path: '/service-business-software', label: 'Service business software' },
          { path: '/why-pinonit', label: 'Why PinOnIt' },
          { path: '/legal-templates', label: 'Waiver templates' },
          { path: '/blog', label: 'Field notes' },
        ],
      },
    ],
    related: [
      { path: '/service-business-software', label: 'Service business software' },
      { path: '/why-pinonit', label: 'Why PinOnIt' },
      { path: '/blog', label: 'Field notes' },
    ],
    faq: [
      {
        q: 'Where should I start?',
        a: 'If you book visits, start with the Calendly alternative or booking-with-SMS page. If you collect signatures, start with Sign-by-Text or the DocuSign alternative.',
      },
      {
        q: 'What does it cost?',
        a: PINONIT_COST,
      },
      {
        q: 'Is PinOnIt only a scheduler?',
        a: 'No. Booking is one piece. Quotes, Sign-by-Text, and reminders are in the same product.',
      },
    ],
    cta: CTA,
    ctaTo: '/signup',
    metaTitle: 'Solutions | PinOnIt',
    metaDescription: `PinOnIt solutions: booking, SMS reminders, Sign-by-Text, quotes, and simple documents for small service businesses. ${PINONIT_PRICE_MONTHLY} after a 14-day trial.`,
    canonical: intentCanonical('/solutions'),
  },
];
