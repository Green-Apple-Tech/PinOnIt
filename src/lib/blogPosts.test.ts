import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOG_INDEX, BLOG_POSTS, blogLinkedBlocks, isIntentLandingPath } from './blogPosts';
import { INTENT_PAGES } from './seoIntentPages';

describe('blog supporting articles', () => {
  it('lives under /blog/ and does not reuse intent H1s or slugs', () => {
    const intentH1s = new Set(INTENT_PAGES.map((p) => p.h1.toLowerCase()));
    const intentSlugs = new Set(INTENT_PAGES.map((p) => p.slug));
    expect(BLOG_INDEX.path).toBe('/blog');
    expect(BLOG_POSTS).toHaveLength(INTENT_PAGES.length);
    for (const post of BLOG_POSTS) {
      expect(post.path).toMatch(/^\/blog\/[a-z0-9-]+$/);
      expect(intentSlugs.has(post.slug)).toBe(false);
      expect(intentH1s.has(post.title.replace(/ \| PinOnIt$/, '').toLowerCase())).toBe(false);
    }
  });

  it('puts exactly one natural internal link on the matching landing, never the homepage', () => {
    const related = BLOG_POSTS.map((p) => p.relatedPath).sort();
    const landings = INTENT_PAGES.map((p) => p.path).sort();
    expect(related).toEqual(landings);
    for (const post of BLOG_POSTS) {
      const links = blogLinkedBlocks(post);
      expect(links).toHaveLength(1);
      expect(links[0].link.href).toBe(post.relatedPath);
      expect(isIntentLandingPath(post.relatedPath)).toBe(true);
      expect(post.relatedPath).not.toBe('/');
      expect(post.relatedPath).not.toBe('/calendly-alternative-for-small-business');
    }
  });

  it('lists only /blog URLs in the sitemap, not competing intent slugs as posts', () => {
    const xml = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8');
    expect(xml).toContain('https://pinonit.com/blog</loc>');
    for (const post of BLOG_POSTS) {
      expect(xml).toContain(`https://pinonit.com${post.path}</loc>`);
    }
  });
});
