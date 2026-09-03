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
const SPA_TTL_MS = 5 * 60 * 1000;
const OG_TTL_MS = 5 * 60 * 1000;

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

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/i;

let spaCache: { html: string; exp: number } | null = null;
const ogCache = new Map<string, { html: string; exp: number }>();

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

function htmlResponse(body: string, cacheControl: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cacheControl,
      Vary: 'User-Agent',
    },
  });
}

async function spaHtml(): Promise<string | null> {
  const now = Date.now();
  if (spaCache && spaCache.exp > now) return spaCache.html;
  try {
    const spa = await fetch(`${APP_ORIGIN}/index.html`, {
      headers: { 'User-Agent': 'PinOnIt-booking-og' },
    });
    if (!spa.ok) return spaCache?.html ?? null;
    const html = await spa.text();
    spaCache = { html, exp: now + SPA_TTL_MS };
    return html;
  } catch (err) {
    console.error('booking-og spa fetch:', err);
    return spaCache?.html ?? null;
  }
}

async function loadHost(slug: string): Promise<BookingShareHost | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return null;
  const client = createClient(supabaseUrl, anonKey);
  const { data } = await client
    .from('public_host_profiles')
    .select('slug, business_name, full_name, avatar_url, paid_booking_settings')
    .eq('slug', slug)
    .maybeSingle();
  return (data as BookingShareHost | null) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const ua = req.headers.get('user-agent') ?? '';
  const isCrawler = CRAWLER_UA.test(ua);

  // Humans only need the SPA shell. Client JS fills OG; skip DB and extra work.
  if (!isCrawler) {
    const html = await spaHtml();
    if (html) {
      return htmlResponse(html, 'private, max-age=30');
    }
  }

  const slug = slugFromRequest(req).toLowerCase();
  const canonical = slug && !RESERVED.has(slug)
    ? bookingShareCanonical(slug, APP_ORIGIN)
    : `${APP_ORIGIN}/`;

  const cacheKey = slug || '_';
  const cached = ogCache.get(cacheKey);
  if (cached && cached.exp > Date.now()) {
    return htmlResponse(cached.html, 'public, max-age=300');
  }

  let host: BookingShareHost | null = null;
  if (slug && !RESERVED.has(slug) && SLUG_RE.test(slug)) {
    host = await loadHost(slug);
  }

  const meta = {
    title: host ? bookingShareTitle(host) : 'Book a Meeting',
    description: host ? bookingShareDescription(host) : 'Pick a time to meet.',
    url: canonical,
    image: host ? bookingShareImage(host, APP_ORIGIN) : DEFAULT_BOOKING_OG_IMAGE,
  };
  const html = crawlerHtml(meta);
  ogCache.set(cacheKey, { html, exp: Date.now() + OG_TTL_MS });
  if (ogCache.size > 500) {
    const first = ogCache.keys().next().value;
    if (first) ogCache.delete(first);
  }
  return htmlResponse(html, 'public, max-age=300');
});
