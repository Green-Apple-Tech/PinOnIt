/**
 * Proxies booking-og HTML and forces Content-Type: text/html.
 * Supabase Edge returns HTML bodies as text/plain (CSP sandbox), which makes
 * iPhone Chrome render the SPA source as plain text.
 */
const BOOKING_OG =
  'https://adlusgtlwgcfyxgeoias.supabase.co/functions/v1/booking-og';

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const raw =
    (params.slug || '').trim() ||
    (event.path || '').split('/').filter(Boolean).pop() ||
    '';
  const slug = raw.replace(/^\/+|\/+$/g, '').split('/')[0] || '';

  if (!slug || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(slug)) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Not found',
    };
  }

  const anon =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  try {
    const res = await fetch(`${BOOKING_OG}/${encodeURIComponent(slug.toLowerCase())}`, {
      headers: anon
        ? {
            Authorization: `Bearer ${anon}`,
            apikey: anon,
          }
        : undefined,
    });
    const html = await res.text();
    if (!res.ok) {
      return {
        statusCode: res.status >= 400 ? res.status : 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: html.slice(0, 500) || 'Booking page unavailable',
      };
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
      },
      body: html,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: err instanceof Error ? err.message : 'Booking page unavailable',
    };
  }
};
