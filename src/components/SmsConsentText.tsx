import { Link } from 'react-router-dom';
import {
  SMS_BOOKING_CONSENT_TEXT,
  SMS_BOOKING_CONSENT_DETAILS,
  SMS_OPTIONAL_BOOKING_NOTICE,
} from '../lib/smsCompliance';

function ConsentPolicyLinks({ className = '' }: { className?: string }) {
  return (
    <p className={className}>
      <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</Link>
      {' · '}
      <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">Terms of Service</Link>
      {' · '}
      <Link to="/sms-consent" className="text-indigo-600 dark:text-indigo-400 hover:underline">SMS Consent</Link>
    </p>
  );
}

/** SMS opt-in checkbox with Twilio-registered consent text as the label. */
export function SmsBookingConsentCheckbox({
  checked,
  onChange,
  disabled = false,
  className = '',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex items-start gap-2.5 cursor-pointer ${disabled ? 'opacity-50' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 disabled:opacity-50"
      />
      <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {SMS_BOOKING_CONSENT_TEXT}
      </span>
    </label>
  );
}

/** Footnotes below the SMS checkbox on guest booking flows. */
export function SmsBookingConsentFootnotes({
  showOptionalNotice = true,
  className = '',
}: {
  showOptionalNotice?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
        {SMS_BOOKING_CONSENT_DETAILS}
      </p>
      {showOptionalNotice && (
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          {SMS_OPTIONAL_BOOKING_NOTICE}
        </p>
      )}
      <ConsentPolicyLinks className="text-xs text-gray-500 dark:text-slate-400 mt-1.5" />
    </div>
  );
}

/** Full disclosure for host settings / coordinate flows (no checkbox). */
export function SmsBookingConsent({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
        {SMS_BOOKING_CONSENT_TEXT}
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
        {SMS_BOOKING_CONSENT_DETAILS}
      </p>
      <ConsentPolicyLinks className="text-xs text-gray-500 dark:text-slate-400 mt-1.5" />
    </div>
  );
}

/** @deprecated Use SmsBookingConsent */
export function SmsConsentText(props: { className?: string }) {
  return <SmsBookingConsent className={props.className ?? ''} />;
}

/** Shown on booking forms below the phone field and SMS opt-in checkbox. */
export function SmsOptionalBookingNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-600 dark:text-slate-400 leading-relaxed ${className}`}>
      {SMS_OPTIONAL_BOOKING_NOTICE}
    </p>
  );
}
