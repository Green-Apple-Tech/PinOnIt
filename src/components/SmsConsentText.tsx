import { Link } from 'react-router-dom';
import { SMS_BOOKING_CONSENT_TEXT } from '../lib/smsCompliance';

/** Standard booking / onboarding SMS opt-in disclosure with policy links. */
export function SmsBookingConsent({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
        {SMS_BOOKING_CONSENT_TEXT}
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
        <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</Link>
        {' · '}
        <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">Terms of Service</Link>
        {' · '}
        <Link to="/sms-consent" className="text-indigo-600 dark:text-indigo-400 hover:underline">SMS Consent</Link>
      </p>
    </div>
  );
}

/** @deprecated Use SmsBookingConsent */
export function SmsConsentText(props: { className?: string }) {
  return <SmsBookingConsent className={props.className ?? ''} />;
}
