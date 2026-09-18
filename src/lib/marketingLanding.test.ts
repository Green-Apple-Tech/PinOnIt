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
