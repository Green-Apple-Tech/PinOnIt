import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../lib/contactEmail';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import {
  ArrowRight, Check,
  Sun, Moon, Menu, X,
  Calendar, Bell, Mail, ClipboardSignature, QrCode, ShoppingBag,
  FileText, Receipt,
} from 'lucide-react';
import { OnboardingBot } from '../components/OnboardingBot';
import { SmsPhoneMockup } from '../components/landing/SmsPhoneMockup';
import { LandingComparisonTable } from '../components/landing/LandingComparisonTable';
import { LandingPricingCard } from '../components/landing/LandingPricingCard';
import { LandingFaq } from '../components/landing/LandingFaq';

const HOME_META = {
  title: 'Run your business by text — booking, waivers, NDAs, invoices by SMS | PinOnIt',
  description:
    'Send a booking link, waiver, NDA, quote, or invoice as a text. Your customer taps and replies — no app, no DocuSign, no scanner. A Calendly alternative for small business, $6/mo.',
  url: 'https://pinonit.com/',
  image: 'https://pinonit.com/pinonit_logo.png',
};

const HERO_MESSAGES = [
  { role: 'business' as const, text: "Hi Maria — here's the waiver for Saturday's 10am session. Tap to sign: pinonit.com/d/k8x2" },
  { role: 'customer' as const, text: 'Done ✅' },
  { role: 'system' as const, text: 'Signed & timestamped · 10:42 AM' },
  { role: 'business' as const, text: "Perfect, see you Saturday. You'll get a reminder text Friday." },
];

const TEXT_ACTION_CARDS = [
  {
    icon: Calendar,
    title: 'Book a meeting or appointment',
    you: 'Send your booking link by text; they pick a time in your calendar.',
    theySee: 'Tap to grab a time: pinonit.com/pedro',
  },
  {
    icon: ClipboardSignature,
    title: 'Sign a waiver',
    you: 'Liability waivers, consent forms, intake forms — signed with a finger on their phone.',
    theySee: 'Please sign before Saturday: pinonit.com/d/…',
  },
  {
    icon: FileText,
    title: 'Sign an NDA or contract',
    you: 'Verified with an SMS code, then signed or initialed right on their phone.',
    theySee: 'Your NDA is ready. Code sent — tap to sign.',
  },
  {
    icon: Receipt,
    title: 'Send a quote, invoice, or receipt',
    you: 'Line items, tax, notes, and a pay link if you want one. One tap to approve.',
    theySee: 'Quote for $450 — tap to approve.',
  },
  {
    icon: Bell,
    title: 'Automatic reminders',
    you: 'SMS, WhatsApp, or voice reminders so fewer people no-show. Customers can cancel or reschedule by replying.',
    theySee: 'Reminder: 10am tomorrow. Reply C to cancel or R to reschedule.',
  },
];

const OLD_VS_TEXT = [
  { old: 'Email a PDF, wait days', new: 'A text they see in minutes' },
  { old: '“Download our app”', new: 'Nothing to install' },
  { old: 'DocuSign account + monthly fee', new: 'Signing is included' },
  { old: 'Print, sign, scan, send back', new: 'Sign with a finger, done' },
  { old: 'Chasing no-shows by phone', new: 'Automatic reminders, reply-to-reschedule' },
  { old: 'Five tools, five logins', new: 'One dashboard, one $6/mo plan' },
];

const TRADE_CHIPS = [
  'Landscapers', 'Barbers', 'Auto detailers', 'Pressure washers', 'Electricians', 'Plumbers',
  'Personal trainers', 'Pest control', 'Handymen', 'Financial advisors', 'Massage therapists',
  'Lash & beauty', 'HVAC', 'Notaries', 'Tattoo artists', 'Cleaners', 'Pool pros',
  'Photographers', 'Therapists', 'Salon suites',
];

const SIX_TOOLS = [
  { icon: Calendar, title: 'Scheduling page', desc: 'Your own booking page and links, synced to your calendar.' },
  { icon: Bell, title: 'Smart reminders', desc: 'SMS, WhatsApp, and voice.' },
  { icon: ClipboardSignature, title: 'Doc Center', desc: 'Waivers, NDAs, contracts, quotes, invoices, receipts.' },
  { icon: ShoppingBag, title: 'Paid booking', desc: 'Take payment when they book.' },
  { icon: QrCode, title: 'QR code creator', desc: 'Put your booking link on a truck, a mirror, a business card.' },
  { icon: Mail, title: 'Email signature', desc: 'A clean signature with a “Schedule a meeting” button.' },
];

export function Landing() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  usePageMeta(HOME_META);

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img src="/pinonit_logo.png" alt="Pin on It" className="h-11 w-auto" />
          </Link>

          <div className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#demo" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">How it works</a>
            <a href="#tools" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Tools</a>
            <a href="#pricing" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Pricing</a>
            <a href="#faq" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {user ? (
              <Link to="/dashboard" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full transition-colors">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">Log in</Link>
                <Link to="/signup" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full transition-colors">Start free</Link>
              </>
            )}
            <button className="lg:hidden p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-4 flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">How it works</a>
            <a href="#tools" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">Tools</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">FAQ</a>
            <Link to="/calendly-alternative" onClick={() => setMobileMenuOpen(false)} className="py-2 font-semibold text-brand-600 dark:text-brand-400">Calendly alternative →</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24 px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-500/5 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <p className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-x-2 gap-y-1 px-3 py-1.5 mb-5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Booking · Waivers · NDAs · Quotes · Invoices · Reminders — all by SMS
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
              Run your business by text.
            </h1>
            <p className="text-lg md:text-xl font-medium text-slate-600 dark:text-slate-300 leading-snug mb-8 max-w-xl mx-auto lg:mx-0">
              Send a booking link, waiver, NDA, quote, invoice, or receipt as a simple text. Your customer taps, replies, done — about 10 seconds. No app to download. No DocuSign. No scanner.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-3">
              <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full text-base transition-all shadow-lg shadow-brand-200/60 dark:shadow-none inline-flex items-center justify-center gap-2">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#demo" className="w-full sm:w-auto px-8 py-4 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-full text-base hover:bg-slate-50 dark:hover:bg-slate-800 transition-all inline-flex items-center justify-center">
                See the 10-second demo
              </a>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Free trial, then one plan at $6/mo. Everything included.</p>
          </div>
          <div>
            <SmsPhoneMockup messages={HERO_MESSAGES} caption="Real flow. No app on her phone." />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="demo" className="py-20 px-6 bg-slate-50 dark:bg-slate-900/40 scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">
            How it works in 10 seconds
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {[
              { n: '1', title: 'You send it', body: 'Pick a template in PinOnIt — booking link, waiver, NDA, quote, invoice, receipt — and hit send. One tap.' },
              { n: '2', title: 'They get a text', body: 'A normal SMS lands on their phone. No link to an app store, no account to create.' },
              { n: '3', title: 'They tap, reply, done', body: 'Sign with a finger, confirm with a code, or just reply. Every step is timestamped for you.' },
            ].map((step) => (
              <div key={step.n} className="text-center md:text-left">
                <div className="h-10 w-10 rounded-full bg-brand-500 text-white font-black flex items-center justify-center mb-4 mx-auto md:mx-0">{step.n}</div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">Works on any phone that can receive a text.</p>
        </div>
      </section>

      {/* Five things by text */}
      <section className="py-20 px-6 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">
            Five things your customers can do by text
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TEXT_ACTION_CARDS.map(({ icon: Icon, title, you, theySee }) => (
              <div key={title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{you}</p>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 font-mono leading-snug">
                  {theySee}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Old way vs by text */}
      <section className="py-20 px-6 bg-slate-50 dark:bg-slate-900/40">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800">
              <div className="p-4 text-sm font-bold text-slate-500 dark:text-slate-400 text-center">The old way</div>
              <div className="p-4 text-sm font-bold text-brand-600 dark:text-brand-400 text-center bg-brand-50 dark:bg-brand-500/10">PinOnIt</div>
            </div>
            {OLD_VS_TEXT.map((row) => (
              <div key={row.old} className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                <div className="p-4 text-sm text-slate-500 dark:text-slate-400">{row.old}</div>
                <div className="p-4 text-sm font-medium text-slate-900 dark:text-white bg-brand-50/50 dark:bg-brand-500/5">{row.new}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Legal position */}
      <section className="py-16 px-6 bg-white dark:bg-slate-950">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-8">
            Built for a strong legal position: SMS-verified, timestamped, 2FA-confirmed, and signed from their phone.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-left">
            {[
              'Phone number verified by SMS code',
              'Every view, code, and signature timestamped',
              'Signature or initials captured on their screen',
              'A copy of the record for both sides',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trades */}
      <section className="py-16 px-6 bg-slate-50 dark:bg-slate-900/40">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Made for businesses that run on their phone
          </h2>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {TRADE_CHIPS.map((trade) => (
              <span key={trade} className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {trade}
              </span>
            ))}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">If your customers text you, PinOnIt fits.</p>
        </div>
      </section>

      {/* Six tools */}
      <section id="tools" className="py-20 px-6 bg-white dark:bg-slate-950 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">
            Everything else you&apos;d expect, included
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SIX_TOOLS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why we beat Calendly */}
      <section className="py-20 px-6 bg-slate-50 dark:bg-slate-900/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-3">
            Why we beat Calendly
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto">
            PinOnIt does what Calendly does — then does the paperwork too.
          </p>
          <LandingComparisonTable />
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">Competitor pricing as of May 2026. Subject to change.</p>
          <p className="mt-6 text-center">
            <Link to="/calendly-alternative" className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              Switching from Calendly? See the full comparison →
            </Link>
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-white dark:bg-slate-950 scroll-mt-16">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">Pricing</h2>
          <LandingPricingCard variant="text-first" />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6 bg-slate-50 dark:bg-slate-900/40 scroll-mt-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">FAQ</h2>
          <LandingFaq />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-brand-500">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-black text-white leading-tight mb-6">
            Send your first waiver, quote, or booking link in the next five minutes.
          </h2>
          <Link
            to="/signup"
            className="inline-flex items-center gap-3 px-10 py-5 bg-white text-brand-600 font-black text-lg rounded-full transition-all shadow-2xl hover:bg-brand-50"
          >
            Start free <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-5 text-brand-100 text-sm">$6/mo after your trial. Nothing to install — for you or your customers.</p>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-10 px-6 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
          <img src="/pinonit_logo.png" alt="Pin on It" className="h-7 w-auto" />
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/calendly-alternative" className="hover:text-slate-900 dark:hover:text-white transition-colors">Calendly alternative</Link>
            <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm text-slate-400">&copy; 2026 Miami Expeditions LLC. All Rights Reserved.</p>
            <p className="text-xs text-slate-400 mt-1">PinOnIt is a product and DBA of Miami Expeditions LLC.</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col items-center justify-center gap-2 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link to="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Terms of Service</Link>
          <span>|</span>
          <Link to="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Privacy Policy</Link>
          <span>|</span>
          <Link to="/sms-consent" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">SMS Consent</Link>
        </div>
        <p className="max-w-6xl mx-auto text-center text-xs text-slate-400 dark:text-slate-500 pt-2">
          Support:{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">{SUPPORT_EMAIL}</a>
        </p>
      </footer>
      <OnboardingBot />
    </div>
  );
}
