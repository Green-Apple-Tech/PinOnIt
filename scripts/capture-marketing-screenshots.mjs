#!/usr/bin/env node
/**
 * Capture marketing screenshots from /marketing-capture mock page.
 * Usage: npm run build && node scripts/capture-marketing-screenshots.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'screenshots');

const TARGETS = [
  'reminders',
  'personal-reminders',
  'dashboard',
  'calendar-write-back',
  'booking-page',
  'group-scheduling',
];

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findFreePort(start = 4173) {
  const net = await import('node:net');
  for (let port = start; port < start + 20; port++) {
    const ok = await new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => { srv.close(() => resolve(true)); });
      srv.listen(port, '127.0.0.1');
    });
    if (ok) return port;
  }
  throw new Error('No free preview port');
}

async function main() {
  const PORT = await findFreePort();
  const BASE = `http://127.0.0.1:${PORT}/marketing-capture.html`;

  const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: true,
  });

  let ready = false;
  preview.stdout.on('data', (d) => {
    if (String(d).includes('Local:')) ready = true;
  });
  preview.stderr.on('data', (d) => {
    if (String(d).includes('Local:')) ready = true;
  });

  for (let i = 0; i < 60 && !ready; i++) await wait(500);
  if (!ready) {
    preview.kill();
    throw new Error('Preview server did not start');
  }
  await wait(800);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForSelector('#reminders', { timeout: 60_000 });
  await wait(500);

  for (const id of TARGETS) {
    const el = page.locator(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: path.join(OUT, `${id}.png`), animations: 'disabled' });
    console.log('→', `${id}.png`);
  }

  await browser.close();
  preview.kill();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
