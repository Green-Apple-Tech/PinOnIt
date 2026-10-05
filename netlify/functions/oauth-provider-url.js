/**
 * Supabase copies redirect_to onto the Google/Microsoft link. iPhone Chrome
 * then opens a broken accounts.google.com URL ("400. That's an error.").
 * Keep this cleaner in sync with cleanProviderAuthUrl in src/lib/oauthLogin.ts.
 */
const AUTHORIZE_ORIGIN = 'https://adlusgtlwgcfyxgeoias.supabase.co';
const AUTHORIZE_PATH = '/auth/v1/authorize';
const LEAKED = ['redirect_to', 'skip_http_redirect', 'provider', 'scopes', 'apikey'];

function cleanProviderAuthUrl(raw) {
  const url = new URL(raw);
  const host = url.hostname;
  const allowed =
    url.protocol === 'https:' &&
    (host === 'accounts.google.com' ||
      host === 'login.microsoftonline.com' ||
      host.endsWith('.microsoftonline.com'));
  if (!allowed) throw new Error('Sign-in link was invalid.');
  for (const key of LEAKED) url.searchParams.delete(key);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
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
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  let authorizeUrl = '';
  try {
    authorizeUrl = JSON.parse(event.body || '{}').authorizeUrl || '';
  } catch {
    return json(400, { error: 'Sign-in link was invalid.' });
  }

  let parsed;
  try {
    parsed = new URL(authorizeUrl);
  } catch {
    return json(400, { error: 'Sign-in link was invalid.' });
  }
  const provider = parsed.searchParams.get('provider');
  if (
    parsed.origin !== AUTHORIZE_ORIGIN ||
    parsed.pathname !== AUTHORIZE_PATH ||
    (provider !== 'google' && provider !== 'azure')
  ) {
    return json(400, { error: 'Sign-in link was invalid.' });
  }

  try {
    const res = await fetch(authorizeUrl, { redirect: 'manual' });
    const location = res.headers.get('location');
    if (!location) return json(502, { error: 'Could not start sign-in. Try again.' });
    return json(200, { url: cleanProviderAuthUrl(location) });
  } catch {
    return json(502, { error: 'Could not start sign-in. Try again.' });
  }
};
