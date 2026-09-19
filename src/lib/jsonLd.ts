import type { BlogPost } from './blogPosts';
import {
  PINONIT_CORE_SENTENCE,
  PINONIT_ORG,
  PINONIT_PRICE_LABEL,
  PINONIT_SOFTWARE,
  PINONIT_SOFTWARE_DESCRIPTION,
  PINONIT_WHO,
} from './seoIdentity';
import type { IntentFaq, IntentPage } from './seoIntentPages';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: PINONIT_ORG.name,
    legalName: PINONIT_ORG.legalName,
    url: PINONIT_ORG.url,
    logo: PINONIT_ORG.logo,
    contactPoint: {
      '@type': 'ContactPoint',
      email: PINONIT_ORG.email,
      contactType: 'customer support',
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: PINONIT_SOFTWARE.name,
    description: PINONIT_SOFTWARE_DESCRIPTION,
    applicationCategory: PINONIT_SOFTWARE.applicationCategory,
    operatingSystem: PINONIT_SOFTWARE.operatingSystem,
    url: PINONIT_ORG.url,
    image: PINONIT_ORG.logo,
    screenshot: 'https://pinonit.com/og-why-pinonit.png',
    audience: {
      '@type': 'Audience',
      audienceType: PINONIT_WHO,
    },
    featureList: [
      'Quote by text',
      'Sign-by-Text',
      'Booking link with Google and Outlook sync',
      'SMS WhatsApp email and voice reminders',
      'Two-way SMS cancel or reschedule',
      'NDAs waivers invoices and receipts by text',
    ],
    offers: {
      '@type': 'Offer',
      price: PINONIT_SOFTWARE.price,
      priceCurrency: PINONIT_SOFTWARE.priceCurrency,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: PINONIT_SOFTWARE.price,
        priceCurrency: PINONIT_SOFTWARE.priceCurrency,
        billingDuration: PINONIT_SOFTWARE.billingPeriod,
      },
    },
  };
}

export function faqPageJsonLd(faqs: IntentFaq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function blogPostingJsonLd(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title.replace(/ \| PinOnIt$/, ''),
    description: post.description,
    datePublished: post.datePublished,
    dateModified: post.datePublished,
    url: post.canonical,
    mainEntityOfPage: post.canonical,
    author: { '@type': 'Organization', name: PINONIT_ORG.name, url: PINONIT_ORG.url },
    publisher: {
      '@type': 'Organization',
      name: PINONIT_ORG.name,
      logo: { '@type': 'ImageObject', url: PINONIT_ORG.logo },
    },
    image: PINONIT_ORG.logo,
    isPartOf: { '@type': 'Blog', name: 'PinOnIt field notes', url: `${PINONIT_ORG.url}/blog` },
  };
}

export function blogIndexJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'PinOnIt field notes',
    url: `${PINONIT_ORG.url}/blog`,
    description:
      'How-to notes for quoting, signing, booking, and reminding from a phone. Product pages for those jobs live on their own URLs.',
    publisher: { '@type': 'Organization', name: PINONIT_ORG.name, url: PINONIT_ORG.url },
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: PINONIT_ORG.name,
    url: PINONIT_ORG.url,
    description: PINONIT_CORE_SENTENCE,
    publisher: { '@type': 'Organization', name: PINONIT_ORG.name, url: PINONIT_ORG.url },
  };
}

export function intentWebPageJsonLd(page: IntentPage) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.h1,
    description: page.metaDescription,
    url: page.canonical,
    isPartOf: { '@type': 'WebSite', name: 'PinOnIt', url: PINONIT_ORG.url },
    about: PINONIT_CORE_SENTENCE,
  };
}

/** Homepage FAQ — keep in sync with src/components/landing/LandingFaq.tsx (do not edit that file from SEO work). */
export const HOMEPAGE_FAQ: IntentFaq[] = [
  {
    q: 'What is PinOnIt?',
    a: 'You run the job by text. Quote it, get it signed, send a booking link, and remind them before they show up. They tap a normal SMS — no app, no account.',
  },
  {
    q: 'Does my customer need an app?',
    a: 'No. They get a normal text and open a link in their phone’s browser. Nothing to install, no account to create, no email required.',
  },
  {
    q: 'How do they sign?',
    a: 'Sign-by-Text: we text a code to their phone, they draw their signature with a finger. Meets federal ESIGN Act requirements. Every signature includes a complete audit record. PinOnIt does not provide legal advice.',
  },
  {
    q: 'How do I get paid?',
    a: 'Paste your own Zelle, Cash App, Venmo, or PayPal link. After they approve, they see Pay Now. PinOnIt never takes the money. When you’ve got it, one tap on the quote texts a receipt.',
  },
  {
    q: 'What about no-shows?',
    a: 'Reminders go out by text, WhatsApp, email, or a voice call. They reply 1 to cancel or 2 to reschedule. That’s the phone-tag loop, closed.',
  },
  {
    q: 'Does it work with my calendar?',
    a: 'Yes. Google and Outlook stay in sync (including new bookings). Apple Calendar connects with a private iCloud link so busy times are blocked. You can import from Calendly if you’re switching.',
  },
  {
    q: `Is it really ${PINONIT_PRICE_LABEL} a month?`,
    a: 'Yes. One plan. Free trial first.',
  },
];
