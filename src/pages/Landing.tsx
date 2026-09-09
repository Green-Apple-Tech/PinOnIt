import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../lib/contactEmail';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import {
  ArrowRight,
  Sun, Moon, Menu, X,
  Calendar, Bell, ClipboardSignature, Receipt, FileText,
} from 'lucide-react';
import { ChannelBadges } from '../components/ChannelBadges';
import { OnboardingBot } from '../components/OnboardingBot';
import { EsignPromoBar } from '../components/EsignPromoBar';
import { SmsPhoneMockup } from '../components/landing/SmsPhoneMockup';
import { LandingPricingCard } from '../components/landing/LandingPricingCard';
import { LandingFaq } from '../components/landing/LandingFaq';

const HOME_META = {
  title: 'Run your business by text | PinOnIt',
  ogTitle: 'Run your business by text | PinOnIt',
  description:
    'Quote a job in the driveway. Get it approved, signed, scheduled and paid before you drive away. Booking, Sign-by-Text, and reminders by SMS, WhatsApp, email, or voice. $8.99/month.',
  url: 'https://pinonit.com/',
  image: 'https://pinonit.com/og-why-pinonit.png',
  twitterCard: 'summary_large_image' as const,
};

const QUOTE_THREAD = [
  { role: 'business' as const, text: "Green Lawn: Here's your quote for front yard cleanup — $450. View: pinonit.com/d/…" },
  { role: 'system' as const, text: 'Opened · they tapped the text' },
  { role: 'customer' as const, text: 'Approved ✅' },
  { role: 'system' as const, text: 'Approved · 2:14 PM' },
];

const FAMILY = [
  {
    icon: Receipt,
    title: 'Quote-by-Text',
    does: 'Price the job on your phone and text it.',
    they: 'They open it, approve, and sign — no app.',
  },
  {
    icon: FileText,
    title: 'Invoice-by-Text',
    does: 'Send what they owe, with your own pay link.',
    they: 'They tap, see the total, and pay the way they already pay you.',
  },
  {
    icon: ClipboardSignature,
    title: 'Sign-by-Text',
    does: 'Text a document. They verify with a code and sign with a finger.',
    they: 'Meets federal ESIGN Act requirements. Every signature has an audit record.',
    signByText: true,
  },
  {
    icon: Calendar,
    title: 'Book-by-Text',
    does: 'Share a booking link or QR. Syncs with Google and Outlook, and with Apple Calendar so you don’t double-book. Import from Calendly.',
    they: 'They pick a time on their phone. You stop playing phone tag to lock a slot.',
  },
  {
    icon: Bell,
    title: 'Reminders',
    does: 'Automatic text, WhatsApp, email, or voice call before the appointment. They reply 1 to cancel or 2 to reschedule.',
    they: 'Cuts no-shows. Ends the “are we still on?” call.',
    channels: ['sms', 'whatsapp', 'email', 'voice'] as const,
  },
] as const;

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img src="/pinonit_logo.png" alt="Pin on It" className="h-11 w-auto" />
          </Link>

          <div className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#demo" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">How it works</a>
            <a href="#tools" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">What you get</a>
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
                <Link to="/signup" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full transition-colors">Start free trial</Link>
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
            <a href="#tools" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">What you get</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">FAQ</a>
          </div>
        )}
      </nav>
      </header>

      <section className="relative overflow-hidden pt-10 pb-14 md:pt-16 md:pb-24 px-4 sm:px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-500/5 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="font-bold tracking-tight leading-[1.35] mb-4">
              <span className="block text-[1.25rem] md:text-[1.5rem] text-slate-500 dark:text-slate-400">
                Book a Meeting by Text
              </span>
              <span className="block text-[1.5rem] md:text-[1.75rem] text-brand-600 dark:text-brand-400">
                Sign a Document by Text
              </span>
              <span className="block text-[1.75rem] md:text-[2rem] text-slate-900 dark:text-white">
                Run your business by Text
              </span>
            </h1>
            <p className="text-lg md:text-xl font-medium text-slate-600 dark:text-slate-300 leading-snug mb-8 max-w-xl mx-auto lg:mx-0">
              Quote a job in the driveway. Get it approved, signed, scheduled and paid before you drive away.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link
                to="/signup"
                className="w-full sm:w-auto min-h-12 px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full text-base transition-all shadow-lg shadow-brand-200/60 dark:shadow-none inline-flex items-center justify-center gap-2"
              >
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#demo"
                className="w-full sm:w-auto min-h-12 px-8 py-3.5 rounded-full text-base font-semibold border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300 inline-flex items-center justify-center"
              >
                See how it works
              </a>
            </div>
          </div>
          <div>
            <SmsPhoneMockup messages={QUOTE_THREAD} caption="A real text. Nothing to install on their phone." />
          </div>
        </div>
      </section>

      <section id="tools" className="py-16 md:py-20 px-4 sm:px-6 bg-slate-50 dark:bg-slate-900/40 scroll-mt-28">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-3">
            Five tools. One text thread.
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
            Same idea every time: you send it, they tap it, you get the answer.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {FAMILY.map(({ icon: Icon, title, does, they, ...rest }) => {
              const signByText = 'signByText' in rest && rest.signByText;
              const channels = 'channels' in rest ? rest.channels : undefined;
              return (
                <div
                  key={title}
                  id={signByText ? 'sign-by-text' : undefined}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col min-h-[13.5rem]"
                >
                  <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <h3 className={`font-bold text-slate-900 dark:text-white mb-2 ${
                    signByText ? 'font-sign-by-text text-2xl text-violet-800 dark:text-violet-200' : 'text-lg'
                  }`}>
                    {title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{does}</p>
                  {channels && (
                    <ChannelBadges channels={[...channels]} size="sm" className="mb-2" />
                  )}
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-auto">{they}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="demo" className="py-16 md:py-20 px-4 sm:px-6 bg-white dark:bg-slate-950 scroll-mt-28">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">
            How it works
          </h2>
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <ol className="space-y-6">
              {[
                { n: '1', title: 'You text it', body: 'A quote, a document, or a booking link.' },
                { n: '2', title: 'They tap the text', body: 'No app, no account, no email needed.' },
                { n: '3', title: 'They approve, sign, or book', body: 'You get notified instantly.' },
              ].map((step) => (
                <li key={step.n} className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-brand-500 text-white font-black flex items-center justify-center shrink-0">{step.n}</div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{step.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <SmsPhoneMockup messages={QUOTE_THREAD} caption="Not a stock photo. This is the text they get." />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-4 sm:px-6 bg-slate-50 dark:bg-slate-900/40">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-2">Get paid</p>
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
              Quote in the driveway → they approve and sign → they pay on your Zelle, Cash App, or PayPal. When you’ve got the money, one tap texts a receipt.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300 mb-2">Get them to show up</p>
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
              Book from a link → automatic text the day before → they reply 2 to pick a new time.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 md:py-24 px-4 sm:px-6 bg-white dark:bg-slate-950 scroll-mt-28">
        <div className="max-w-lg mx-auto">
          <h2 className="sr-only">Pricing</h2>
          <LandingPricingCard variant="text-first" />
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 bg-slate-50 dark:bg-slate-900/40">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Who it’s for
          </h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Built for people who work from a truck or a chair, not a desk: landscapers, plumbers, electricians, handymen, pressure washing, mobile detailing, pool service, barbers, trainers, photographers.
          </p>
        </div>
      </section>

      <section id="faq" className="py-20 px-4 sm:px-6 bg-white dark:bg-slate-950 scroll-mt-28">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">FAQ</h2>
          <LandingFaq />
        </div>
      </section>

      <section className="py-20 md:py-24 px-4 sm:px-6 bg-brand-500">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-black text-white leading-tight mb-6">
            Send your first quote or booking link in the next five minutes.
          </h2>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-3 min-h-12 px-10 py-4 bg-white text-brand-600 font-black text-lg rounded-full transition-all shadow-2xl hover:bg-brand-50"
          >
            Start free trial <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-5 text-brand-100 text-sm">$8.99/month after your trial. Nothing to install — for you or your customers.</p>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-10 px-4 sm:px-6 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
          <img src="/pinonit_logo.png" alt="Pin on It" className="h-7 w-auto" />
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/why-pinonit" className="hover:text-slate-900 dark:hover:text-white transition-colors">Why PinOnIt</Link>
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
