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

export function openEmailComposer(
  provider: EmailProvider,
  subject: string,
  body: string,
  to?: string,
) {
  if (provider === 'gmail') {
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1${to ? `&to=${encodeURIComponent(to)}` : ''}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank',
      'noopener,noreferrer',
    );
    return;
  }

  if (provider === 'outlook') {
    const params = new URLSearchParams();
    if (to) params.set('to', to);
    params.set('subject', subject);
    params.set('body', body);
    window.open(
      `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`,
      '_blank',
      'noopener,noreferrer',
    );
    return;
  }

  window.location.href = to
    ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openSmsComposer(body: string, phone?: string) {
  const phonePart = phone ? phone : '';
  window.location.href = phonePart
    ? `sms:${phonePart}?body=${encodeURIComponent(body)}`
    : `sms:?body=${encodeURIComponent(body)}`;
}

export function openWhatsAppComposer(body: string, phone?: string) {
  const digits = phone?.replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
}
