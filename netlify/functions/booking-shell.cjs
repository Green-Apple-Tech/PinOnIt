/**
 * Proxies booking-og HTML and forces Content-Type: text/html.
 * Supabase Edge returns HTML bodies as text/plain (CSP sandbox), which makes
 * iPhone Chrome render the SPA source as plain text.
 */
const BOOKING_OG =
  'https://adlusgtlwgcfyxgeoias.supabase.co/functions/v1/booking-og';
const SUPABASE_URL = 'https://adlusgtlwgcfyxgeoias.supabase.co';

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page not found | PinOnIt</title>
  <meta name="robots" content="noindex" />
</head>
<body>
  <h1>Page not found</h1>
  <p>This page doesn't exist or may have been moved.</p>
  <p><a href="/">Back to home</a></p>
</body>
</html>`;

function notFound() {
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Robots-Tag': 'noindex',
    },
    body: NOT_FOUND_HTML,
  };
}

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const raw =
    (params.slug || '').trim() ||
    (event.path || '').split('/').filter(Boolean).pop() ||
    '';
  const slug = raw.replace(/^\/+|\/+$/g, '').split('/')[0] || '';

  if (!slug || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(slug)) {
    return notFound();
  }

  const anon =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  try {
    if (anon) {
      const check = await fetch(
        `${SUPABASE_URL}/rest/v1/public_host_profiles?slug=eq.${encodeURIComponent(slug.toLowerCase())}&select=slug`,
        {
          headers: {
            Authorization: `Bearer ${anon}`,
            apikey: anon,
            Accept: 'application/json',
          },
        },
      );
      if (check.ok) {
        const rows = await check.json();
        if (Array.isArray(rows) && rows.length === 0) return notFound();
      }
    }

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
      if (res.status === 404) return notFound();
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
