import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../lib/contactEmail';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import {
  ArrowRight, Check,
  Sun, Moon, Menu, X,
  Calendar, Bell, Mail, ClipboardSignature, QrCode,
  Receipt,
} from 'lucide-react';
import { ChannelBadges } from '../components/ChannelBadges';
import { OnboardingBot } from '../components/OnboardingBot';
import { EsignPromoBar } from '../components/EsignPromoBar';
import { SmsPhoneMockup } from '../components/landing/SmsPhoneMockup';
import { LandingComparisonTable } from '../components/landing/LandingComparisonTable';
import { LandingPricingCard } from '../components/landing/LandingPricingCard';
import { LandingFaq } from '../components/landing/LandingFaq';

const HOME_META = {
  title: 'Your mini office by text | PinOnIt',
  ogTitle: 'Your mini office by text',
  description:
    'Booking + Sign by Text — waivers, NDAs, addendums, quotes, invoices. One simple app. $8.99/mo.',
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
    title: 'Easy Booking',
    you: 'Send your booking link by text; clients pick a time on your calendar.',
    theySee: 'Tap to grab a time: pinonit.com/pedro',
  },
  {
    icon: ClipboardSignature,
    title: 'Sign-by-Text',
    you: 'Waivers, NDAs, addendums, or simple contracts — signed with a finger after an SMS code.',
    theySee: 'Please sign before Saturday: pinonit.com/d/…',
    featured: true,
  },
  {
    icon: Bell,
    title: 'NeverMiss Reminders',
    you: 'Never miss a reminder. Ping customers — and optionally copy your team — by SMS, WhatsApp, email, or voice.',
    theySee: 'Reminder: 10am tomorrow. Reply C to cancel or R to reschedule.',
    channels: ['sms', 'whatsapp', 'email', 'voice'] as const,
  },
  {
    icon: Receipt,
    title: 'Business Documents',
    you: 'Invoices, receipts, quotes, and everyday docs in seconds.',
    theySee: 'Quote for $450 — tap to approve.',
  },
  {
    icon: QrCode,
    title: 'QR Codes',
    you: 'Create a QR instantly for your booking page, link, or business.',
    theySee: 'Scan to book — no app needed.',
  },
  {
    icon: Mail,
    title: 'Signature Creator',
    you: 'Create and save your signature for documents and email.',
    theySee: 'Your brand, ready to send.',
  },
];

const OLD_VS_TEXT = [
  { old: 'Email a PDF, wait days', new: 'Sign by Text in minutes' },
  { old: 'Print, sign, scan, send back', new: 'Finger sign on their phone' },
  { old: 'Text-tag to schedule', new: 'Send your booking link once' },
  { old: 'Five tools, five logins', new: 'One app — $8.99/mo' },
  { old: 'Chasing no-shows by phone', new: 'NeverMiss Reminders that reply back' },
];

const TRADE_CHIPS = [
  'Landscapers', 'Barbers', 'Auto detailers', 'Pressure washers', 'Electricians', 'Plumbers',
  'Personal trainers', 'Pest control', 'Handymen', 'Financial advisors', 'Massage therapists',
  'Lash & beauty', 'HVAC', 'Notaries', 'Tattoo artists', 'Cleaners', 'Pool pros',
  'Photographers', 'Therapists', 'Salon suites',
];

const SIX_TOOLS = [
  { icon: Calendar, title: 'Easy Booking', desc: 'Your booking page and links, synced to your calendar.' },
  { icon: ClipboardSignature, title: 'Sign-by-Text', desc: 'Waivers, NDAs, addendums, simple contracts.' },
  { icon: Bell, title: 'NeverMiss Reminders', desc: 'Never miss a reminder — you, customers, or your team.' },
  { icon: Receipt, title: 'Business Documents', desc: 'Quotes, invoices, receipts — send in seconds.' },
  { icon: QrCode, title: 'QR Codes', desc: 'Booking page, link, or business — instant.' },
  { icon: Mail, title: 'Signature Creator', desc: 'Save a signature for docs and email.' },
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
      <header className="sticky top-0 z-50">
      <EsignPromoBar to="#sign-by-text" />
      <nav className="bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
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
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24 px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-500/5 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <p className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-x-2 gap-y-1 px-3 py-1.5 mb-5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide">
              BOOK IT · REMIND IT · SEND IT · SIGN IT · PIN IT
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
              Run your business by text.
            </h1>
            <p className="text-lg md:text-xl font-medium text-slate-600 dark:text-slate-300 leading-snug mb-8 max-w-xl mx-auto lg:mx-0">
              <strong className="text-slate-900 dark:text-white">Sign by Text</strong> and <strong className="text-slate-900 dark:text-white">easy booking</strong> — plus reminders, invoices, QR codes, and more. No pile of apps. Just PinOnIt.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-3">
              <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full text-base transition-all shadow-lg shadow-brand-200/60 dark:shadow-none inline-flex items-center justify-center gap-2">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#demo" className="w-full sm:w-auto px-8 py-4 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-full text-base hover:bg-slate-50 dark:hover:bg-slate-800 transition-all inline-flex items-center justify-center">
                See how it works
              </a>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Free trial, then $8.99/mo. Cancel anytime.</p>
          </div>
          <div>
            <SmsPhoneMockup messages={HERO_MESSAGES} caption="Real flow. No app on her phone." />
          </div>
        </div>
      </section>

      {/* Sign-by-Text featured */}
      <section id="sign-by-text" className="py-16 md:py-20 px-6 bg-violet-50/80 dark:bg-violet-950/20 border-y border-violet-100 dark:border-violet-900/40 scroll-mt-28">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300 mb-2">Featured workflow</p>
            <h2 className="font-sign-by-text text-4xl md:text-5xl text-violet-800 dark:text-violet-200 leading-tight mb-3">
              Sign-by-Text
            </h2>
            <p className="text-lg text-slate-700 dark:text-slate-200 font-medium mb-3">
              Need someone to sign a waiver, NDA, quote, addendum or simple contract?
            </p>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Text it. Verify it. Sign it. Done. No app required for the recipient.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {['TEXT', 'OPEN', 'VERIFY', 'SIGN', 'DONE'].map((step, i) => (
                <span key={step} className="inline-flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 text-xs font-bold text-violet-700 dark:text-violet-300 tracking-wide">
                    {step}
                  </span>
                  {i < 4 && <span className="text-violet-300 dark:text-violet-700 text-sm">→</span>}
                </span>
              ))}
            </div>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-md"
            >
              Try Sign-by-Text <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-3xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 p-5 shadow-lg shadow-violet-100/60 dark:shadow-none">
            <SmsPhoneMockup
              messages={[
                { role: 'business' as const, text: "Hi Maria — please review & sign the waiver: pinonit.com/d/k8x2" },
                { role: 'system' as const, text: 'Code sent · enter to verify' },
                { role: 'customer' as const, text: 'Signed with my finger ✅' },
                { role: 'system' as const, text: 'Verified · timestamped · done' },
              ]}
              caption="Sign-by-Text on their phone — nothing to install."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="demo" className="py-20 px-6 bg-slate-50 dark:bg-slate-900/40 scroll-mt-28">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">
            How it works in 10 seconds
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {[
              { n: '1', title: 'You send it', body: 'Pick booking, Sign by Text (waiver, NDA, addendum…), quote, or invoice — and hit send. One tap.' },
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
            Booking. Reminders. Documents. Signatures. QR codes.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TEXT_ACTION_CARDS.map(({ icon: Icon, title, you, theySee, featured, channels }) => (
              <div key={title} className={`rounded-2xl border bg-white dark:bg-slate-900 p-6 ${
                featured
                  ? 'border-violet-300 dark:border-violet-700 ring-1 ring-violet-200/80 dark:ring-violet-800/60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    featured ? 'bg-violet-50 dark:bg-violet-500/10' : 'bg-brand-50 dark:bg-brand-500/10'
                  }`}>
                    <Icon className={`h-5 w-5 ${featured ? 'text-violet-600 dark:text-violet-300' : 'text-brand-600 dark:text-brand-400'}`} />
                  </div>
                  {featured && (
                    <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                      <span className="font-sign-by-text text-sm">Sign-by-Text</span>
                    </span>
                  )}
                </div>
                <h3 className={`font-bold text-slate-900 dark:text-white mb-2 ${featured ? 'font-sign-by-text text-2xl text-violet-800 dark:text-violet-200' : ''}`}>
                  {title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{you}</p>
                {channels && (
                  <ChannelBadges channels={[...channels]} size="sm" className="mb-3" />
                )}
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
      <section id="tools" className="py-20 px-6 bg-white dark:bg-slate-950 scroll-mt-28">
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
      <section id="pricing" className="py-24 px-6 bg-white dark:bg-slate-950 scroll-mt-28">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">Pricing</h2>
          <LandingPricingCard variant="text-first" />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6 bg-slate-50 dark:bg-slate-900/40 scroll-mt-28">
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
          <p className="mt-5 text-brand-100 text-sm">$8.99/mo after your trial. Nothing to install — for you or your customers.</p>
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
