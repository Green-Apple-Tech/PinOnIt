import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Phone, Ban, HelpCircle, Check, Loader2, User } from 'lucide-react';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';
import { PHONE_PLACEHOLDER, PHONE_HINT, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { SMS_BOOKING_CONSENT_TEXT } from '../lib/smsCompliance';

const SMS_EXAMPLES = [
  'Reminder: Your appointment with [Host Name] is tomorrow at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been confirmed for [Date] at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been rescheduled to [Date] at [Time]. Reply STOP to unsubscribe.',
  'Your appointment with [Host Name] has been canceled. Contact the host for details. Reply STOP to unsubscribe.',
];

function SmsOptInForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const e164 = normalizePhoneE164(phone.trim());
    if (!e164) {
      setError('Please enter a valid mobile phone number.');
      return;
    }
    if (!consent) {
      setError('Please check the box to consent before opting in.');
      return;
    }
    setSubmitting(true);
    const { error: insertError } = await supabase.from('sms_optins').insert({
      name: name.trim() || null,
      phone: e164,
      consent: true,
      source: 'sms_consent_page',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    setSubmitting(false);
    if (insertError) {
      setError('Something went wrong. Please try again or email support@pinonit.com.');
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 p-6 text-center">
        <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">You&apos;re opted in.</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
          You consented to receive appointment-related SMS messages. Reply STOP at any time to unsubscribe,
          or HELP for assistance.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5 space-y-4"
    >
      <div>
        <label htmlFor="optin-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Name <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="optin-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      </div>

      <div>
        <label htmlFor="optin-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Mobile phone number <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="optin-phone"
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(''); }}
            onBlur={(e) => { if (e.target.value.trim()) setPhone(blurFormatPhone(e.target.value)); }}
            placeholder={PHONE_PLACEHOLDER}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">{PHONE_HINT}</p>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {SMS_BOOKING_CONSENT_TEXT}
      </p>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => { setConsent(e.target.checked); setError(''); }}
          className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          I agree to receive SMS appointment reminders and related messages from PinOnIt at the number provided.
          Consent is not a condition of any purchase.
        </span>
      </label>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</Link>
        {' · '}
        <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">Terms of Service</Link>
      </p>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
        Opt in to SMS reminders
      </button>
    </form>
  );
}

export function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> PinOnIt
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SMS Consent &amp; Opt-In</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            PinOnIt sends appointment-related SMS messages only when users voluntarily opt in.
            This public page is the opt-in point and describes our SMS program, consent language, and how to opt out.
            No account or login is required.
          </p>
        </div>

        {/* Primary CTA — real, working opt-in form */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Opt in to SMS reminders</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Enter your mobile number and check the consent box to receive appointment-related text messages.
            Providing a phone number is optional and you can unsubscribe at any time.
          </p>
          <SmsOptInForm />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">How users opt in</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Phone numbers are <strong>optional</strong> everywhere on PinOnIt. We do not send SMS unless
            <strong> both</strong> of the following are true:
          </p>
          <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 pl-5 list-decimal">
            <li>The user voluntarily enters a mobile phone number, and</li>
            <li>The user checks the SMS opt-in checkbox (unchecked by default) after reading the consent disclosure.</li>
          </ol>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            The same phone field + consent disclosure + unchecked checkbox shown above also appears:
          </p>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 pl-4 list-disc">
            <li>On every public booking page at <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">pinonit.com/your-name</code> (no login required), and</li>
            <li>During host onboarding and Settings when a host enters their own phone number for PinOnIt account notifications.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Consent language</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            The following exact disclosure is shown directly below the phone field and the SMS opt-in checkbox:
          </p>
          <blockquote className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 leading-relaxed">
            &ldquo;{SMS_BOOKING_CONSENT_TEXT}&rdquo;
          </blockquote>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Example messages</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Appointment-related messages sent through PinOnIt may look like the following:
          </p>
          <div className="space-y-2">
            {SMS_EXAMPLES.map((msg) => (
              <div
                key={msg}
                className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 font-mono leading-relaxed"
              >
                {msg}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We do not send marketing or promotional SMS. Message frequency varies. Message and data rates may apply.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">STOP and HELP</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="h-4 w-4 text-slate-500" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">STOP — Unsubscribe</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Reply <strong>STOP</strong> to any PinOnIt SMS to unsubscribe from future appointment-related text
                messages. You will receive a confirmation that you have been opted out.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="h-4 w-4 text-slate-500" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">HELP — Assistance</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Reply <strong>HELP</strong> for help or contact{' '}
                <a href="mailto:support@pinonit.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  support@pinonit.com
                </a>.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Privacy and Terms</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            SMS consent is not shared with third parties or affiliates for marketing purposes. For more information:
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/privacy"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
