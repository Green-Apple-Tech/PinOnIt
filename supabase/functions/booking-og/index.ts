import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  DEFAULT_BOOKING_OG_IMAGE,
  DEFAULT_BOOKING_ORIGIN,
  bookingShareCanonical,
  bookingShareDescription,
  bookingShareImage,
  bookingShareTitle,
  type BookingShareHost,
} from '../_shared/bookingShareMeta.ts';

const APP_ORIGIN = (Deno.env.get('APP_URL') || DEFAULT_BOOKING_ORIGIN).replace(/\/$/, '');

const RESERVED = new Set([
  '',
  'login',
  'signup',
  'ref',
  'auth',
  'onboarding',
  'booking',
  'dashboard',
  'documents',
  'calendly-alternative',
  'nda',
  'reminders',
  'why-pinonit',
  'terms',
  'privacy',
  'sms-consent',
  'acceptable-use',
  'leaderboard',
  'status',
  'poll',
  'assets',
  'src',
  'static',
  'book',
]);

const CRAWLER_UA =
  /facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|googlebot|bingbot|pinterest|embed\/|preview|iframely|embedly|crawler|bot\b/i;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugFromRequest(req: Request): string {
  const url = new URL(req.url);
  const q = url.searchParams.get('slug')?.trim();
  if (q) return q.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
  const parts = url.pathname.split('/').filter(Boolean);
  const fn = parts.indexOf('booking-og');
  const after = fn >= 0 ? parts.slice(fn + 1) : parts;
  return (after[0] ?? '').trim();
}

function replaceMeta(html: string, attr: 'property' | 'name', key: string, content: string): string {
  const re = new RegExp(`<meta\\s[^>]*${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function injectShareTags(
  html: string,
  meta: { title: string; description: string; url: string; image: string },
): string {
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)} | PinOnIt</title>`);
  out = replaceMeta(out, 'property', 'og:title', meta.title);
  out = replaceMeta(out, 'property', 'og:description', meta.description);
  out = replaceMeta(out, 'property', 'og:url', meta.url);
  out = replaceMeta(out, 'property', 'og:image', meta.image);
  out = replaceMeta(out, 'name', 'twitter:title', meta.title);
  out = replaceMeta(out, 'name', 'twitter:description', meta.description);
  out = replaceMeta(out, 'name', 'twitter:image', meta.image);
  out = replaceMeta(out, 'name', 'description', meta.description);
  return out;
}

function crawlerHtml(meta: { title: string; description: string; url: string; image: string }): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const u = escapeHtml(meta.url);
  const i = escapeHtml(meta.image);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${t} | PinOnIt</title>
  <meta name="description" content="${d}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:image" content="${i}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${i}" />
  <link rel="canonical" href="${u}" />
</head>
<body>
  <p><a href="${u}">${t}</a></p>
</body>
</html>`;
}

function htmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const slug = slugFromRequest(req).toLowerCase();
  const canonical = slug && !RESERVED.has(slug)
    ? bookingShareCanonical(slug, APP_ORIGIN)
    : `${APP_ORIGIN}/`;

  let host: BookingShareHost | null = null;
  if (slug && !RESERVED.has(slug) && /^[a-z0-9][a-z0-9_-]{0,62}$/i.test(slug)) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data } = await admin
        .from('profiles')
        .select('slug, business_name, full_name, avatar_url, paid_booking_settings')
        .eq('slug', slug)
        .maybeSingle();
      host = (data as BookingShareHost | null) ?? null;
    }
  }

  const meta = {
    title: host ? bookingShareTitle(host) : 'Book a Meeting',
    description: host ? bookingShareDescription(host) : 'Pick a time to meet.',
    url: canonical,
    image: host ? bookingShareImage(host, APP_ORIGIN) : DEFAULT_BOOKING_OG_IMAGE,
  };

  const ua = req.headers.get('user-agent') ?? '';
  if (CRAWLER_UA.test(ua)) {
    return htmlResponse(crawlerHtml(meta));
  }

  try {
    const spa = await fetch(`${APP_ORIGIN}/index.html`, {
      headers: { 'User-Agent': 'PinOnIt-booking-og' },
    });
    if (spa.ok) {
      const html = await spa.text();
      return htmlResponse(injectShareTags(html, meta));
    }
  } catch (err) {
    console.error('booking-og spa fetch:', err);
  }

  return htmlResponse(crawlerHtml(meta));
});
