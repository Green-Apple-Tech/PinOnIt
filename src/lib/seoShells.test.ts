import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { injectSeoShell, SEO_SHELLS } from './seoShells';

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

describe('seo shells', () => {
  it('keeps the boot splash as the only child of #root', () => {
    expect(indexHtml).toMatch(/<div id="root">\s*<div id="boot-splash"/);
    expect(indexHtml).toContain('<!--seo-snapshot-->');
    expect(indexHtml).toContain('<!--/seo-snapshot-->');
    expect(indexHtml).toContain('Book a Meeting by Text');
    expect(indexHtml).toContain('rel="canonical" href="https://pinonit.com/"');
  });

  it('gives each public shell a unique title, h1, and canonical', () => {
    const titles = new Set(SEO_SHELLS.map((s) => s.title));
    const h1s = new Set(SEO_SHELLS.map((s) => s.h1));
    expect(titles.size).toBe(SEO_SHELLS.length);
    expect(h1s.size).toBe(SEO_SHELLS.length);
    for (const shell of SEO_SHELLS) {
      const html = injectSeoShell(indexHtml, shell);
      expect(html).toContain(`<title>${shell.title}</title>`);
      expect(html).toContain(`<h1>${shell.h1.replace(/&/g, '&amp;')}</h1>`);
      expect(html).toContain(`<link rel="canonical" href="${shell.canonical}" />`);
      expect(html).toContain('id="boot-splash"');
      expect(html).toContain('/src/main.tsx');
      expect(html).not.toContain('Loading PinOnIt');
    }
  });
});
