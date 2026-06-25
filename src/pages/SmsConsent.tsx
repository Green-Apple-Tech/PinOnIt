import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Phone, Shield, HelpCircle, Ban } from 'lucide-react';
import { Footer } from '../components/Footer';
import { SmsBookingConsent } from '../components/SmsConsentText';
import { PHONE_PLACEHOLDER } from '../lib/phone';
import { SMS_BOOKING_CONSENT_TEXT } from '../lib/smsCompliance';

const SMS_EXAMPLES = [
  'Reminder: Your appointment with [Host Name] is tomorrow at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been confirmed for [Date] at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been rescheduled to [Date] at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been canceled. Contact the host for details. Reply STOP to unsubscribe.',
];

export function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> PinOnIt
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SMS Consent &amp; Notifications</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            PinOnIt sends appointment-related SMS messages only to users who voluntarily provide a mobile phone number and opt in.
            This page describes our SMS program for Twilio A2P 10DLC compliance and for your reference.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What messages we send</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            PinOnIt and hosts using the PinOnIt platform may send SMS messages related to scheduled appointments, including:
          </p>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 pl-4 list-disc">
            <li>Booking confirmations</li>
            <li>Appointment reminders (e.g. 24 hours, 1 hour, or 15 minutes before)</li>
            <li>Reschedule and cancellation notices</li>
            <li>Meeting coordination messages when scheduling with multiple participants (with separate opt-in)</li>
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We do not send marketing or promotional SMS messages. Message frequency varies based on your bookings and reminder settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">How you opt in</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Providing a phone number is <strong>optional</strong> on PinOnIt booking pages and during host onboarding.
            SMS is sent only when you:
          </p>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 pl-4 list-disc">
            <li>Voluntarily enter your mobile phone number, and</li>
            <li>Check the SMS opt-in checkbox (unchecked by default) after reading the consent disclosure</li>
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            No SMS messages are sent unless both conditions are met. You may book using email only and skip SMS entirely.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Live booking opt-in disclosure</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            The following is the same optional phone field and consent disclosure shown on public PinOnIt booking pages
            (no login required). Any host&apos;s booking link at{' '}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">pinonit.com/their-name</code>{' '}
            includes this flow.
          </p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5 space-y-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Phone number <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                readOnly
                value=""
                placeholder={PHONE_PLACEHOLDER}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-400"
                aria-label="Phone number example (optional)"
              />
            </div>
            <SmsBookingConsent />
            <label className="flex items-start gap-2.5 cursor-default pt-1">
              <input type="checkbox" readOnly checked={false} className="mt-0.5 rounded border-slate-300" aria-label="SMS opt-in example" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Send me SMS appointment reminders</span>
            </label>
            <p className="text-xs text-slate-400">Checkbox is unchecked by default until the guest opts in.</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Example messages</h2>
          <div className="space-y-2">
            {SMS_EXAMPLES.map((msg) => (
              <div key={msg} className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 font-mono text-xs leading-relaxed">
                {msg}
              </div>
            ))}
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-2">
              <Ban className="h-4 w-4 text-slate-500" />
              <h3 className="font-semibold text-sm">STOP — Unsubscribe</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Reply <strong>STOP</strong> to any PinOnIt SMS to unsubscribe from future text messages for that program.
              You will receive a confirmation that you have been opted out.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="h-4 w-4 text-slate-500" />
              <h3 className="font-semibold text-sm">HELP — Assistance</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Reply <strong>HELP</strong> for help or contact{' '}
              <a href="mailto:support@pinonit.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">support@pinonit.com</a>.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Rates &amp; third parties</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Message and data rates may apply depending on your mobile carrier plan.
            Message frequency varies based on your appointments and reminder preferences.
          </p>
          <div className="flex items-start gap-2 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
            <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              SMS consent is not shared with third parties or affiliates for marketing purposes.
              See our <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</Link> and{' '}
              <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">Terms of Service</Link> for details.
            </p>
          </div>
        </section>

        <p className="text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-6">
          Disclosure text shown to users: &ldquo;{SMS_BOOKING_CONSENT_TEXT}&rdquo;
        </p>
      </main>

      <Footer />
    </div>
  );
}
