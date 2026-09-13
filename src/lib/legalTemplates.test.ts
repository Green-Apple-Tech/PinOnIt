import { describe, expect, it } from 'vitest';
import {
  LEGAL_TEMPLATE_EXAMPLE_SITES,
  LEGAL_TEMPLATES_DISCLAIMER,
  LEGAL_TEMPLATES_META,
  LEGAL_TEMPLATES_UPLOAD_PATH,
} from './legalTemplates';

describe('legalTemplates', () => {
  it('has a search-oriented title and description', () => {
    expect(LEGAL_TEMPLATES_META.title).toMatch(/waiver/i);
    expect(LEGAL_TEMPLATES_META.title).toMatch(/PinOnIt/);
    expect(LEGAL_TEMPLATES_META.description).toMatch(/state/i);
    expect(LEGAL_TEMPLATES_META.url).toBe('https://pinonit.com/legal-templates');
  });

  it('lists example sites without endorsement language', () => {
    expect(LEGAL_TEMPLATE_EXAMPLE_SITES.map((s) => s.name)).toEqual([
      'LawDepot',
      'US Legal Forms',
      'PandaDoc',
    ]);
    for (const site of LEGAL_TEMPLATE_EXAMPLE_SITES) {
      expect(site.href.startsWith('https://')).toBe(true);
    }
    expect(LEGAL_TEMPLATES_DISCLAIMER).toMatch(/doesn't provide legal documents or legal advice/i);
    expect(LEGAL_TEMPLATES_DISCLAIMER).toMatch(/third-party/i);
  });

  it('deep-links to the Docs upload flow', () => {
    expect(LEGAL_TEMPLATES_UPLOAD_PATH).toContain('tab=docs');
    expect(LEGAL_TEMPLATES_UPLOAD_PATH).toContain('upload=1');
  });
});
