import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { hostLegalStateNotice } from './legalStateNotices';
import {
  builtInTemplateScopeLine,
  builtInTemplateStandardLine,
  isUnmodifiedBuiltInTemplate,
} from './builtInTemplateNotice';
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
    expect(hostLegalStateNotice('waiver', null)).toBe(
      'Some states limit waivers signed by a parent on behalf of a minor.',
    );
    expect(hostLegalStateNotice('waiver', null)).not.toMatch(/attorney/i);
    expect(hostLegalStateNotice('waiver', 'CA')).not.toMatch(/attorney/i);
  });

  it('does not invent a notice from timezone-like values', () => {
    expect(hostLegalStateNotice('waiver', 'America/New_York')).toMatch(/parent on behalf of a minor/i);
    expect(hostLegalStateNotice('nda', 'CA')).toBeNull();
  });
});

describe('built-in template notice pair', () => {
  it('uses a normal above-line with lowercase type names', () => {
    expect(builtInTemplateStandardLine('waiver')).toBe('This is standard waiver language.');
    expect(builtInTemplateStandardLine('nda')).toBe('This is standard NDA language.');
    expect(builtInTemplateStandardLine('contract')).toBe('This is standard contract language.');
    expect(builtInTemplateStandardLine('quick_addendum')).toBe('This is standard addendum language.');
    expect(builtInTemplateStandardLine('service_agreement')).toBe('This is standard service agreement language.');
    expect(builtInTemplateStandardLine('photo_video_release')).toBe('This is standard photo release language.');
  });

  it('uses a muted below-line without outcome claims', () => {
    expect(builtInTemplateScopeLine()).toBe(
      'Requirements vary by state and activity — have your attorney confirm this document fits your business.',
    );
    expect(builtInTemplateStandardLine('waiver')).not.toMatch(/valid|enforceable|hold up|generally acceptable/i);
    expect(builtInTemplateScopeLine()).not.toMatch(/valid|enforceable|hold up|generally acceptable/i);
  });

  it('treats host-edited text as not built-in', () => {
    expect(isUnmodifiedBuiltInTemplate('waiver', WAIVER_STARTER_TEXT, WAIVER_STARTER_TEXT)).toBe(true);
    expect(isUnmodifiedBuiltInTemplate('waiver', `${WAIVER_STARTER_TEXT}\n\nCustom clause.`, WAIVER_STARTER_TEXT)).toBe(false);
    expect(
      isUnmodifiedBuiltInTemplate('parental_consent_waiver', PARENTAL_CONSENT_WAIVER_STARTER_TEXT, PARENTAL_CONSENT_WAIVER_STARTER_TEXT),
    ).toBe(true);
    expect(isUnmodifiedBuiltInTemplate('upload', 'x', 'x')).toBe(false);
  });
});
