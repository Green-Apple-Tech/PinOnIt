type ChannelMarkProps = {
  channel: string;
  className?: string;
};

const box = (className?: string) =>
  `inline-block shrink-0 object-contain ${className ?? 'h-5 w-5'}`.trim();

/** Real logos via <img> — Lucide SVGs and the checked-in WhatsApp.png (a black square) do not show on Bolt. */
export function ChannelMark({ channel, className }: ChannelMarkProps) {
  if (channel === 'sms') {
    return (
      <img
        src="/assets/logos/Messages-Logo.png"
        alt=""
        className={`${box(className)} rounded-[4px]`}
      />
    );
  }
  if (channel === 'whatsapp') {
    return (
      <img
        src="/assets/logos/whatsapp.svg"
        alt=""
        className={box(className)}
      />
    );
  }
  if (channel === 'email') {
    return (
      <svg viewBox="0 0 24 24" className={box(className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 7 9-7" />
      </svg>
    );
  }
  if (channel === 'voice') {
    return (
      <svg viewBox="0 0 24 24" className={box(className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }
  return <span className={box(className)} aria-hidden />;
}
