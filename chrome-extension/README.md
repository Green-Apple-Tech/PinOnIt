# ScheduleFlow Chrome Extension

Quick access to your bookings, availability status, and scheduling link — right from your browser toolbar.

## Features

- **One-click copy** of your booking link
- **Upcoming bookings** — next 50 confirmed bookings with guest name, service, time
- **Today's schedule** — see what's booked today at a glance
- **Availability status** — shows if you're free, busy, or unavailable today
- **Stats** — today / this week / total upcoming booking counts
- **Badge count** — toolbar icon shows number of upcoming bookings
- **Quick actions** — jump to Dashboard, Booking Page, Availability, or Services
- **Auto-refresh** — badge updates every 5 minutes in the background

## Installing (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from this project
5. The ScheduleFlow icon will appear in your toolbar

## For Production (Chrome Web Store)

1. Replace `icons/*.svg` with proper PNG files (16, 32, 48, 128px)
2. Update `APP_BASE_URL` in `popup.js` and `background.js` to your production URL
3. Zip the `chrome-extension/` folder contents
4. Upload to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration |
| `popup.html` | Popup UI markup and styles |
| `popup.js` | Popup logic — auth, data fetching, rendering |
| `background.js` | Service worker — badge count, background refresh |
| `icons/` | Extension icons (SVG; replace with PNGs for store) |
