import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SignNowPage } from '../pages/SignNow';
import {
  SIGN_NOW_SEND_PATH,
  countPdfPages,
  postLoginDestination,
  signNowNextParam,
  signNowTopic,
} from './signNow';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: () => undefined }),
}));
vi.mock('../lib/pageMeta', () => ({
  usePageMeta: () => undefined,
}));

const ONE_PAGE = `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
%%EOF`;

const TWO_PAGES = `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Count 2 /Type /Pages /Kids [3 0 R 4 0 R] >> endobj
3 0 obj << /Type /Page /Parent 2 0 R >> endobj
4 0 obj << /Type /Page /Parent 2 0 R >> endobj
%%EOF`;

describe('signNowNextParam', () => {
  it('accepts only the one-page send screen', () => {
    expect(signNowNextParam(SIGN_NOW_SEND_PATH)).toBe(SIGN_NOW_SEND_PATH);
    expect(signNowNextParam(encodeURIComponent(SIGN_NOW_SEND_PATH))).toBe(SIGN_NOW_SEND_PATH);
    expect(signNowNextParam('/dashboard')).toBeNull();
    expect(signNowNextParam('https://evil.example/dashboard/documents/new?signNow=1')).toBeNull();
    expect(signNowNextParam('/dashboard/documents/new?signNow=1&next=https://evil.example')).toBeNull();
  });
});

describe('postLoginDestination', () => {
  it('opens the document form before the setup wizard', () => {
    expect(postLoginDestination(SIGN_NOW_SEND_PATH, false)).toBe(SIGN_NOW_SEND_PATH);
    expect(postLoginDestination(SIGN_NOW_SEND_PATH, true)).toBe(SIGN_NOW_SEND_PATH);
  });

  it('keeps the setup wizard for a normal new account', () => {
    expect(postLoginDestination('/dashboard', false)).toBe('/dashboard?onboarding=1');
    expect(postLoginDestination(null, false)).toBe('/dashboard?onboarding=1');
    expect(postLoginDestination('/dashboard/settings', true)).toBe('/dashboard/settings');
  });
});

describe('countPdfPages', () => {
  it('reads a one-page and a two-page page tree', () => {
    expect(countPdfPages(ONE_PAGE)).toBe(1);
    expect(countPdfPages(TWO_PAGES)).toBe(2);
    expect(countPdfPages('not a pdf')).toBeNull();
  });
});

describe('SignNowPage', () => {
  it('sends new visitors to signup, then the one-page form', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(SignNowPage)),
    );
    expect(html).toContain('Sign your doc by text');
    expect(html).toContain('Sign a document now');
    expect(html).toContain(`/signup?next=${encodeURIComponent(SIGN_NOW_SEND_PATH)}`);
    expect(html).toContain('the way Calendly does');
    expect(html).toContain('href="/calendly-alternative"');
  });
});

describe('signNowTopic', () => {
  it('uses the first line, then the file name', () => {
    expect(signNowTopic('Front yard agreement\n\nTerms follow.')).toBe('Front yard agreement');
    expect(signNowTopic('', 'Service Agreement.pdf')).toBe('Service Agreement');
    expect(signNowTopic('')).toBe('Document to sign');
  });
});
