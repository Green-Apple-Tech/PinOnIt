import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { hostLegalStateNotice } from './legalStateNotices';
import { builtInTemplateAttorneyLine, isUnmodifiedBuiltInTemplate } from './builtInTemplateNotice';
import { PARENTAL_CONSENT_WAIVER_STARTER_TEXT, WAIVER_STARTER_TEXT } from './documents';

describe('host legal state notices', () => {
  it('uses a generic no-state line when the host has no business region', () => {
    const notice = hostLegalStateNotice('waiver', null);
    expect(notice).toMatch(/parent on behalf of a minor/i);
    expect(notice).not.toMatch(/California|New York|Louisiana/);
  });

  it('names the stored state for seeded notices and never claims a template is tailored', () => {
    expect(hostLegalStateNotice('parental_consent_waiver', 'CA')).toMatch(/California/);
    expect(hostLegalStateNotice('parental_consent_waiver', 'NY')).toMatch(/New York/);
    expect(hostLegalStateNotice('waiver', 'CA')).not.toMatch(/tailored|generally acceptable|may hold up|enforceable/i);
  });

  it('does not invent a notice from timezone-like values', () => {
    expect(hostLegalStateNotice('waiver', 'America/New_York')).toMatch(/parent on behalf of a minor/i);
    expect(hostLegalStateNotice('nda', 'CA')).toBeNull();
  });
});

describe('built-in attorney line', () => {
  it('uses one consistent drafting line without outcome claims', () => {
    expect(builtInTemplateAttorneyLine('waiver')).toBe('(Standard waiver language — attorney review recommended.)');
    expect(builtInTemplateAttorneyLine('parental_consent_waiver')).toBe(
      '(Standard waiver with parental consent language — attorney review recommended.)',
    );
    expect(builtInTemplateAttorneyLine('nda')).toBe('(Standard NDA language — attorney review recommended.)');
    expect(builtInTemplateAttorneyLine('waiver')).not.toMatch(/valid|enforceable|hold up|generally acceptable/i);
  });

  it('treats host-edited text as not built-in', () => {
    expect(isUnmodifiedBuiltInTemplate('waiver', WAIVER_STARTER_TEXT, WAIVER_STARTER_TEXT)).toBe(true);
    expect(isUnmodifiedBuiltInTemplate('waiver', `${WAIVER_STARTER_TEXT}\n\nCustom clause.`, WAIVER_STARTER_TEXT)).toBe(false);
    expect(
      isUnmodifiedBuiltInTemplate('parental_consent_waiver', PARENTAL_CONSENT_WAIVER_STARTER_TEXT, PARENTAL_CONSENT_WAIVER_STARTER_TEXT),
    ).toBe(true);
  });
});
