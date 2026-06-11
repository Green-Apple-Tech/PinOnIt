type SmsConsentVariant = 'host' | 'guestPhone' | 'guestChannels' | 'coordinate' | 'thirdParty';

function consentCopy(variant: SmsConsentVariant, hostName?: string): string {
  switch (variant) {
    case 'guestPhone':
      return `By providing your phone number, you agree to receive SMS appointment reminders from ${hostName || 'your host'}. Message & data rates may apply. Reply STOP to opt out.`;
    case 'guestChannels':
      return `By selecting SMS or WhatsApp, you agree to receive appointment reminders and notifications from ${hostName || 'your host'}. Message frequency varies. Message & data rates may apply. Reply STOP to unsubscribe at any time. Reply HELP for help.`;
    case 'coordinate':
      return 'By providing a phone number, you agree that PinOnIt may send SMS or WhatsApp messages to coordinate this meeting. Message & data rates may apply. Reply STOP to opt out.';
    case 'thirdParty':
      return 'Only add numbers for people who have agreed to receive SMS messages from PinOnIt on your behalf.';
    case 'host':
    default:
      return 'By providing your phone number, you agree to receive SMS appointment reminders from PinOnIt. Message & data rates may apply. Reply STOP to opt out.';
  }
}

export function SmsConsentText({
  variant = 'host',
  hostName,
  className = 'text-xs text-gray-500 dark:text-slate-400 mt-2',
}: {
  variant?: SmsConsentVariant;
  hostName?: string;
  className?: string;
}) {
  return <p className={className}>{consentCopy(variant, hostName)}</p>;
}
