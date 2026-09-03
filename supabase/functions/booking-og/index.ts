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
const PAGE_TTL_MS = 5 * 60 * 1000;

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

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/i;

let spaCache: { html: string; exp: number } | null = null;
const pageCache = new Map<string, { html: string; exp: number }>();

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
  const after = (fn >= 0 ? parts.slice(fn + 1) : parts).filter((p) => p !== 'index.html');
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

function htmlPage(body: string, cacheControl: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline; filename="index.html"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cacheControl,
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

  const slug = slugFromRequest(req).toLowerCase();
  const cacheKey = slug || '_';
  const cached = pageCache.get(cacheKey);
  if (cached && cached.exp > Date.now()) {
    return htmlPage(cached.html, 'public, max-age=120');
  }

  const shell = await spaHtml();
  if (!shell) {
    return new Response('Booking page unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const canonical = slug && !RESERVED.has(slug)
    ? bookingShareCanonical(slug, APP_ORIGIN)
    : `${APP_ORIGIN}/`;

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

  const html = injectShareTags(shell, meta);
  pageCache.set(cacheKey, { html, exp: Date.now() + PAGE_TTL_MS });
  if (pageCache.size > 500) {
    const first = pageCache.keys().next().value;
    if (first) pageCache.delete(first);
  }
  return htmlPage(html, 'public, max-age=120');
});
