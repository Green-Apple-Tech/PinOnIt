import { describe, expect, it } from 'vitest';
import {
  isConsumedOauthCodeError,
  isIosIsolatedWebView,
  isOauthReturnUrl,
  oauthCallbackRedirect,
} from './oauthLogin';

describe('isOauthReturnUrl', () => {
  it('matches the login callback path', () => {
    expect(isOauthReturnUrl('https://pinonit.com/auth/callback?code=abc')).toBe(true);
    expect(isOauthReturnUrl('https://pinonit.com/auth/callback')).toBe(true);
    expect(isOauthReturnUrl('/auth/callback?code=abc')).toBe(true);
  });

  it('does not match other pages that might carry a code param', () => {
    expect(isOauthReturnUrl('https://pinonit.com/login')).toBe(false);
    expect(isOauthReturnUrl('https://pinonit.com/dashboard/settings?code=abc')).toBe(false);
  });
});

describe('oauthCallbackRedirect', () => {
  it('stays on the page origin so the PKCE verifier is in the same storage', () => {
    expect(oauthCallbackRedirect('https://pinonit.com')).toBe('https://pinonit.com/auth/callback');
    expect(oauthCallbackRedirect('https://www.pinonit.com/')).toBe('https://www.pinonit.com/auth/callback');
  });
});

describe('isIosIsolatedWebView', () => {
  const safari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const chrome =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';
  const gsa =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/330.0.659350348 Mobile/15E148 Safari/604.1';
  const instagram =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0';

  it('lets iPhone Safari and Chrome complete OAuth in-place', () => {
    expect(isIosIsolatedWebView(safari)).toBe(false);
    expect(isIosIsolatedWebView(chrome)).toBe(false);
  });

  it('flags the home-screen app and in-app browsers that bounce to Safari', () => {
    expect(isIosIsolatedWebView(safari, true)).toBe(true);
    expect(isIosIsolatedWebView(gsa)).toBe(true);
    expect(isIosIsolatedWebView(instagram)).toBe(true);
    expect(isIosIsolatedWebView('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FBAN/FBAV')).toBe(
      true,
    );
  });

  it('ignores desktop', () => {
    expect(
      isIosIsolatedWebView(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toBe(false);
  });
});

describe('isConsumedOauthCodeError', () => {
  it('detects a one-time code that already ran or lost its verifier', () => {
    expect(isConsumedOauthCodeError('invalid request: both auth code and code verifier should be non-empty')).toBe(
      true,
    );
    expect(isConsumedOauthCodeError('Authorization code has already been used')).toBe(true);
    expect(isConsumedOauthCodeError('PKCE code verifier not found')).toBe(true);
    expect(isConsumedOauthCodeError('Network error')).toBe(false);
  });
});
