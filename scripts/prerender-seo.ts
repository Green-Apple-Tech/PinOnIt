import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTENT_PAGES } from '../src/lib/seoIntentPages.ts';
import { BLOG_INDEX, BLOG_POSTS, type BlogPost } from '../src/lib/blogPosts.ts';
import { PINONIT_CORE_SENTENCE, PINONIT_ORG, PINONIT_PRICE_MONTHLY } from '../src/lib/seoIdentity.ts';
import {
  blogIndexJsonLd,
  blogPostingJsonLd,
  faqPageJsonLd,
  intentWebPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from '../src/lib/jsonLd.ts';

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
  const ld: object[] = [
    organizationJsonLd(),
    softwareApplicationJsonLd(),
    websiteJsonLd(),
    intentWebPageJsonLd(page),
  ];
  if (page.faq.length > 0) ld.push(faqPageJsonLd(page.faq));
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
  const audience = page.audience
    ? `<h2>Who this is for</h2><p>${esc(page.audience)}</p>`
    : '';
  const features = page.features?.length
    ? `<h2>Relevant features</h2><ul>${page.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`
    : '';
  const workflow = page.workflow
    ? `<h2>Example workflow</h2><p>${esc(page.workflow)}</p>`
    : '';
  const sections = (page.sections || [])
    .map((s) => `<h2>${esc(s.h2)}</h2><p>${esc(s.text)}</p>`)
    .join('');
  const hub = (page.hubGroups || [])
    .map(
      (g) =>
        `<h2>${esc(g.heading)}</h2><ul>${g.links.map((l) => `<li><a href="${esc(l.path)}">${esc(l.label)}</a></li>`).join('')}</ul>`,
    )
    .join('');
  const related = page.related?.length
    ? `<h2>Related</h2><ul>${page.related.map((l) => `<li><a href="${esc(l.path)}">${esc(l.label)}</a></li>`).join('')}</ul>`
    : '';
  const faq = page.faq.length
    ? `<h2>FAQ</h2>${page.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}`
    : '';
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
    ${audience}
    ${features}
    ${workflow}
    ${sections}
    ${table}
    ${hub}
    ${related}
    ${faq}
    <div class="cta">
      <p>What does PinOnIt cost? Pro is ${esc(PINONIT_PRICE_MONTHLY)} after a 14-day trial.</p>
      <p>${esc(PINONIT_CORE_SENTENCE)}</p>
      <a class="btn" href="/signup">${esc(page.cta)}</a>
    </div>
  </main>
  <footer>
    <div class="wrap">PinOnIt is a DBA of Miami Expeditions LLC. ${esc(PINONIT_PRICE_MONTHLY)} after trial. <a href="/solutions">Solutions</a></div>
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

const blogDir = join(outDir, 'blog');
mkdirSync(blogDir, { recursive: true });

function shell(title: string, description: string, canonical: string, ld: unknown, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="https://pinonit.com/og-why-pinonit.png" />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
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
    h2{font-size:1.15rem;margin:2rem 0 .6rem}
    .eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5865c6}
    .muted{color:#64748b;font-size:.8rem}
    footer{border-top:1px solid #e2e8f0;color:#94a3b8;font-size:.75rem}
    ul{padding-left:0;list-style:none}
    li{margin:1.25rem 0}
  </style>
</head>
<body>
  <nav>
    <a href="/"><img src="/pinonit_logo.png" alt="PinOnIt" /></a>
    <a class="btn" href="/signup">Start free</a>
  </nav>
  <main class="wrap">
    ${body}
  </main>
  <footer>
    <div class="wrap">PinOnIt is a DBA of Miami Expeditions LLC. ${esc(PINONIT_PRICE_MONTHLY)} after trial. <a href="/solutions">Solutions</a></div>
  </footer>
</body>
</html>
`;
}

function displayTitle(title: string) {
  return title.endsWith(' | PinOnIt') ? title.slice(0, -' | PinOnIt'.length) : title;
}

function renderBlocks(post: BlogPost) {
  return post.blocks
    .map((b) => {
      if (b.type === 'h2') return `<h2>${esc(b.text)}</h2>`;
      if ('link' in b) {
        const href = `${PINONIT_ORG.url}${b.link.href}`;
        return `<p>${esc(b.before)}<a href="${esc(href)}">${esc(b.link.text)}</a>${esc(b.after)}</p>`;
      }
      return `<p>${esc(b.text)}</p>`;
    })
    .join('\n    ');
}

writeFileSync(
  join(blogDir, 'index.html'),
  shell(BLOG_INDEX.title, BLOG_INDEX.description, BLOG_INDEX.canonical, [organizationJsonLd(), blogIndexJsonLd()], `
    <p class="eyebrow">Blog</p>
    <h1>${esc(BLOG_INDEX.h1)}</h1>
    <p>${esc(BLOG_INDEX.description)}</p>
    <ul>
      ${BLOG_POSTS.map(
        (p) =>
          `<li><a href="${esc(p.canonical)}"><strong>${esc(displayTitle(p.title))}</strong></a><br /><span class="muted">${esc(p.description)}</span></li>`,
      ).join('\n      ')}
    </ul>
  `),
);
console.log('wrote', join(blogDir, 'index.html'));

for (const post of BLOG_POSTS) {
  const file = join(blogDir, `${post.slug}.html`);
  writeFileSync(
    file,
    shell(post.title, post.description, post.canonical, [organizationJsonLd(), blogPostingJsonLd(post)], `
    <p class="eyebrow"><a href="${PINONIT_ORG.url}/blog">Field notes</a></p>
    <h1>${esc(displayTitle(post.title))}</h1>
    <p class="muted">${esc(post.datePublished)}</p>
    ${renderBlocks(post)}
  `),
  );
  console.log('wrote', file);
}

const extraSitemap: Array<{ loc: string; changefreq: string; priority: string }> = [
  { loc: `${PINONIT_ORG.url}/`, changefreq: 'weekly', priority: '1.0' },
  ...INTENT_PAGES.map((p) => ({
    loc: p.canonical,
    changefreq: 'monthly',
    priority: p.path === '/solutions' ? '0.8' : '0.9',
  })),
  { loc: BLOG_INDEX.canonical, changefreq: 'weekly', priority: '0.5' },
  ...BLOG_POSTS.map((p) => ({ loc: p.canonical, changefreq: 'monthly', priority: '0.5' })),
  { loc: `${PINONIT_ORG.url}/why-pinonit`, changefreq: 'monthly', priority: '0.7' },
  { loc: `${PINONIT_ORG.url}/legal-templates`, changefreq: 'monthly', priority: '0.6' },
  { loc: `${PINONIT_ORG.url}/nda`, changefreq: 'monthly', priority: '0.6' },
  { loc: `${PINONIT_ORG.url}/reminders`, changefreq: 'monthly', priority: '0.6' },
  { loc: `${PINONIT_ORG.url}/terms`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${PINONIT_ORG.url}/privacy`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${PINONIT_ORG.url}/sms-consent`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${PINONIT_ORG.url}/acceptable-use`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${PINONIT_ORG.url}/status`, changefreq: 'weekly', priority: '0.2' },
  { loc: `${PINONIT_ORG.url}/leaderboard`, changefreq: 'weekly', priority: '0.2' },
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${extraSitemap.map((u) => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
const sitemapPath = join(root, 'public', 'sitemap.xml');
writeFileSync(sitemapPath, sitemap);
console.log('wrote', sitemapPath);

