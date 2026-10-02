/** Public page for “sign your doc by text.” */
export const SIGN_NOW_PATH = '/sign-now';

/** Signed-in send screen. One page, one signer. */
export const SIGN_NOW_SEND_PATH = '/dashboard/documents/new?signNow=1';

export const SIGN_NOW_TEXT_MAX = 3000;

export function signNowSignupHref(): string {
  return `/signup?next=${encodeURIComponent(SIGN_NOW_SEND_PATH)}`;
}

export function signNowLoginHref(): string {
  return `/login?next=${encodeURIComponent(SIGN_NOW_SEND_PATH)}`;
}

/** Only the exact send screen. Rejects other next= values. */
export function signNowNextParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (value !== SIGN_NOW_SEND_PATH) return null;
  return SIGN_NOW_SEND_PATH;
}

export function isSignNowSendPath(pathname: string, search: string): boolean {
  if (pathname !== '/dashboard/documents/new') return false;
  return new URLSearchParams(search).get('signNow') === '1';
}

/**
 * After login, new accounts normally open the setup wizard.
 * The sign-now send screen is the exception: the document form comes first.
 */
export function postLoginDestination(stored: string | null, onboardingCompleted: boolean): string {
  const safe = stored && stored.startsWith('/') && !stored.startsWith('//') && !stored.includes('://')
    ? stored
    : '/dashboard';
  if (safe === SIGN_NOW_SEND_PATH) return SIGN_NOW_SEND_PATH;
  if (!onboardingCompleted) return '/dashboard?onboarding=1';
  return safe;
}

/** First line of a pasted page, used as the document topic. */
export function signNowTopic(text: string, fileName?: string | null): string {
  const fromFile = fileName?.replace(/\.pdf$/i, '').trim();
  const line = (fromFile || text.split('\n').map((part) => part.trim()).find(Boolean) || 'Document to sign')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return line || 'Document to sign';
}

/**
 * Page count from a PDF’s page tree. Returns null when the count is not in the file as plain text.
 * Object streams can hide /Count; those files are refused on this screen.
 */
export function countPdfPages(raw: string): number | null {
  const counts: number[] = [];
  const re = /\/Type\s*\/Pages\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const window = raw.slice(Math.max(0, match.index - 80), match.index + 160);
    const count = window.match(/\/Count\s+(\d+)/);
    if (count) counts.push(Number(count[1]));
  }
  if (counts.length) return Math.max(...counts);
  const pages = raw.match(/\/Type\s*\/Page(?!s)\b/g);
  return pages?.length ? pages.length : null;
}

export async function countPdfFilePages(file: File): Promise<number | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const raw = new TextDecoder('latin1').decode(bytes);
  return countPdfPages(raw);
}
