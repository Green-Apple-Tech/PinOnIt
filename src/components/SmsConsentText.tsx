import { Link } from 'react-router-dom';
import {
  SMS_BOOKING_CONSENT_CTA,
  SMS_BOOKING_CONSENT_DETAILS,
  SMS_OPTIONAL_BOOKING_NOTICE,
} from '../lib/smsCompliance';
import { PHONE_HINT, PHONE_PLACEHOLDER } from '../lib/phone';

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

/** Exact Twilio-registered CTA paragraph (reference / legal pages). */
export function SmsBookingConsentDisclosure({
  className = '',
  id,
}: {
  className?: string;
  id?: string;
}) {
  return (
    <p
      id={id}
      className={`text-sm text-gray-700 dark:text-slate-300 leading-relaxed ${className}`}
    >
      {SMS_BOOKING_CONSENT_CTA}
    </p>
  );
}

/** SMS opt-in checkbox (optional, unchecked by default) with exact Twilio CTA as the label. */
export function SmsBookingConsentCheckbox({
  checked,
  onChange,
  className = '',
  showPolicyLinks = true,
  showOptionalNotice = true,
  showDetails = true,
  id = 'sms-opt-in-checkbox',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  showPolicyLinks?: boolean;
  showOptionalNotice?: boolean;
  showDetails?: boolean;
  id?: string;
}) {
  const optionalNoticeId = `${id}-optional-notice`;

  return (
    <div className={className}>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={showOptionalNotice ? optionalNoticeId : undefined}
          className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 shrink-0"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {SMS_BOOKING_CONSENT_CTA}
        </span>
      </label>
      {showOptionalNotice && (
        <p
          id={optionalNoticeId}
          className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-7 leading-relaxed"
        >
          {SMS_OPTIONAL_BOOKING_NOTICE}
        </p>
      )}
      {showDetails && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-7 leading-relaxed">
          {SMS_BOOKING_CONSENT_DETAILS}
        </p>
      )}
      {showPolicyLinks && (
        <ConsentPolicyLinks className="text-xs text-gray-500 dark:text-slate-400 mt-1.5 pl-7" />
      )}
    </div>
  );
}

/**
 * Static preview of the guest booking-page SMS opt-in block (for /sms-consent).
 * Non-interactive — mirrors pinonit.com/your-name booking details step.
 */
export function SmsBookingPageConsentPreview({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3 ${className}`}
      aria-label="Example SMS consent as shown on the public booking page"
    >
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Example — public booking page (no login required)
      </p>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Phone number <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="tel"
          readOnly
          tabIndex={-1}
          placeholder={PHONE_PLACEHOLDER}
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-400"
        />
        <p className="text-xs text-slate-400 mt-1">{PHONE_HINT}</p>
      </div>
      <div className="pointer-events-none select-none" aria-hidden="true">
        <SmsBookingConsentCheckbox
          checked={false}
          onChange={() => {}}
          showPolicyLinks={false}
          showDetails={false}
        />
      </div>
    </div>
  );
}

/** @deprecated Use SmsBookingConsentDisclosure */
export function SmsBookingConsentFootnotes({
  className = '',
}: {
  showOptionalNotice?: boolean;
  className?: string;
}) {
  return <ConsentPolicyLinks className={`text-xs text-gray-500 dark:text-slate-400 ${className}`} />;
}

/** Full disclosure for host settings / coordinate flows (no checkbox). */
export function SmsBookingConsent({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <SmsBookingConsentDisclosure className="mt-2" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
        {SMS_OPTIONAL_BOOKING_NOTICE}
      </p>
      <ConsentPolicyLinks className="text-xs text-gray-500 dark:text-slate-400 mt-1.5" />
    </div>
  );
}

/** @deprecated Use SmsBookingConsent */
export function SmsConsentText(props: { className?: string }) {
  return <SmsBookingConsent className={props.className ?? ''} />;
}

/** @deprecated Use SmsBookingConsentDisclosure */
export function SmsOptionalBookingNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-600 dark:text-slate-400 leading-relaxed ${className}`}>
      {SMS_OPTIONAL_BOOKING_NOTICE}
    </p>
  );
}
