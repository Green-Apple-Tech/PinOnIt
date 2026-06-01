const SUPABASE_URL = 'https://adlusgtlwgcfyxgeoias.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkbHVzZ3Rsd2djZnl4Z2VvaWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDM1MjAsImV4cCI6MjA5MzAxOTUyMH0.dLyk7j-9bss_ltAJfJb4kT6WACz93sywMIIDaYq9V1A';
const APP_BASE_URL = 'https://scheduleflow.app';

// ── Supabase REST helpers ──────────────────────────────────────────────────

async function sbFetch(path, token, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Invalid credentials');
  return data;
}

async function signOut(token) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
}

// ── Storage ───────────────────────────────────────────────────────────────

function storeSession(session) {
  return chrome.storage.local.set({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: session.user.id,
    user_email: session.user.email,
  });
}

function clearSession() {
  return chrome.storage.local.remove(['access_token', 'refresh_token', 'user_id', 'user_email']);
}

function getSession() {
  return chrome.storage.local.get(['access_token', 'refresh_token', 'user_id', 'user_email']);
}

// ── UI helpers ────────────────────────────────────────────────────────────

function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }
function text(id, val) { document.getElementById(id).textContent = val; }

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDuration(start, end) {
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function serviceColor(colorStr) {
  return colorStr || '#10b981';
}

function bookingItemHTML(b, showDate = true) {
  const color = serviceColor(b.services?.color);
  const duration = getDuration(b.start_time, b.end_time);
  const dateLabel = formatDateLabel(b.start_time);

  return `
    <div class="booking-item">
      <div class="booking-time-col">
        <div class="booking-time">${formatTime(b.start_time)}</div>
        ${showDate ? `<div class="booking-date-label">${dateLabel}</div>` : ''}
      </div>
      <div class="booking-dot-col">
        <div class="booking-dot" style="background:${color}"></div>
        <div class="booking-line"></div>
      </div>
      <div class="booking-info">
        <div class="booking-guest">${escHtml(b.guest_name)}</div>
        <div class="booking-service">${escHtml(b.services?.name || 'Booking')}</div>
        <div class="booking-meta">
          <span class="booking-badge badge-confirmed">Confirmed</span>
          <span class="booking-badge badge-duration">${duration}</span>
        </div>
      </div>
    </div>`;
}

function emptyStateHTML(icon, title, sub) {
  return `
    <div class="empty-state">
      ${icon}
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-sub">${sub}</div>
    </div>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const calendarIcon = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;

// ── Main app data load ────────────────────────────────────────────────────

async function loadApp(token, userId) {
  const [profile, bookings, availability] = await Promise.all([
    sbFetch(`profiles?id=eq.${userId}&select=full_name,slug,brand_color`, token),
    sbFetch(
      `bookings?host_id=eq.${userId}&status=eq.confirmed&start_time=gte.${new Date().toISOString()}&select=id,guest_name,start_time,end_time,services(name,color)&order=start_time.asc&limit=50`,
      token
    ),
    sbFetch(`availability_slots?host_id=eq.${userId}&is_active=eq.true&select=day_of_week`, token),
  ]);

  const prof = profile?.[0];
  const allBookings = bookings || [];

  // User pill
  const name = prof?.full_name || 'User';
  text('user-name', name.split(' ')[0]);
  text('user-avatar', name.charAt(0).toUpperCase());

  // Booking link
  const appUrl = window.location.origin.includes('chrome-extension')
    ? APP_BASE_URL
    : APP_BASE_URL;
  const slug = prof?.slug || userId;
  const bookingUrl = `${appUrl}/${slug}`;
  text('booking-link-url', bookingUrl.replace('https://', ''));
  document.getElementById('copy-link-btn').dataset.url = bookingUrl;

  // Quick action URLs
  document.getElementById('qa-dashboard').href = `${appUrl}/dashboard`;
  document.getElementById('qa-booking-page').href = bookingUrl;
  document.getElementById('qa-availability').href = `${appUrl}/dashboard/availability`;
  document.getElementById('qa-services').href = `${appUrl}/dashboard/services`;
  document.getElementById('open-app-btn').dataset.url = `${appUrl}/dashboard`;

  // Dates
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const todayBookings = allBookings.filter(b => {
    const t = new Date(b.start_time);
    return t >= now && t <= todayEnd;
  });
  const weekBookings = allBookings.filter(b => {
    const t = new Date(b.start_time);
    return t >= now && t <= weekEnd;
  });

  // Stats
  text('stat-today', todayBookings.length);
  text('stat-week', weekBookings.length);
  text('stat-upcoming', allBookings.length);

  // Today label
  text('today-label', now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));

  // Today status chip
  const todayDow = now.getDay();
  const isAvailableToday = availability?.some(a => a.day_of_week === todayDow);
  const statusEl = document.getElementById('today-status');
  if (!isAvailableToday) {
    statusEl.className = 'status-chip unavailable';
    statusEl.innerHTML = '<div class="dot"></div><span>Not available</span>';
  } else if (todayBookings.length > 0) {
    statusEl.className = 'status-chip busy';
    statusEl.innerHTML = `<div class="dot"></div><span>${todayBookings.length} booking${todayBookings.length > 1 ? 's' : ''} today</span>`;
  } else {
    statusEl.className = 'status-chip free';
    statusEl.innerHTML = '<div class="dot"></div><span>Available today</span>';
  }

  // Tab counts
  text('upcoming-count', allBookings.length);

  // Render upcoming
  const upcomingList = document.getElementById('upcoming-list');
  if (allBookings.length === 0) {
    upcomingList.innerHTML = emptyStateHTML(calendarIcon, 'No upcoming bookings', 'Share your link to start getting bookings.');
  } else {
    upcomingList.innerHTML = allBookings.slice(0, 20).map(b => bookingItemHTML(b, true)).join('');
  }

  // Render today
  const todayList = document.getElementById('today-list');
  if (todayBookings.length === 0) {
    todayList.innerHTML = emptyStateHTML(calendarIcon, 'Nothing scheduled today', isAvailableToday ? 'You\'re available but have no bookings.' : 'You are not available today.');
  } else {
    todayList.innerHTML = todayBookings.map(b => bookingItemHTML(b, false)).join('');
  }

  // Last updated
  text('last-updated', `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
}

// ── Tabs ─────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── Login flow ────────────────────────────────────────────────────────────

async function attemptLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');

  if (!email || !password) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = '';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errEl.style.display = 'none';

  try {
    const session = await signIn(email, password);
    await storeSession(session);
    chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' });
    showApp(session.access_token, session.user.id);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

document.getElementById('login-btn').addEventListener('click', attemptLogin);
document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') attemptLogin();
});

// ── App flow ──────────────────────────────────────────────────────────────

function showApp(token, userId) {
  hide('loading-screen');
  hide('login-screen');
  show('app-screen');
  loadApp(token, userId);
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  const { access_token } = await getSession();
  if (access_token) await signOut(access_token);
  await clearSession();
  chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' });
  hide('app-screen');
  show('login-screen');
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
});

document.getElementById('refresh-btn').addEventListener('click', async () => {
  const { access_token, user_id } = await getSession();
  if (!access_token || !user_id) return;
  const btn = document.getElementById('refresh-btn');
  btn.style.animation = 'spin .7s linear infinite';
  await loadApp(access_token, user_id);
  btn.style.animation = '';
  toast('Refreshed');
});

document.getElementById('copy-link-btn').addEventListener('click', async () => {
  const url = document.getElementById('copy-link-btn').dataset.url;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  const btn = document.getElementById('copy-link-btn');
  btn.classList.add('copied');
  btn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Copied!`;
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg> Copy Link`;
  }, 2000);
  toast('Booking link copied!');
});

document.getElementById('open-app-btn').addEventListener('click', () => {
  const url = document.getElementById('open-app-btn').dataset.url || `${APP_BASE_URL}/dashboard`;
  chrome.tabs.create({ url });
});

// Delegate external link clicks in quick actions panel
document.getElementById('panel-actions').addEventListener('click', e => {
  const link = e.target.closest('.quick-action');
  if (link && link.href && link.href !== '#') {
    e.preventDefault();
    chrome.tabs.create({ url: link.href });
  }
});

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  const session = await getSession();
  if (session.access_token && session.user_id) {
    showApp(session.access_token, session.user_id);
  } else {
    hide('loading-screen');
    show('login-screen');
  }
})();
