import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('anonymous guest document page', () => {
  const src = readFileSync('src/pages/DocumentConfirm.tsx', 'utf8');

  it('uses SECURITY DEFINER RPCs only — no table insert/select', () => {
    expect(src).not.toMatch(/\.from\(\s*['"]documents['"]\s*\)/);
    expect(src).not.toMatch(/\.insert\(/);
    expect(src).not.toMatch(/\.insert\(\)\.select/);
    expect(src).toMatch(/getDocumentByToken/);
    expect(src).toMatch(/recordDocumentEvent/);
    expect(src).toMatch(/verifyDocumentOtp/);
  });

  it('records viewed, then approve/sign, and blocks expired quotes', () => {
    expect(src).toMatch(/action:\s*'viewed'/);
    expect(src).toMatch(/action:\s*'signed'/);
    expect(src).toMatch(/action:\s*'declined'/);
    expect(src).toMatch(/quote has expired/);
  });
});
