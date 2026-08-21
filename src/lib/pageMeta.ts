import { useEffect } from 'react';

const DEFAULTS = {
  title: 'PinOnIt — Calendar scheduling & super reminders. Never miss a meeting again.',
  description:
    'PinOnIt is a calendar scheduler and super reminder app. Email, SMS, WhatsApp, and voice so you never miss a meeting — plus booking links, QR codes, and email signatures.',
  url: 'https://pinonit.com',
  image: 'https://pinonit.com/pinonit_logo.png',
};

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
}) {
  useEffect(() => {
    const prev = document.title;
    document.title = opts.title;
    upsertMeta('meta[name="description"]', { name: 'description', content: opts.description });
    upsertMeta('meta[name="keywords"]', {
      name: 'keywords',
      content: 'Calendly alternative for small business, PinOnIt vs Calendly, SMS reminders, WhatsApp booking reminders',
    });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: opts.title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: opts.description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: opts.url });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: opts.image });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: opts.title });
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
      upsertLink('canonical', DEFAULTS.url);
    };
  }, [opts.title, opts.description, opts.url, opts.image]);
}
