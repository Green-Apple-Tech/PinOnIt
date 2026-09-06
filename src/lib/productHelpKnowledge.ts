import type { PageHelpGuide } from './pageHelp';

/** Product-wide limits — always shown and always injected into Ask. */
export const PRODUCT_CAN = [
  'Book clients with one shareable link and calendar sync (Google, Outlook, Apple).',
  'Send quotes, invoices, receipts, NDAs, waivers, addendums, and PDF uploads from Doc Center.',
  'Require SMS verification + signature when you need Sign-by-Text, or send without it for simple confirms.',
  'Send NeverMiss reminders by email, SMS, WhatsApp, or voice for bookings and events.',
  'Use QR codes, email signatures, paid booking pages, and group scheduling / SMS coordinate.',
];

export const PRODUCT_CANNOT = [
  'Wills, codicils, testamentary trusts, certain family-law and court documents, powers of attorney (POA), deeds, notarized instruments, multi-signer closings, or illegal/fraudulent content.',
  'Provide legal advice or predict a legal outcome — Sign-by-Text meets federal ESIGN Act requirements for electronic signatures and captures a complete audit record; it is not a law firm or notary.',
  'Replace attorney review when your document needs specialized legal language.',
  'Act as DocuSign for complex enterprise multi-party workflows.',
  'Send reminders until you turn them on for that booking/event.',
];

export type HelpFaq = {
  id: string;
  questions: string[];
  answer: string;
};

/** Common Q&A answered instantly without calling AI. */
export const HELP_FAQS: HelpFaq[] = [
  {
    id: 'sign-scope',
    questions: [
      'what can i use sign by text for',
      'can i send a will',
      'can i send a power of attorney',
      'is this legally binding',
      'what is in the audit record',
      'what documents are not allowed',
      'can it notarize',
      'esign',
    ],
    answer:
      'Sign-by-Text is for lawful single-signature business documents (waivers, NDAs, addendums, estimates, job sign-offs). It is not intended for document types excluded from the federal ESIGN Act — including wills, codicils, testamentary trusts, and certain family-law and court documents — nor for powers of attorney (POA), deeds, notarized docs, multi-signer closings, or illegal content. Meets federal ESIGN Act requirements for electronic signatures. Every signature includes a complete audit record (SMS 2FA, name, event timestamps, IP/user agent, SHA-256 hash, document snapshot, signature image, consent text, unique document ID). PinOnIt does not provide legal advice — ask your attorney when in doubt.',
  },
  {
    id: 'how-send-doc',
    questions: [
      'how do i send a document',
      'how do i send an nda',
      'how do i send a waiver',
      'how do i get a signature',
    ],
    answer:
      'Open Send Docs + Sign-by-Text → New document → pick Document Type → add recipient → turn on “Require signature & 2FA code” if you need SMS verify + sign → Send. Recipients open a link on their phone; no app required.',
  },
  {
    id: 'booking-link',
    questions: [
      'how do clients book me',
      'where is my booking link',
      'how do i share my calendar',
    ],
    answer:
      'Set your booking username in Settings, then share your pinonit.com/yourname link from the Dashboard or Booking. Clients pick a free time; connect Google/Outlook/Apple under Availability so you do not double-book.',
  },
  {
    id: 'reminders',
    questions: [
      'why didnt my reminder send',
      'how do reminders work',
      'how do i turn on nevermiss',
    ],
    answer:
      'Open NeverMiss Reminders and turn on the reminder types you want (confirmation, 24h, 1h, etc.). Nothing sends until a reminder is enabled. You can also set the bell on a calendar event for that meeting only.',
  },
  {
    id: 'pdf-size',
    questions: [
      'what size pdf',
      'pdf limit',
      'can i upload word',
    ],
    answer:
      'Upload clear, complete PDFs only (export Word to PDF first), up to 5MB. Named PDFs can be saved in Settings → Docs for reuse.',
  },
];

function normalize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cheap local match — returns null if nothing clear enough. */
export function matchHelpFaq(question: string): HelpFaq | null {
  const q = normalize(question);
  if (q.length < 4) return null;
  let best: { faq: HelpFaq; score: number } | null = null;
  for (const faq of HELP_FAQS) {
    for (const phrase of faq.questions) {
      const p = normalize(phrase);
      let score = 0;
      if (q.includes(p) || p.includes(q)) score = p.length;
      else {
        const words = p.split(' ').filter((w) => w.length > 2);
        const hits = words.filter((w) => q.includes(w)).length;
        if (hits >= Math.ceil(words.length * 0.6)) score = hits * 3;
      }
      if (score > 0 && (!best || score > best.score)) best = { faq, score };
    }
  }
  return best && best.score >= 6 ? best.faq : null;
}

export function suggestedQuestions(guide: PageHelpGuide): string[] {
  const base = [
    `What is ${guide.title} for?`,
    'What can PinOnIt do here?',
    'What can it not do?',
  ];
  if (guide.suggestedQuestions?.length) return [...guide.suggestedQuestions, ...base].slice(0, 5);
  return base;
}

/** Compact pack for the edge function — answers only from this. */
export function buildHelpContextPack(guide: PageHelpGuide): string {
  const lines = [
    `PAGE: ${guide.title}`,
    `PURPOSE: ${guide.purpose}`,
    'STEPS:',
    ...guide.steps.map((s, i) => `${i + 1}. ${s}`),
    'THIS PAGE CAN:',
    ...(guide.canDo?.length ? guide.canDo : ['(see product-wide can list)']).map((s) => `- ${s}`),
    'THIS PAGE CANNOT / LIMITS:',
    ...(guide.cannotDo?.length ? guide.cannotDo : ['(see product-wide cannot list)']).map((s) => `- ${s}`),
    'PRODUCT CAN:',
    ...PRODUCT_CAN.map((s) => `- ${s}`),
    'PRODUCT CANNOT:',
    ...PRODUCT_CANNOT.map((s) => `- ${s}`),
    'FAQS:',
    ...HELP_FAQS.map((f) => `Q: ${f.questions[0]}\nA: ${f.answer}`),
  ];
  return lines.join('\n');
}
