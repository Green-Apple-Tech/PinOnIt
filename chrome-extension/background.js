const SUPABASE_URL = 'https://adlusgtlwgcfyxgeoias.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbHVzZ3Rsd2djZnl4Z2VvaWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDM1MjAsImV4cCI6MjA5MzAxOTUyMH0.dLyk7j-9bss_ltAJfJb4kT6WACz93sywMIIDaYq9V1A';

async function supabaseFetch(path, token, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function refreshBadge() {
  const stored = await chrome.storage.local.get(['access_token', 'user_id']);
  if (!stored.access_token || !stored.user_id) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const now = new Date().toISOString();
  const bookings = await supabaseFetch(
    `bookings?host_id=eq.${stored.user_id}&status=eq.confirmed&start_time=gte.${now}&select=id`,
    stored.access_token
  );

  if (bookings && bookings.length > 0) {
    chrome.action.setBadgeText({ text: String(bookings.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

chrome.alarms.create('refresh', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh') refreshBadge();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'REFRESH_BADGE') {
    refreshBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.access_token) refreshBadge();
});
