import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HOW_IT_WORKS_STEPS, MARKETING_ANNOUNCEMENT_HREF, TRIAL_FRICTION_LINE } from './marketingLanding';
import { PWA_NAV_DENYLIST_SOURCES } from './pwaWorkbox';

describe('marketing landing copy', () => {
  it('uses the no-card 14-day trial line', () => {
    expect(TRIAL_FRICTION_LINE).toBe('14-day free trial. No credit card required.');
  });

  it('links the announcement to the Calendly alternative page', () => {
    expect(MARKETING_ANNOUNCEMENT_HREF).toBe('/calendly-alternative');
  });

  it('keeps how-it-works scenes to one line each', () => {
    expect(HOW_IT_WORKS_STEPS).toHaveLength(5);
    for (const step of HOW_IT_WORKS_STEPS) {
      expect(step.scene.includes('\n')).toBe(false);
      expect(step.label.length).toBeGreaterThan(0);
    }
  });

  it('does not claim documents are legally binding or enforceable', () => {
    const blob = JSON.stringify(HOW_IT_WORKS_STEPS).toLowerCase();
    expect(blob.includes('legally binding')).toBe(false);
    expect(blob.includes('enforceable')).toBe(false);
  });
});

describe('how-it-works sticky demo', () => {
  it('renders every step from the editable array and uses scroll-driven CSS with an IO fallback', () => {
    const tsx = readFileSync(new URL('../components/landing/HowItWorksStrip.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../components/landing/HowItWorksStrip.css', import.meta.url), 'utf8');
    expect(tsx).toContain('HOW_IT_WORKS_STEPS.map');
    expect(tsx).toContain('step.messages');
    expect(tsx).toContain('IntersectionObserver');
    expect(tsx).toContain('prefers-reduced-motion');
    expect(tsx).toContain('animation-timeline: view()');
    expect(tsx).toContain('sticky ');
    expect(css).toContain('transform: translateY');
    expect(css).toContain('opacity:');
    expect(css.includes('canvas')).toBe(false);
  });

  it('shows a calendar picker on the BOOK IT phone screen', () => {
    const book = HOW_IT_WORKS_STEPS[0];
    expect(book.id).toBe('book');
    expect(book.screen).toBe('calendar');
    expect(book.calendar?.heading.toLowerCase()).toContain('tuesday');
    expect(book.calendar?.times.some((t) => t.selected && t.label.includes('12:00'))).toBe(true);
    const tsx = readFileSync(new URL('../components/landing/HowItWorksStrip.tsx', import.meta.url), 'utf8');
    expect(tsx).toContain('CalendarScreen');
    expect(tsx).toContain('Select a date');
  });
});

describe('PWA navigation denylist', () => {
  it('covers guest token prefixes', () => {
    const joined = PWA_NAV_DENYLIST_SOURCES.join(' ');
    for (const prefix of ['/d', '/q', '/r', '/c', '/s', '/poll']) {
      expect(joined).toContain(`^${prefix}`);
    }
  });

  it('disables HTML navigate fallback in vite config', () => {
    const src = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
    expect(src).toContain('navigateFallbackDenylist: [/.*/]');
    expect(src).toContain("globPatterns: ['assets/**/*.{js,css}', 'pinonit_logo.png']");
  });
});
