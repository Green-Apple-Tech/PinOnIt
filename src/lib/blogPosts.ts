import { PINONIT_ORG } from './seoIdentity';
import { INTENT_PATHS } from './seoIntentPages';

export type BlogLink = { href: string; text: string };

export type BlogBlock =
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'p'; before: string; link: BlogLink; after: string };

export type BlogPost = {
  slug: string;
  path: string;
  title: string;
  description: string;
  datePublished: string;
  relatedPath: string;
  blocks: BlogBlock[];
  canonical: string;
};

export const BLOG_INDEX = {
  path: '/blog',
  title: 'Field notes | PinOnIt',
  h1: 'Field notes',
  description:
    'How-to notes for quoting, signing, booking, and reminding from a phone. Product pages for those jobs live on their own URLs.',
  canonical: 'https://pinonit.com/blog',
};

function post(
  slug: string,
  title: string,
  description: string,
  relatedPath: string,
  blocks: BlogBlock[],
): BlogPost {
  return {
    slug,
    path: `/blog/${slug}`,
    title: `${title} | PinOnIt`,
    description,
    datePublished: '2026-09-15',
    relatedPath,
    blocks,
    canonical: `${PINONIT_ORG.url}/blog/${slug}`,
  };
}

/** Supporting articles only. Do not reuse intent-page H1s or slugs. */
export const BLOG_POSTS: BlogPost[] = [
  post(
    'how-to-share-a-booking-link-from-the-job-site',
    'How to share a booking link from the job site',
    'Send the booking link in the same text you already use to confirm the address — while you are still in the driveway.',
    '/calendly-alternative',
    [
      {
        type: 'p',
        text: 'After a walkthrough, people still say they will look at the calendar later. Later rarely comes. The booking link belongs in the same text you already send to confirm the address, while you are still on the property.',
      },
      {
        type: 'p',
        text: 'A useful link is short, shows real busy times from the calendar you actually use, and does not ask the customer to create an account. Emailing a meeting page works for a Zoom slot on a laptop. It works less well when the other person is a homeowner in work clothes who will not open a computer tonight.',
      },
      {
        type: 'p',
        before:
          'If you need that kind of booking page — busy times, a link that works on a phone, and the office work after they pick a slot — we keep it on a ',
        link: { href: '/calendly-alternative', text: 'Calendly alternative for small business' },
        after: '.',
      },
      { type: 'h2', text: 'What belongs in the text' },
      {
        type: 'p',
        text: 'Keep the message to the job, the window you can do it, and the link. Skip a paragraph about your software. If they have to forward the text to a spouse, a long pitch dies in the thread.',
      },
      {
        type: 'p',
        text: 'Set duration and buffer so the calendar is honest. A 30-minute estimate visit that always runs 50 minutes trains people to ignore the slot they picked.',
      },
    ],
  ),
  post(
    'getting-a-signature-without-an-email-envelope',
    'Getting a signature without an email envelope',
    'Waivers and NDAs at a gate or in a parking lot do not wait for someone to open an envelope on a laptop.',
    '/docusign-alternative-simple-signatures',
    [
      {
        type: 'p',
        text: 'An email envelope assumes a desk, an inbox they check, and time. A liability waiver at the gate has none of those. The other person is holding a phone and wants to come in.',
      },
      {
        type: 'p',
        text: 'The workable pattern is: send a link to the number in front of you, they tap it, enter a one-time code, read the document, and sign with a finger. You keep an audit record. They never create an account.',
      },
      {
        type: 'p',
        before: 'Everyday waivers and NDAs do not need a contract desk. For those, PinOnIt keeps a ',
        link: {
          href: '/docusign-alternative-simple-signatures',
          text: 'simpler alternative to DocuSign for everyday signatures',
        },
        after: '.',
      },
      { type: 'h2', text: 'When the envelope is still the right tool' },
      {
        type: 'p',
        text: 'Use a full e-sign suite when you need routing, bulk send, or a closing that a lawyer designed around that stack. Do not force a trampoline park or a walkthrough NDA through that workflow just because it is what the office used last year.',
      },
    ],
  ),
  post(
    'pricing-the-job-before-you-leave-the-driveway',
    'Pricing the job before you leave the driveway',
    'Write the number while the work is still in front of you, then send it as a real estimate — not a figure shouted at the door.',
    '/send-quote-by-text',
    [
      {
        type: 'p',
        text: 'The accurate number is the one you write while the work is still in front of you. Once you are in the truck, the quote becomes a round number you hope they remember, or a PDF that sits in email until they forget why it was that price.',
      },
      {
        type: 'p',
        text: 'A driveway estimate should show line items, tax if you charge it, how many days the number is good, and how they pay with the app they already have. Status on your side should tell you sent, viewed, approved, or paid — silence is not a status.',
      },
      {
        type: 'p',
        before:
          'When you are ready to send that as a real estimate instead of a shouted figure, that flow is ',
        link: { href: '/send-quote-by-text', text: 'send a quote by text' },
        after: '.',
      },
      { type: 'h2', text: 'What the customer should see' },
      {
        type: 'p',
        text: 'They should not have to download anything. They open the SMS, read the lines, and approve or pay. Signature stays off unless you actually need a signed approval. Turning every estimate into a contract slows the jobs that were only asking for a price.',
      },
    ],
  ),
  post(
    'why-email-reminders-still-leave-empty-chairs',
    'Why email reminders still leave empty chairs',
    'Appointment confirmations that land in a desktop inbox are easy to miss. A reminder people can answer on the phone is harder to ignore.',
    '/sms-appointment-reminders',
    [
      {
        type: 'p',
        text: 'A booking is only a hold on the calendar. The empty chair happens later, when the reminder went to an inbox they check on a laptop and they are not at a laptop.',
      },
      {
        type: 'p',
        text: 'Email confirmations are fine as a receipt. They are a weak last ping. The message that changes a no-show is the one on the phone, close to the appointment, that they can answer without opening an app they do not have.',
      },
      {
        type: 'p',
        before: 'If that reminder has to arrive as a text they can answer, the product page is ',
        link: { href: '/sms-appointment-reminders', text: 'SMS appointment reminders' },
        after: '.',
      },
      { type: 'h2', text: 'Let them answer the reminder' },
      {
        type: 'p',
        text: 'A one-way blast still leaves you guessing. Reply 1 to cancel and 2 to reschedule closes the loop. Keep marketing blasts off this channel — these are appointment messages the guest opted into, not a list you bought.',
      },
    ],
  ),
  post(
    'collecting-a-waiver-on-a-phone-at-check-in',
    'Collecting a waiver on a phone at check-in',
    'Clipboards stall a line. A waiver on the guest’s phone keeps the gate moving and still leaves an audit record.',
    '/esignature-by-text',
    [
      {
        type: 'p',
        text: 'A clipboard at check-in looks official and then becomes a pile of paper you cannot search. The guest is already holding a phone. The waiver can live there.',
      },
      {
        type: 'p',
        text: 'They tap a text, enter a code sent to that number, read the form, check consent, and sign with a finger. You keep the verified number, timestamps, and a hash of what they signed. You do not hand them an account to create while a line forms behind them.',
      },
      {
        type: 'p',
        before: 'The check-in flow we use is ',
        link: { href: '/esignature-by-text', text: 'eSignature by text' },
        after: ': SMS link, one-time code, finger signature, audit record.',
      },
      { type: 'h2', text: 'What the audit record is for' },
      {
        type: 'p',
        text: 'It is for the document you actually sent that day, not a stack of photocopies. Built-in templates are starting language. Upload an attorney-reviewed PDF when the activity or state needs specific wording. This is not for wills, notarized deeds, or multi-signer closings.',
      },
    ],
  ),
];

export function blogPostBySlug(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}

export function blogLinkedBlocks(post: BlogPost) {
  return post.blocks.filter((b): b is Extract<BlogBlock, { link: BlogLink }> => 'link' in b);
}

export function isIntentLandingPath(path: string) {
  return INTENT_PATHS.includes(path);
}
