export type EmailProvider = 'gmail' | 'outlook' | 'default';

export function buildAvailabilityEmailInvite(shareUrl: string, hostName?: string) {
  const lines = [
    'Hi,',
    '',
    "I'd love to find a time to connect. You can grab a slot on my calendar here:",
    '',
    shareUrl,
    '',
    'Looking forward to it!',
  ];
  if (hostName) lines.push(hostName);
  return {
    subject: 'Schedule a meeting with me',
    body: lines.join('\n'),
  };
}

export function buildAvailabilitySmsInvite(shareUrl: string, hostName?: string) {
  const lines = [
    'Hi, grab a slot on my calendar:',
    shareUrl,
    'Looking forward to it!',
  ];
  if (hostName) lines.push(`— ${hostName}`);
  return lines.join('\n');
}

/** Phones / tablets — prefer native apps / OS share sheet over web compose. */
export function isMobileShareClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  // iPadOS 13+ often reports as Mac; coarse pointer + touch hints mobile Safari.
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent)) return true;
  return false;
}

export function canUseSystemShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * OS share sheet (Mail, Gmail, Outlook, WhatsApp, Messages, …).
 * Returns true if the sheet was shown; false if unsupported or dismissed without share.
 */
export async function shareViaSystemSheet(opts: {
  title?: string;
  text: string;
  url?: string;
}): Promise<'shared' | 'cancelled' | 'unavailable'> {
  if (!canUseSystemShare()) return 'unavailable';
  try {
    const data: ShareData = {
      title: opts.title,
      text: opts.text,
    };
    if (opts.url) data.url = opts.url;
    // Some browsers throw if `url` is set with a text that already contains the URL.
    if (opts.url && typeof navigator.canShare === 'function' && !navigator.canShare(data)) {
      await navigator.share({ title: opts.title, text: opts.url ? `${opts.text}\n${opts.url}` : opts.text });
    } else {
      await navigator.share(data);
    }
    return 'shared';
  } catch (e) {
    // User dismissed the sheet — not an error for our UI.
    if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'NotAllowedError')) {
      return 'cancelled';
    }
    return 'unavailable';
  }
}

function mailtoHref(subject: string, body: string, to?: string): string {
  return to
    ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function outlookWebComposeUrl(subject: string, body: string, to?: string): string {
  const params = new URLSearchParams();
  if (to) params.set('to', to);
  params.set('subject', subject);
  params.set('body', body);
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

function outlookDesktopComposeUrl(subject: string, body: string, to?: string): string {
  const params = new URLSearchParams();
  if (to) params.set('to', to);
  params.set('subject', subject);
  params.set('body', body);
  return `ms-outlook://compose?${params.toString()}`;
}

/**
 * Try a native app URL scheme; if the page is still visible shortly after,
 * assume the app isn't installed and open the web fallback.
 */
function openAppThenWebFallback(appUrl: string, webUrl: string, delayMs = 900) {
  const started = Date.now();
  const hidden = () => document.visibilityState === 'hidden';

  // Prefer navigating the current tab for custom schemes (popup blockers ignore these less).
  window.location.href = appUrl;

  window.setTimeout(() => {
    if (Date.now() - started < delayMs + 400 && !hidden()) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  }, delayMs);
}

/**
 * Open an email compose surface.
 * Mobile: mailto: (native Mail / default app) for all providers.
 * Desktop Outlook: try Outlook desktop/app (`ms-outlook://`), then Outlook on the web.
 * Desktop Gmail: web compose. Default: mailto:.
 */
export function openEmailComposer(
  provider: EmailProvider,
  subject: string,
  body: string,
  to?: string,
) {
  const mobile = isMobileShareClient();

  if (mobile || provider === 'default') {
    window.location.href = mailtoHref(subject, body, to);
    return;
  }

  if (provider === 'gmail') {
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1${to ? `&to=${encodeURIComponent(to)}` : ''}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank',
      'noopener,noreferrer',
    );
    return;
  }

  if (provider === 'outlook') {
    openAppThenWebFallback(
      outlookDesktopComposeUrl(subject, body, to),
      outlookWebComposeUrl(subject, body, to),
    );
  }
}

export function openSmsComposer(body: string, phone?: string) {
  const phonePart = phone ? phone : '';
  // iOS wants &body= ; Android often wants ?body= — both work with ?body= on modern iOS.
  window.location.href = phonePart
    ? `sms:${phonePart}?body=${encodeURIComponent(body)}`
    : `sms:?body=${encodeURIComponent(body)}`;
}

/**
 * Prefer WhatsApp app on phones (whatsapp://), fall back to wa.me (Universal Link → app or web).
 */
export function openWhatsAppComposer(body: string, phone?: string) {
  const digits = phone?.replace(/\D/g, '') ?? '';
  const text = encodeURIComponent(body);
  const webUrl = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;

  if (isMobileShareClient()) {
    const appUrl = digits
      ? `whatsapp://send?phone=${digits}&text=${text}`
      : `whatsapp://send?text=${text}`;
    openAppThenWebFallback(appUrl, webUrl, 800);
    return;
  }

  window.open(webUrl, '_blank', 'noopener,noreferrer');
}
