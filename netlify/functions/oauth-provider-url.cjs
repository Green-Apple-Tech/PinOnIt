/**
 * Supabase copies redirect_to onto the Google/Microsoft link, and its scope uses
 * "+". iPhone Chrome turns those pluses into raw spaces and Google shows
 * "400. That's an error." Rebuild an allowlisted link and 302 the browser to it.
 * Keep cleanProviderAuthUrl in sync with src/lib/oauthLogin.ts.
 */
const AUTHORIZE_ORIGIN = 'https://adlusgtlwgcfyxgeoias.supabase.co';
const AUTHORIZE_PATH = '/auth/v1/authorize';
const PROVIDER_AUTH_PARAMS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
  'access_type',
  'include_granted_scopes',
  'hd',
  'login_hint',
];
const REQUIRED = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state'];

function dedupedScope(scope) {
  const seen = [];
  for (const part of String(scope).split(/\s+/)) {
    if (!part || seen.includes(part)) continue;
    seen.push(part);
  }
  return seen.join(' ');
}

function cleanProviderAuthUrl(raw) {
  const url = new URL(raw);
  const host = url.hostname;
  const allowedHost =
    url.protocol === 'https:' &&
    (host === 'accounts.google.com' ||
      host === 'login.microsoftonline.com' ||
      host.endsWith('.microsoftonline.com'));
  if (!allowedHost) throw new Error('Sign-in link was invalid.');
  const params = new URLSearchParams();
  for (const key of PROVIDER_AUTH_PARAMS) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    params.set(key, key === 'scope' ? dedupedScope(value) : value);
  }
  params.set('prompt', 'select_account');
  for (const key of REQUIRED) {
    if (!params.get(key)) throw new Error('Sign-in link was invalid.');
  }
  const query = params.toString().replace(/\+/g, '%20');
  return `${url.origin}${url.pathname}?${query}`;
}

function readBody(event) {
  let body = event.body || '';
  if (event.isBase64Encoded && body) body = Buffer.from(body, 'base64').toString('utf8');
  return body;
}

function authorizeUrlFrom(event) {
  const body = readBody(event);
  const type = String(event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();
  if (type.includes('application/json')) {
    return JSON.parse(body || '{}').authorizeUrl || '';
  }
  return new URLSearchParams(body).get('authorizeUrl') || '';
}

function html(statusCode, message) {
  const safe = String(message).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in</title><p>${safe}</p><p><a href="/login">Back to sign in</a></p>`,
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

exports.cleanProviderAuthUrl = cleanProviderAuthUrl;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return html(405, 'Sign-in could not start. Go back and try again.');

  const type = String(event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();
  const wantsJson = type.includes('application/json');
  const fail = (status, message) => (wantsJson ? json(status, { error: message }) : html(status, message));

  let authorizeUrl = '';
  try {
    authorizeUrl = authorizeUrlFrom(event);
  } catch {
    return fail(400, 'Sign-in link was invalid.');
  }

  let parsed;
  try {
    parsed = new URL(authorizeUrl);
  } catch {
    return fail(400, 'Sign-in link was invalid.');
  }
  const provider = parsed.searchParams.get('provider');
  if (
    parsed.origin !== AUTHORIZE_ORIGIN ||
    parsed.pathname !== AUTHORIZE_PATH ||
    (provider !== 'google' && provider !== 'azure')
  ) {
    return fail(400, 'Sign-in link was invalid.');
  }

  try {
    const res = await fetch(authorizeUrl, { redirect: 'manual' });
    const location = res.headers.get('location');
    if (!location) return fail(502, 'Could not start sign-in. Try again.');
    const url = cleanProviderAuthUrl(location);
    if (wantsJson) return json(200, { url });
    return {
      statusCode: 302,
      headers: {
        Location: url,
        'Cache-Control': 'no-store',
      },
      body: '',
    };
  } catch {
    return fail(502, 'Could not start sign-in. Try again.');
  }
};
