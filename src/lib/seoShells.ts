/** Crawlable copy for public pages that still boot the React app. Must match the page visitors see. */

export type SeoShell = {
  file: string;
  title: string;
  description: string;
  canonical: string;
  h1: string;
  paragraphs: string[];
  links: { href: string; label: string }[];
};

const LINKS = [
  { href: '/docusign-alternative', label: 'Affordable DocuSign alternative' },
  { href: '/sign-by-text', label: 'Sign documents by text' },
  { href: '/calendly-alternative', label: 'Calendly alternative with SMS reminders' },
  { href: '/sms-appointment-reminders', label: 'Appointment scheduling with SMS reminders' },
  { href: '/send-estimate-by-text', label: 'Send estimates by text' },
  { href: '/contractor-booking-app', label: 'Appointment scheduling for contractors' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/blog', label: 'Field notes' },
];

export const SEO_SHELLS: SeoShell[] = [
  {
    file: 'why-pinonit.html',
    title: 'Calendly alternative for small business | PinOnIt',
    description:
      'PinOnIt is the Calendly alternative for small business: Sign by Text, easy booking, WhatsApp and voice reminders, two-way SMS, quotes, QR codes — from $9.99/mo.',
    canonical: 'https://pinonit.com/why-pinonit',
    h1: 'Calendly books meetings. PinOnIt runs your business.',
    paragraphs: [
      'Sign by Text, easy booking, WhatsApp reminders, calendar write-back, two-way SMS, and a paid storefront. $9.99/month after trial. PinOnIt does not include every Calendly feature.',
    ],
    links: LINKS,
  },
  {
    file: 'sign-now.html',
    title: 'Sign your doc by text | PinOnIt',
    description:
      'Text a one-page document. They tap the link, enter a code, and sign. No app and no account for them. PinOnIt also books appointments from a link.',
    canonical: 'https://pinonit.com/sign-now',
    h1: 'Sign your doc by text',
    paragraphs: [
      'They tap the link, enter a code, and sign with a finger. No app and no account on their end.',
      'Create your account. Add their name, phone, and the one-page document. We text them the link.',
      'The code shows someone has that phone. It does not by itself prove legal identity.',
    ],
    links: LINKS,
  },
  {
    file: 'legal-templates.html',
    title: 'Waiver and liability form templates — PinOnIt',
    description:
      'PinOnIt built-in waivers are general starting points. Requirements vary by state and activity. Download a form from a legal template site and upload it once to send for signature.',
    canonical: 'https://pinonit.com/legal-templates',
    h1: 'Waiver and liability form templates',
    paragraphs: [
      'Built-in waivers are starting language, not legal advice. Download the form you need, or use a PDF your attorney already reviewed, and upload it once to send by text.',
    ],
    links: LINKS,
  },
  {
    file: 'nda.html',
    title: 'Send an NDA over text | PinOnIt Doc Center',
    description:
      'Send an NDA over text in 30 seconds. No app or login for the other person — they verify by SMS and sign on their phone. Also waivers, contracts, invoices, and receipts.',
    canonical: 'https://pinonit.com/nda',
    h1: 'Send an NDA over text — verified and signed in 30 seconds',
    paragraphs: [
      'No app, no login, no downloads for the other person. Just their phone number.',
      'They get a one-time code, then sign. The code checks access to the phone. It does not by itself prove who is holding it.',
    ],
    links: LINKS,
  },
  {
    file: 'reminders.html',
    title: 'NeverMiss Reminders | PinOnIt',
    description:
      'SMS, WhatsApp, email, and voice reminders so bookings and appointments actually get shown up to. No extra apps for your clients.',
    canonical: 'https://pinonit.com/reminders',
    h1: 'Reminders they actually get — text, WhatsApp, email, and a call',
    paragraphs: [
      'A booking is worthless if nobody shows. PinOnIt sends reminders by SMS, WhatsApp, email, and voice. Guests can text back to reschedule.',
    ],
    links: LINKS,
  },
  {
    file: 'terms.html',
    title: 'Terms of Service | PinOnIt',
    description:
      'Terms of Service for PinOnIt, a DBA of Miami Expeditions LLC, including SMS and electronic signature responsibilities.',
    canonical: 'https://pinonit.com/terms',
    h1: 'Terms of Service',
    paragraphs: [
      'These Terms govern the PinOnIt platform, a DBA of Miami Expeditions LLC.',
      'SMS two-factor authentication verifies access to a phone number but does not conclusively establish the legal identity of the person signing.',
      'The full terms, including billing, SMS, and acceptable use, are on this page.',
    ],
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/sms-consent', label: 'SMS Consent' },
      { href: '/acceptable-use', label: 'Acceptable Use' },
    ],
  },
  {
    file: 'privacy.html',
    title: 'Privacy Policy | PinOnIt',
    description: 'How PinOnIt, a DBA of Miami Expeditions LLC, handles account and booking information.',
    canonical: 'https://pinonit.com/privacy',
    h1: 'Privacy Policy',
    paragraphs: [
      'This policy describes how PinOnIt handles information for the scheduling, signature, and reminder service.',
    ],
    links: [{ href: '/terms', label: 'Terms of Service' }],
  },
  {
    file: 'sms-consent.html',
    title: 'SMS Consent | PinOnIt',
    description: 'How PinOnIt asks for permission before sending appointment and document text messages.',
    canonical: 'https://pinonit.com/sms-consent',
    h1: 'SMS Consent & Opt-In',
    paragraphs: [
      'PinOnIt sends appointment and document texts only when a person provides a mobile number and agrees to receive them. Message frequency varies. Message and data rates may apply. Reply STOP to opt out.',
    ],
    links: [{ href: '/terms', label: 'Terms of Service' }],
  },
  {
    file: 'acceptable-use.html',
    title: 'Acceptable Use | PinOnIt',
    description: 'What you may and may not do with PinOnIt messaging, booking, and signatures.',
    canonical: 'https://pinonit.com/acceptable-use',
    h1: 'Acceptable Use Policy',
    paragraphs: [
      'PinOnIt is for lawful booking, reminders, quotes, and single-signature business documents. It is not for spam, fraud, or document types that need a notary or several signers.',
    ],
    links: [{ href: '/terms', label: 'Terms of Service' }],
  },
  {
    file: 'status.html',
    title: 'Status | PinOnIt',
    description: 'Current status of PinOnIt booking, signatures, and reminders.',
    canonical: 'https://pinonit.com/status',
    h1: 'Checking System Status...',
    paragraphs: ['This page reports whether PinOnIt booking, signatures, and reminders are up. The status updates after the page checks each service.'],
    links: [{ href: '/', label: 'PinOnIt home' }],
  },
  {
    file: 'leaderboard.html',
    title: 'Referral leaderboard | PinOnIt',
    description: 'Public referral leaderboard for PinOnIt Pro.',
    canonical: 'https://pinonit.com/leaderboard',
    h1: 'Top referrers',
    paragraphs: [
      'Every Pro referral earns $1 off your monthly bill. Refer 10 and your plan is free. Refer 11 or more and PinOnIt pays you.',
    ],
    links: [{ href: '/', label: 'PinOnIt home' }],
  },
];

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function injectSeoShell(indexHtml: string, shell: SeoShell): string {
  let html = indexHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(shell.title)}</title>`);
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${esc(shell.description)}$2`,
  );
  const canonical = `<link rel="canonical" href="${esc(shell.canonical)}" />`;
  if (html.includes('rel="canonical"')) {
    html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, canonical);
  } else {
    html = html.replace('</title>', `</title>\n    ${canonical}`);
  }
  html = html.replace(
    /(<meta property="og:url" content=")[^"]*(")/,
    `$1${esc(shell.canonical)}$2`,
  );
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${esc(shell.title)}$2`,
  );
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${esc(shell.description)}$2`,
  );
  const snapshot = [
    `<h1>${esc(shell.h1)}</h1>`,
    ...shell.paragraphs.map((p) => `<p>${esc(p)}</p>`),
    `<nav aria-label="Related">${shell.links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(' ')}</nav>`,
  ].join('');
  if (!html.includes('<!--seo-snapshot-->') || !html.includes('<!--/seo-snapshot-->')) {
    throw new Error('index.html is missing seo-snapshot markers');
  }
  html = html.replace(/<!--seo-snapshot-->[\s\S]*?<!--\/seo-snapshot-->/, `<!--seo-snapshot-->${snapshot}<!--/seo-snapshot-->`);
  return html;
}
