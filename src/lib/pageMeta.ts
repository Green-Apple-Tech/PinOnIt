import { useEffect } from 'react';

/** Homepage / product share card (keep in sync with index.html). */
export const SITE_OG = {
  title: 'Your mini office by text | PinOnIt',
  description:
    'Booking + Sign by Text — waivers, NDAs, addendums, quotes, invoices. One simple app. $8.99/mo.',
  url: 'https://pinonit.com',
  image: 'https://pinonit.com/og-why-pinonit.png',
  /** Large landscape banner for the marketing site. */
  twitterCard: 'summary_large_image' as const,
};

/** Booking-link share card — smaller side thumbnail in iMessage / Twitter. */
export const BOOKING_OG_CARD = 'summary' as const;

const DEFAULTS = SITE_OG;

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function usePageMeta(opts: {
  title: string;
  description: string;
  url: string;
  image: string;
  /** Short title for iMessage / social cards (falls back to title). */
  ogTitle?: string;
  /** twitter:card — use `summary` for a smaller thumbnail. */
  twitterCard?: 'summary' | 'summary_large_image';
}) {
  useEffect(() => {
    const prev = document.title;
    document.title = opts.title;
    upsertMeta('meta[name="description"]', { name: 'description', content: opts.description });
    upsertMeta('meta[name="keywords"]', {
      name: 'keywords',
      content:
        'run business by text, SMS booking, waiver by text, NDA by SMS, invoice by text, Calendly alternative, Doc Center, PinOnIt',
    });
    // iMessage truncates hard — prefer a short og/twitter title when provided
    const shareTitle = opts.ogTitle ?? opts.title;
    const card = opts.twitterCard ?? SITE_OG.twitterCard;
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: shareTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: opts.description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: opts.url });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: opts.image });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: card });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: shareTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: opts.description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: opts.image });
    upsertLink('canonical', opts.url);
    return () => {
      document.title = prev || DEFAULTS.title;
      upsertMeta('meta[name="description"]', { name: 'description', content: DEFAULTS.description });
      upsertMeta('meta[property="og:title"]', { property: 'og:title', content: DEFAULTS.title });
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: DEFAULTS.description });
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: DEFAULTS.url });
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: DEFAULTS.image });
      upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: DEFAULTS.twitterCard });
      upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: DEFAULTS.title });
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: DEFAULTS.description });
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: DEFAULTS.image });
      upsertLink('canonical', DEFAULTS.url);
    };
  }, [opts.title, opts.description, opts.url, opts.image, opts.ogTitle, opts.twitterCard]);
}
