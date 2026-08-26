/** OAuth token refresh for Google Calendar and Microsoft Graph. */

export type ConnectedCalendarRow = {
  id: string;
  host_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  sync_enabled?: boolean;
  use_for_scheduling?: boolean;
  use_for_reminders?: boolean;
};

export async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (data.error || !data.access_token) return null;
  return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
}

const OUTLOOK_REFRESH_SCOPE =
  'offline_access Calendars.ReadWrite User.Read OnlineMeetings.ReadWrite';

export async function refreshOutlookToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  const clientId = Deno.env.get('AZURE_CLIENT_ID');
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: OUTLOOK_REFRESH_SCOPE,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (data.error || !data.access_token) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 3600,
  };
}

// deno-lint-ignore no-explicit-any
export async function ensureCalendarAccessToken(
  supabase: any,
  cal: ConnectedCalendarRow,
): Promise<string | null> {
  let accessToken = cal.access_token;
  const needsRefresh = !accessToken ||
    !cal.token_expires_at ||
    new Date(cal.token_expires_at).getTime() <= Date.now() + 60_000;

  if (!needsRefresh) return accessToken;

  if (!cal.refresh_token) return null;

  if (cal.provider === 'google') {
    const refreshed = await refreshGoogleToken(cal.refresh_token);
    if (!refreshed) return null;
    accessToken = refreshed.access_token;
    await supabase.from('connected_calendars').update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq('id', cal.id);
    return accessToken;
  }

  if (cal.provider === 'outlook') {
    const refreshed = await refreshOutlookToken(cal.refresh_token);
    if (!refreshed) return null;
    accessToken = refreshed.access_token;
    const patch: Record<string, string> = {
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    };
    if (refreshed.refresh_token) patch.refresh_token = refreshed.refresh_token;
    await supabase.from('connected_calendars').update(patch).eq('id', cal.id);
    return accessToken;
  }

  return null;
}
