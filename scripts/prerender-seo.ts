import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTENT_PAGES } from '../src/lib/seoIntentPages.ts';
import { PINONIT_CORE_SENTENCE } from '../src/lib/seoIdentity.ts';
import { faqPageJsonLd, intentWebPageJsonLd, organizationJsonLd, softwareApplicationJsonLd } from '../src/lib/jsonLd.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'seo-static');

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageHtml(page: (typeof INTENT_PAGES)[number]) {
  const ld = [organizationJsonLd(), softwareApplicationJsonLd(), intentWebPageJsonLd(page), faqPageJsonLd(page.faq)];
  const rows = (page.compareRows || [])
    .map(
      (r) =>
        `<tr><td>${esc(r.feature)}</td><td>${esc(r.pinonit)}</td><td>${esc(r.other)}</td></tr>`,
    )
    .join('');
  const table = page.compareRows?.length
    ? `<h2>${esc(page.compareTitle || 'Compare')}</h2>
      <table><thead><tr><th>Feature</th><th>PinOnIt</th><th>${esc(page.compareOther || '')}</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="note">${esc(page.compareNote || '')}</p>`
    : '';
  const faq = page.faq
    .map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`)
    .join('');
  const body = page.body.map((p) => `<p>${esc(p)}</p>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(page.metaTitle)}</title>
  <meta name="description" content="${esc(page.metaDescription)}" />
  <link rel="canonical" href="${esc(page.canonical)}" />
  <meta property="og:title" content="${esc(page.metaTitle)}" />
  <meta property="og:description" content="${esc(page.metaDescription)}" />
  <meta property="og:url" content="${esc(page.canonical)}" />
  <meta property="og:image" content="https://pinonit.com/og-why-pinonit.png" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(page.metaTitle)}" />
  <meta name="twitter:description" content="${esc(page.metaDescription)}" />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" href="/pinonit_logo.png" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;color:#0f172a;background:#fff;line-height:1.6}
    nav,footer,.wrap{max-width:46rem;margin:0 auto;padding:1.25rem 1.5rem}
    nav{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0}
    nav img{height:2.5rem}
    a.btn{background:#5865c6;color:#fff;text-decoration:none;padding:.55rem 1rem;border-radius:999px;font-weight:600;font-size:.875rem}
    h1{font-size:2rem;line-height:1.15;margin:.4rem 0 1rem}
    .eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5865c6}
    table{width:100%;border-collapse:collapse;font-size:.9rem}
    th,td{border:1px solid #e2e8f0;padding:.5rem .6rem;text-align:left}
    .note,.muted{color:#64748b;font-size:.8rem}
    .cta{background:#5865c6;color:#fff;border-radius:1rem;padding:1.5rem;text-align:center;margin:2.5rem 0}
    .cta p{color:#e0e4fa}
    .cta a{background:#fff;color:#4a56b5}
    footer{border-top:1px solid #e2e8f0;color:#94a3b8;font-size:.75rem}
  </style>
</head>
<body>
  <nav>
    <a href="/"><img src="/pinonit_logo.png" alt="PinOnIt" /></a>
    <a class="btn" href="/signup">Start free</a>
  </nav>
  <main class="wrap">
    <p class="eyebrow">${esc(page.eyebrow)}</p>
    <h1>${esc(page.h1)}</h1>
    <p><strong>${esc(page.opening)}</strong></p>
    ${body}
    ${table}
    <h2>FAQ</h2>
    ${faq}
    <div class="cta">
      <p>${esc(PINONIT_CORE_SENTENCE)}</p>
      <a class="btn" href="/signup">${esc(page.cta)}</a>
    </div>
  </main>
  <footer>
    <div class="wrap">PinOnIt is a DBA of Miami Expeditions LLC. $8.99/month after trial.</div>
  </footer>
</body>
</html>
`;
}

mkdirSync(outDir, { recursive: true });
for (const page of INTENT_PAGES) {
  const file = join(outDir, `${page.slug}.html`);
  writeFileSync(file, pageHtml(page));
  console.log('wrote', file);
}
