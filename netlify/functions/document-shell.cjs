/**
 * Serves /d/:token HTML with a signing preview instead of the homepage Calendly card.
 * iMessage reads these tags from the first HTML response and ignores the React app.
 */
const ORIGIN = 'https://pinonit.com';
const SUPABASE_URL = 'https://adlusgtlwgcfyxgeoias.supabase.co';
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbHVzZ3Rsd2djZnl4Z2VvaWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDM1MjAsImV4cCI6MjA5MzAxOTUyMH0.dLyk7j-9bss_ltAJfJb4kT6WACz93sywMIIDaYq9V1A';
const SIGN_IMAGE = `${ORIGIN}/og-sign-document.png`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shareKind(type, custom) {
  switch (type) {
    case 'boat_waiver': return 'boat waiver';
    case 'parental_consent_waiver': return 'family waiver';
    case 'waiver': return 'waiver';
    case 'nda': return 'NDA';
    case 'quote': return 'quote';
    case 'invoice': return 'invoice';
    case 'contract': return 'contract';
    case 'other': return (custom || '').trim() || 'document';
    default: return 'document';
  }
}

function shareTitle(doc) {
  const topic = (doc.topic || '').trim();
  if (topic) return topic;
  if (doc.document_type === 'quote') return 'Review this quote';
  if (doc.document_type === 'invoice') return 'Review this invoice';
  return `Sign this ${shareKind(doc.document_type, doc.document_type_custom)}`;
}

function shareDescription(doc) {
  const biz = (doc.sender_business_name || '').trim();
  const action = doc.document_type === 'quote' || doc.document_type === 'invoice'
    ? 'Tap to review.'
    : 'Tap to read and sign.';
  return biz ? `${action} From ${biz}.` : action;
}

function replaceMeta(html, attr, key, content) {
  const re = new RegExp(`<meta\\s[^>]*${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function inject(html, meta) {
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  out = replaceMeta(out, 'property', 'og:title', meta.title);
  out = replaceMeta(out, 'property', 'og:description', meta.description);
  out = replaceMeta(out, 'property', 'og:url', meta.url);
  out = replaceMeta(out, 'property', 'og:image', meta.image);
  out = replaceMeta(out, 'property', 'og:image:width', '1280');
  out = replaceMeta(out, 'property', 'og:image:height', '720');
  out = replaceMeta(out, 'name', 'twitter:card', 'summary_large_image');
  out = replaceMeta(out, 'name', 'twitter:title', meta.title);
  out = replaceMeta(out, 'name', 'twitter:description', meta.description);
  out = replaceMeta(out, 'name', 'twitter:image', meta.image);
  out = replaceMeta(out, 'name', 'description', meta.description);
  out = replaceMeta(out, 'name', 'robots', 'noindex, nofollow');
  return out;
}

async function loadDocument(token) {
  if (!/^[a-z0-9]{8,80}$/i.test(token)) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_document_by_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !data.document_type) return null;
    return data;
  } catch {
    return null;
  }
}

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const token = (params.token || '').trim();
  const pageUrl = token ? `${ORIGIN}/d/${token}` : `${ORIGIN}/d`;
  const doc = token ? await loadDocument(token) : null;
  const meta = {
    title: doc ? shareTitle(doc) : 'Sign this document',
    description: doc ? shareDescription(doc) : 'Tap to read and sign.',
    url: pageUrl,
    image: SIGN_IMAGE,
  };

  try {
    const spa = await fetch(`${ORIGIN}/index.html`, {
      headers: { 'User-Agent': 'PinOnIt-document-og' },
    });
    const html = await spa.text();
    if (!spa.ok || !html.includes('<html')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      };
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Robots-Tag': 'noindex, nofollow',
      },
      body: inject(html, meta),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: err instanceof Error ? err.message : 'Document unavailable',
    };
  }
};
