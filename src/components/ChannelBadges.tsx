type Channel = 'sms' | 'whatsapp' | 'email' | 'voice';

const SIZE_CLASSES: Record<string, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

function SmsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 3V7a2 2 0 0 1 2-2z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 3V7a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="11" r="1" fill="currentColor" />
      <circle cx="13" cy="11" r="1" fill="currentColor" />
      <circle cx="17" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}

function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.06c-.24.68-1.4 1.3-1.94 1.38-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.43.75-2.13 1.02-2.42.27-.29.59-.36.79-.36h.57c.18 0 .43-.07.67.51.24.59.82 2.03.89 2.18.07.15.12.32.02.51-.1.19-.15.32-.29.49-.14.17-.3.38-.43.51-.14.14-.29.3-.13.58.16.29.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.17-.19.69-.8.87-1.08.18-.27.36-.23.61-.14.25.09 1.59.75 1.87.89.28.14.46.21.53.32.07.12.07.68-.17 1.36z" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m3 7 9 6 9-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VoiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.21 2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

const ICONS: Record<Channel, (props: { className?: string }) => JSX.Element> = {
  sms: SmsIcon,
  whatsapp: WhatsappIcon,
  email: EmailIcon,
  voice: VoiceIcon,
};

const STYLES: Record<Channel, string> = {
  sms: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  whatsapp:
    'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/40',
  email:
    'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
  voice:
    'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/40',
};

const LABELS: Record<Channel, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
  voice: 'Voice',
};

export function ChannelBadges({
  channels = ['sms', 'whatsapp', 'email', 'voice'],
  size = 'sm',
  showLabels = true,
  className = '',
}: {
  channels?: Channel[];
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}) {
  const iconCls = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;
  const padCls = size === 'lg' ? 'px-2.5 py-1.5 text-xs' : size === 'md' ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]';
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {channels.map((ch) => {
        const Icon = ICONS[ch];
        return (
          <span
            key={ch}
            className={`inline-flex items-center gap-1 rounded-lg border ${padCls} font-semibold ${STYLES[ch]}`}
          >
            <Icon className={iconCls} />
            {showLabels && LABELS[ch]}
          </span>
        );
      })}
    </div>
  );
}

export { SmsIcon, WhatsappIcon, EmailIcon, VoiceIcon };
