import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../lib/contactEmail';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  ArrowRight, Check,
  Sun, Moon, Menu, Zap, X, Link2,
  DollarSign, Users,
  ChevronRight, Pause, Play,
  Calendar, Bell, Mail, MessageCircle, MessagesSquare, Phone,
  ClipboardSignature, QrCode, ShoppingBag,
} from 'lucide-react';
import { OnboardingBot } from '../components/OnboardingBot';
import { CALENDLY_EXCLUSIVES } from '../lib/whyPinonit';
import { NDA_HEADLINE, NDA_SUBHEAD } from '../lib/campaignLandings';
import { HOLD_UP_COPY } from '../lib/documentCopy';
import { DocTypeShortcutRow } from '../components/CampaignLanding';

// ── Animated counter hook ────────────────────────────────────────────────────
function useCounter(target: number, duration = 1800, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const pct = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      setVal(Math.floor(ease * target));
      if (pct < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return val;
}

// ── Earnings calc ────────────────────────────────────────────────────────────
function calcEarnings(refs: number) {
  const savings = Math.min(refs, 6);
  const extra = Math.max(0, refs - 6);
  return {
    monthlyCost: Math.max(0, 6 - savings),
    monthlyEarn: extra,
    yearlyEarn: extra * 12,
    isFree: refs >= 6,
  };
}

const MILESTONES = [
  { refs: 6,    label: '6 referrals',    result: 'Pro is FREE',    detail: '$0/mo forever' },
  { refs: 20,   label: '20 referrals',   result: '+$14/mo',        detail: '$168/yr to you' },
  { refs: 100,  label: '100 referrals',  result: '+$94/mo',        detail: '$1,128/yr passive' },
  { refs: 1000, label: '1,000 referrals', result: '+$994/mo',      detail: '$11,928/yr recurring' },
];

// ── 3-column comparison data ─────────────────────────────────────────────────
type CompRow = { section?: string; feature?: string; pinonit?: boolean | string; calendly?: boolean | string; acuity?: boolean | string };

const COMP_ROWS: CompRow[] = [
  { section: 'Pricing' },
  { feature: 'Starting price',    pinonit: 'Free',        calendly: 'Free',         acuity: '$16/mo' },
  { feature: 'Pro / Paid plan',   pinonit: '$6/mo',       calendly: '$16/mo',       acuity: '$20/mo' },
  { feature: 'Referral earnings', pinonit: '$1/mo/user',  calendly: false,          acuity: false },
  { section: 'Calendly does not do this' },
  { feature: 'WhatsApp reminders', pinonit: true, calendly: false, acuity: false },
  { feature: 'Voice reminders & critical alerts', pinonit: true, calendly: false, acuity: false },
  { feature: 'Personal “remind me…” + calendar write-back', pinonit: true, calendly: false, acuity: false },
  { feature: 'Bookings write to Google / Outlook', pinonit: true, calendly: false, acuity: false },
  { feature: 'Remind coworkers / assistant', pinonit: true, calendly: false, acuity: false },
  { feature: 'Two-way SMS cancel/reschedule', pinonit: true, calendly: false, acuity: false },
  { feature: 'Quotes / invoices / receipts', pinonit: true, calendly: false, acuity: false },
  { feature: 'Paid Booking storefront', pinonit: true, calendly: false, acuity: false },
  { feature: 'QR code generator', pinonit: true, calendly: false, acuity: false },
  { feature: 'Email signature generator', pinonit: true, calendly: false, acuity: false },
  { feature: 'Align & book over SMS', pinonit: true, calendly: false, acuity: false },
  { feature: 'Pre-enter someone’s availability', pinonit: true, calendly: false, acuity: false },
  { feature: 'Calendly import', pinonit: true, calendly: false, acuity: false },
  { section: 'Reminders' },
  { feature: 'Email reminders',   pinonit: 'Pro', calendly: 'All plans', acuity: 'All plans' },
  { feature: 'SMS reminders',     pinonit: 'Pro', calendly: 'One-way, $16+', acuity: 'Emerging+' },
  { section: 'Calendar Sync' },
  { feature: 'Google Calendar',   pinonit: true,  calendly: true,  acuity: true },
  { feature: 'Outlook / Office 365', pinonit: true, calendly: true, acuity: true },
  { feature: 'Write bookings back to calendar', pinonit: true, calendly: false, acuity: false },
  { feature: 'Apple Calendar / iCal link', pinonit: true, calendly: false, acuity: false },
  { section: 'Payments' },
  { feature: 'Stripe payments',   pinonit: 'Pro', calendly: 'Standard+', acuity: 'Emerging+' },
  { feature: 'PayPal payments',   pinonit: 'Pro', calendly: false, acuity: false },
];

const SCREENSHOT_V = '20260826';

const SCREENSHOTS = [
  {
    title: 'Super Reminders & Critical Alerts',
    emoji: '🔔',
    desc: 'Email, SMS, WhatsApp, and voice for every booking — plus extra pings for critical meetings (1h + 15m text, 1d + 4h email).',
    tag: 'Smart Reminders',
    color: 'from-violet-500 to-violet-700',
    image: `/screenshots/reminders.png?v=${SCREENSHOT_V}`,
  },
  {
    title: 'Personal “Remind me…”',
    emoji: '🗣️',
    desc: 'Type or record a reminder — call someone, pick up a prescription — and optionally add it to Google or Outlook.',
    tag: 'Personal Reminders',
    color: 'from-amber-500 to-orange-600',
    image: `/screenshots/personal-reminders.png?v=${SCREENSHOT_V}`,
  },
  {
    title: 'Share Anywhere — Even on Phone',
    emoji: '📱',
    desc: 'Copy, QR, email, text, or WhatsApp from your dashboard. On mobile, share opens native apps and the OS share sheet.',
    tag: 'Dashboard',
    color: 'from-indigo-500 to-indigo-700',
    image: `/screenshots/dashboard.png?v=${SCREENSHOT_V}`,
  },
  {
    title: 'Calendar Write-Back',
    emoji: '📆',
    desc: 'Confirmed bookings and personal reminders land on Google or Outlook. Reschedule or cancel removes the old event automatically.',
    tag: 'Calendar Sync',
    color: 'from-emerald-500 to-teal-600',
    image: `/screenshots/calendar-write-back.png?v=${SCREENSHOT_V}`,
  },
  {
    title: 'Your Booking Page',
    emoji: '📅',
    desc: 'A clean, professional page clients book from instantly — no account needed.',
    tag: 'Public Booking Page',
    color: 'from-orange-500 to-orange-600',
    image: `/screenshots/booking-page.png?v=${SCREENSHOT_V}`,
  },
  {
    title: 'Group Scheduling',
    emoji: '👥',
    desc: 'Run a meeting poll or coordinate via SMS when you only have phone numbers.',
    tag: 'Group Scheduling',
    color: 'from-blue-500 to-blue-700',
    image: `/screenshots/group-scheduling.png?v=${SCREENSHOT_V}`,
  },
];

const SCREENSHOT_INTERVAL_MS = 5000;

function ScreenshotShowcase() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [active]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActive((prev) => (prev + 1) % SCREENSHOTS.length);
        setAnimating(false);
      }, 300);
    }, SCREENSHOT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const handleSelect = (i: number) => {
    if (i === active) return;
    setAnimating(true);
    setTimeout(() => {
      setActive(i);
      setAnimating(false);
    }, 200);
  };

  const current = SCREENSHOTS[active];

  return (
    <section className="py-20 bg-gray-50 dark:bg-slate-900/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full uppercase tracking-widest mb-4">
            See It In Action
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Everything you need to schedule — and actually show up
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg max-w-xl mx-auto">
            Reminders, calendar write-back, booking pages, and mobile-native sharing — in one subscription.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex flex-col gap-2 lg:w-64 shrink-0 w-full">
            {SCREENSHOTS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => handleSelect(i)}
                className={`text-left px-4 py-3 rounded-xl border transition-all ${
                  active === i
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                }`}
              >
                <span
                  className={`text-xs font-semibold uppercase tracking-wide block mb-0.5 ${
                    active === i ? 'text-indigo-200' : 'text-gray-400 dark:text-slate-500'
                  }`}
                >
                  {s.tag}
                </span>
                <span className="text-sm font-semibold">
                  {s.emoji} {s.title}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1 w-full">
            <div
              className={`transition-all duration-300 ${
                animating ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
              }`}
            >
              <div className="mb-4">
                <span
                  className={`inline-block px-3 py-1 bg-gradient-to-r ${current.color} text-white text-xs font-bold rounded-full mb-2`}
                >
                  {current.tag}
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{current.title}</h3>
                <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">{current.desc}</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="bg-gray-100 dark:bg-slate-700 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200 dark:border-slate-600">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-white dark:bg-slate-900 rounded-md px-3 py-1 text-xs text-gray-400 dark:text-slate-500 font-mono">
                    pinonit.com
                  </div>
                </div>

                <div className="relative min-h-64 bg-slate-50 dark:bg-slate-900">
                  {!imageFailed ? (
                    <img
                      key={current.image}
                      src={current.image}
                      alt={current.title}
                      className="w-full block object-contain object-top"
                      onError={() => setImageFailed(true)}
                    />
                  ) : (
                    <div className={`bg-gradient-to-br ${current.color} min-h-72 flex flex-col items-center justify-center p-10 text-white`}>
                      <div className="text-7xl mb-4">{current.emoji}</div>
                      <h3 className="text-2xl font-bold mb-2 text-center">{current.title}</h3>
                      <p className="text-white/80 text-center text-sm max-w-xs leading-relaxed">{current.desc}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center items-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs font-medium hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
                  aria-pressed={paused}
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {paused ? 'Play' : 'Pause'}
                </button>
                {SCREENSHOTS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      active === i ? 'bg-indigo-600 w-6' : 'bg-gray-300 dark:bg-slate-600 w-2 hover:bg-indigo-300'
                    }`}
                    aria-label={`Show screenshot ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refs, setRefs] = useState(20);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const calc = calcEarnings(refs);

  const users    = useCounter(24800, 2000, statsVisible);
  const meetings = useCounter(412000, 2200, statsVisible);
  const reminders = useCounter(1380000, 2400, statsVisible);
  const earnings  = useCounter(58200, 2000, statsVisible);

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <img src="/pinonit_logo.png" alt="Pin on It" className="h-11 w-auto" />
          </div>

          <div className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Features</a>
            <a href="#reminders" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Reminders</a>
            <a href="#pricing" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Pricing</a>
            <a href="#earn" className="px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Referral Program</a>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/why-pinonit"
              className="hidden sm:inline-flex items-center gap-1 px-3.5 py-1.5 text-sm font-bold text-white rounded-full animate-cta-blink hover:brightness-110"
            >
              Why we beat Calendly <ArrowRight className="h-3.5 w-3.5" />
            </Link>
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
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">Features</a>
            <a href="#reminders" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">Reminders</a>
            <Link to="/why-pinonit" onClick={() => setMobileMenuOpen(false)} className="py-2 font-semibold text-brand-600 dark:text-brand-400">Why we beat Calendly →</Link>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">Pricing</a>
            <a href="#earn" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-brand-500 transition-colors">Referral Program</a>
          </div>
        )}
      </nav>

      {/* ── App pill bar ── */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 py-3">
        <p className="text-center text-lg sm:text-2xl font-black uppercase tracking-wide sm:tracking-[0.16em] text-[#ff4d1a] px-4">
          6 tools in one
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 px-4">
          {[
            { num: '1', label: 'Scheduling' },
            { num: '2', label: 'Smart Reminders' },
            { num: '3', label: 'Doc Center' },
            { num: '4', label: 'Paid Booking' },
            { num: '5', label: 'QR Code Creator' },
            { num: '6', label: 'Email Signature' },
          ].map(({ num, label }) => (
            <div key={num} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
              <span className="h-[18px] w-[18px] rounded-full bg-brand-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">{num}</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
        <div className="sm:hidden mt-2.5 flex justify-center px-4">
          <Link
            to="/why-pinonit"
            className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white rounded-full animate-cta-blink hover:brightness-110"
          >
            Why we beat Calendly <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-brand-500/5 dark:bg-brand-500/5 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <p className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-200 text-xs font-bold uppercase tracking-widest">
            <Calendar className="h-3.5 w-3.5" />
            Calendar scheduler
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <Bell className="h-3.5 w-3.5" />
            Super reminder app
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-slate-900 dark:text-white mb-6 max-w-4xl mx-auto">
            Let clients book your time easily—with{' '}
            <span className="text-brand-500">smart reminders.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            PinOnIt is a calendar scheduler and super reminder app — email, SMS, WhatsApp, and voice — so you and your guests actually show up. Bookings write back to Google or Outlook, personal reminders land on your calendar, and sharing opens native apps on your phone.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {[
              { icon: Mail, label: 'Email' },
              { icon: MessageCircle, label: 'SMS' },
              { icon: MessagesSquare, label: 'WhatsApp' },
              { icon: Phone, label: 'Voice' },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm"
              >
                <Icon className="h-3.5 w-3.5 text-brand-500" />
                {label}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full text-base transition-all shadow-lg shadow-brand-200/60 dark:shadow-none inline-flex items-center justify-center gap-2">
              Start Free 60-Day Trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#features" className="w-full sm:w-auto px-8 py-4 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-full text-base hover:bg-slate-50 dark:hover:bg-slate-800 transition-all inline-flex items-center justify-center gap-2">
              See all features <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <p className="text-sm text-slate-400 dark:text-slate-500">
            No charge until day 61 · Cancel anytime · No contracts
          </p>
        </div>
      </section>

      {/* ── Super reminders ── */}
      <section id="reminders" className="py-20 px-6 bg-slate-50 dark:bg-slate-900/40 scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-semibold rounded-full uppercase tracking-widest mb-4">
              <Bell className="h-3.5 w-3.5" /> Super reminder app
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Four channels — plus critical alerts when it really matters
            </h2>
            <p className="text-gray-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
              Remind yourself and your guests on the channel they actually answer. Critical meetings get extra SMS/WhatsApp at 1 hour and 15 minutes, email at 1 day and 4 hours, and optional voice calls.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Mail, title: 'Email', desc: 'Confirmations and timed follow-ups in the inbox they already check.' },
              { icon: MessageCircle, title: 'SMS', desc: 'A text before the appointment. Harder to ignore than another email.' },
              { icon: MessagesSquare, title: 'WhatsApp', desc: 'Reach clients where they already chat — especially outside the US.' },
              { icon: Phone, title: 'Voice', desc: 'An actual call so you don’t bury a meeting under a silent phone.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Tell PinOnIt to remind you about a call or errand — type it or say it — and add it to Google/Outlook. Guests can text 2 to reschedule.
          </p>
        </div>
      </section>

      <ScreenshotShowcase />

      {/* ── 6 tools in one ── */}
      <section className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 text-xs font-semibold rounded-full uppercase tracking-widest mb-4">
              6 tools in one
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              One login. Six tools.
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
              Scheduling plus the extras small businesses actually use — without a stack of apps.
            </p>
          </div>

          <div className="rounded-3xl border-2 border-brand-200 dark:border-brand-500/30 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900 p-8 md:p-10 mb-8">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                <ClipboardSignature className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-2">Doc Center</p>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  {NDA_HEADLINE}
                </h3>
                <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                  {NDA_SUBHEAD}
                </p>
                <div className="mt-4">
                  <DocTypeShortcutRow loggedIn={!!user} className="justify-start" />
                </div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                  {HOLD_UP_COPY}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Calendar, title: 'Scheduling', desc: 'Booking page, event types, and Google / Outlook / Apple sync so you do not double-book.' },
              { icon: Bell, title: 'Smart Reminders', desc: 'Email, SMS, WhatsApp, and voice — plus two-way text to cancel or reschedule.' },
              { icon: ShoppingBag, title: 'Paid Booking', desc: 'A price-list storefront. Stripe, PayPal, Venmo, Cash App, or Zelle at booking time.' },
              { icon: QrCode, title: 'QR Code Creator', desc: 'Print a code for cards, trucks, and shop windows that opens your booking page.' },
              { icon: Mail, title: 'Email Signature', desc: 'A signature with your booking link so every email can get you a meeting.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. PinOnIt vs Calendly — exclusive features ── */}
      <section id="features" className="py-20 bg-gradient-to-b from-indigo-950 to-indigo-900 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full uppercase tracking-widest mb-4">
              Why PinOnIt Wins
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything Calendly Has.
              <br />
              <span className="text-indigo-400">Plus What Calendly Doesn&apos;t.</span>
            </h2>
            <p className="text-indigo-200 text-lg max-w-2xl mx-auto">
              Not “Calendly charges extra.” These are missing. PinOnIt starts at $6/month.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {CALENDLY_EXCLUSIVES.map(({ icon, title, desc, tag }) => (
              <div
                key={title}
                className="relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-indigo-400/40 transition-all group"
              >
                <div className="absolute -top-3 right-4">
                  <span className="inline-block px-2.5 py-0.5 bg-red-500/90 text-white text-xs font-bold rounded-full">
                    {tag}
                  </span>
                </div>
                <div className="text-3xl mb-3" aria-hidden>{icon}</div>
                <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
                <p className="text-indigo-200/80 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/why-pinonit"
              className="inline-flex items-center gap-2 text-indigo-300 hover:text-white text-sm font-semibold mb-8"
            >
              See the full PinOnIt vs Calendly list <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-lg rounded-2xl transition-colors shadow-lg shadow-indigo-500/25"
            >
              Start Free — No Credit Card Needed
              <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="text-indigo-300/60 text-sm mt-3">
              14-day Pro trial · $6/mo after · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. SWITCH FROM CALENDLY ── */}
      <section id="compare" className="py-24 px-6 bg-slate-50 dark:bg-slate-900/30 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-5">
              <Zap className="h-3.5 w-3.5" /> Switch in 5 minutes
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
              Switch to Pin On It in 5 minutes and $ave.
            </h2>
            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm shadow-sm">
              <span className="line-through text-slate-400">Calendly charges $16/mo.</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-500">You pay $6. That's $120/year back in your pocket.</span>
            </div>
          </div>

          {/* 3-step wizard */}
          <div className="grid sm:grid-cols-3 gap-4 mb-14">
            {[
              { n: '1', title: 'Import your event types', desc: 'Your Calendly link keeps working while you migrate. Copy your event types in seconds.' },
              { n: '2', title: 'Claim your username', desc: 'Get pinonit.com/yourname — your personal booking page is live instantly.' },
              { n: '3', title: 'Share your new link', desc: 'Drop it in your email signature, LinkedIn, or anywhere you already shared Calendly.' },
            ].map((step) => (
              <div key={step.n} className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 overflow-hidden">
                <span className="absolute top-3 right-4 text-6xl font-black text-slate-100 dark:text-slate-800 select-none leading-none">{step.n}</span>
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center mb-4">
                    <span className="text-white font-black text-sm">{step.n}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">{step.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 3-column comparison table */}
          <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-2xl shadow-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden min-w-[560px]">
              <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Feature</div>
                <div className="p-4 text-center">
                  <span className="font-bold text-indigo-600 dark:text-indigo-500 text-sm">PinOnIt</span>
                  <div className="text-indigo-600 text-xs font-semibold mt-0.5">from $6/mo</div>
                </div>
                <div className="p-4 text-center">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-sm">Calendly</span>
                  <div className="text-red-400 text-xs font-semibold mt-0.5">from $16/mo</div>
                </div>
                <div className="p-4 text-center">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-sm">Acuity</span>
                  <div className="text-red-400 text-xs font-semibold mt-0.5">from $20/mo</div>
                </div>
              </div>

              {COMP_ROWS.map((row, i) => {
                if (row.section) {
                  return (
                    <div key={row.section} className="grid grid-cols-4 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                      <div className="col-span-4 px-4 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{row.section}</div>
                    </div>
                  );
                }
                const isLast = i === COMP_ROWS.length - 1;
                const Cell = ({ val }: { val: boolean | string | undefined }) => (
                  <div className="p-3.5 text-center flex items-center justify-center">
                    {val === true
                      ? <Check className="h-4 w-4 text-indigo-600" />
                      : val === false
                        ? <X className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                        : <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-500 leading-tight">{val}</span>}
                  </div>
                );
                const wins = row.pinonit !== false && (row.calendly === false || row.acuity === false);
                return (
                  <div key={row.feature} className={`grid grid-cols-4 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors ${!isLast ? 'border-b border-slate-100 dark:border-slate-800/50' : ''}`}>
                    <div className="p-3.5 pl-4 text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      {wins && <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />}
                      {row.feature}
                    </div>
                    <Cell val={row.pinonit} />
                    <Cell val={row.calendly} />
                    <Cell val={row.acuity} />
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">Competitor pricing as of May 2026. Subject to change.</p>

          <div className="mt-8 text-center">
            <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full text-base transition-all shadow-lg shadow-brand-500/20">
              Switch to PinOnIt — free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. SOCIAL PROOF / STATS BAR ── */}
      <div ref={statsRef} className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 py-14 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { val: users,    suffix: '+', label: 'Total users',             color: 'text-brand-500 dark:text-brand-400' },
            { val: meetings, suffix: '+', label: 'Meetings scheduled',      color: 'text-indigo-600 dark:text-indigo-500' },
            { val: reminders,suffix: '+', label: 'Reminders sent',          color: 'text-teal-600 dark:text-teal-400' },
            { val: earnings, prefix: '$', label: 'Referral earnings paid',  color: 'text-amber-500 dark:text-amber-400' },
          ].map(({ val, suffix, prefix, label, color }) => (
            <div key={label}>
              <p className={`text-3xl sm:text-4xl font-extrabold tabular-nums ${color}`}>
                {prefix}{val.toLocaleString()}{suffix}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. PRICING ── */}
      <section id="pricing" className="py-24 px-6 bg-white dark:bg-slate-950 scroll-mt-16">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
              One plan. Full access. Try it free.
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Every account starts with 14 days of Pro — no card required. Calendly switchers get 60 days with a card on file ($0 today).
            </p>
          </div>

          <div className="relative rounded-2xl border-2 border-brand-500 bg-brand-500 shadow-xl shadow-brand-200/50 dark:shadow-none p-8 flex flex-col">
            <div className="mb-6">
              <h3 className="text-2xl font-extrabold text-white">PinOnIt Pro</h3>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-5xl font-extrabold text-white">$6</span>
                <span className="line-through text-brand-200 text-sm">$16</span>
                <span className="text-brand-200 text-sm">/month after trial</span>
              </div>
              <p className="mt-2 text-sm text-brand-100">14-day trial included · cancel anytime</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-8">
              {[
                'WhatsApp + two-way SMS (text 2 to reschedule)',
                'Critical alerts + voice reminders',
                'Personal “remind me…” with calendar write-back',
                'Bookings sync to Google / Outlook',
                'Quotes, invoices, Paid Booking storefront',
                'Calendly import + referral credits',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <div className="h-4 w-4 rounded-full bg-white/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                  <span className="text-sm text-brand-50">{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/signup" className="w-full py-3.5 rounded-full text-sm font-bold flex items-center justify-center bg-white text-brand-600 hover:bg-brand-50 transition-all">
              Start 14-day trial
            </Link>
          </div>

          <p className="mt-6 text-center text-sm text-slate-400 dark:text-slate-500">
            <span className="font-semibold text-indigo-600 dark:text-indigo-500">Refer 6 people → enough credits to cover Pro.</span>{' '}
            Refer more → PinOnIt pays you $1/mo per person.
          </p>
        </div>
      </section>

      {/* ── 6. REFERRAL EARNINGS CALCULATOR ── */}
      <section id="earn" className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-24 px-6 scroll-mt-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-brand-500/8 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-600/30 bg-indigo-600/10 text-indigo-500 text-xs font-bold mb-5">
              <DollarSign className="h-3 w-3" /> Referral Earnings Program
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">
              Share PinOnIt.<br />
              Get paid every month.
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-2">
              Earn <strong className="text-white">$1/month</strong> for every person you refer to Pro — permanently.
            </p>
            <p className="text-slate-500 text-sm italic">
              "Think of it as a permanent commission on every customer you bring in."
            </p>
          </div>

          {/* Milestone tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {MILESTONES.map((m) => (
              <button
                key={m.refs}
                onClick={() => setRefs(m.refs)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  refs === m.refs
                    ? 'border-indigo-600 bg-indigo-600/15 shadow-lg shadow-indigo-600/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                }`}
              >
                <p className={`text-xs font-bold mb-1.5 ${refs === m.refs ? 'text-indigo-500' : 'text-slate-500'}`}>{m.label}</p>
                <p className="text-lg font-black text-white leading-tight">{m.result}</p>
                <p className="text-xs text-slate-500 mt-1">{m.detail}</p>
              </button>
            ))}
          </div>

          {/* Slider calculator */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-base font-semibold text-slate-300">How many people will you refer?</p>
              <span className="text-4xl font-black text-indigo-500 tabular-nums">{refs}</span>
            </div>

            <input
              type="range"
              min={1}
              max={1000}
              value={refs}
              onChange={(e) => setRefs(Number(e.target.value))}
              className="w-full h-2 rounded-full bg-slate-700 accent-indigo-600 cursor-pointer mb-10"
            />

            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Monthly</p>
                {calc.monthlyEarn > 0 ? (
                  <p className="text-3xl md:text-4xl font-black text-indigo-500 leading-none">
                    +${calc.monthlyEarn.toLocaleString()}<span className="text-xl">/mo</span>
                  </p>
                ) : calc.isFree ? (
                  <p className="text-3xl md:text-4xl font-black text-indigo-500 leading-none">FREE</p>
                ) : (
                  <p className="text-3xl md:text-4xl font-black text-white leading-none">
                    ${calc.monthlyCost}<span className="text-xl">/mo</span>
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {calc.monthlyEarn > 0 ? 'paid to you' : calc.isFree ? 'Pro plan cost' : 'after discount'}
                </p>
              </div>

              <div className="border-x border-white/10">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Yearly</p>
                {calc.yearlyEarn > 0 ? (
                  <p className="text-3xl md:text-4xl font-black text-indigo-500 leading-none">
                    +${calc.yearlyEarn.toLocaleString()}<span className="text-xl">/yr</span>
                  </p>
                ) : (
                  <p className="text-3xl md:text-4xl font-black text-white leading-none">
                    ${(calc.monthlyCost * 12)}<span className="text-xl">/yr</span>
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {calc.yearlyEarn > 0 ? 'passive income' : 'total cost'}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Pro plan</p>
                {calc.isFree ? (
                  <p className="text-3xl md:text-4xl font-black text-indigo-500 leading-none">FREE</p>
                ) : (
                  <p className="text-3xl md:text-4xl font-black text-white leading-none">
                    {6 - refs} <span className="text-xl">more</span>
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {calc.isFree ? '+ earning extra cash' : 'referrals until free'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 bg-brand-600 hover:bg-brand-500 text-white font-black text-lg rounded-full transition-all shadow-xl shadow-brand-500/30"
            >
              Get My Free Referral Link <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="mt-3 text-slate-500 text-sm">1,000 referrals = $994/mo. Yours. Every month. Forever.</p>
          </div>
        </div>
      </section>

      {/* ── 7. HOW REFERRAL PROGRAM WORKS ── */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">The referral program</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
              How it works
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
              Three steps. No catch. No expiry. 1,000 referrals = $994/mo. <strong className="text-slate-800 dark:text-slate-200">Yours. Every month.</strong>
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            {[
              { icon: Link2,       n: '01', title: 'Get your unique link',      desc: 'Every account gets a permanent referral link instantly — no approval, no minimum.' },
              { icon: Users,       n: '02', title: 'Share with your network',   desc: 'Post on LinkedIn, add to your email footer, or share directly with colleagues.' },
              { icon: DollarSign,  n: '03', title: 'Earn $1/mo per subscriber forever', desc: 'Each time someone you referred pays their $6/mo, $1 flows to you. Automatically. Every single month.' },
            ].map((step) => (
              <div key={step.n} className="relative text-center">
                <div className="hidden sm:block absolute top-10 left-[calc(50%+28px)] right-[calc(-50%+28px)] h-px bg-gradient-to-r from-indigo-300 to-transparent dark:from-indigo-700 pointer-events-none last:hidden" />
                <div className="h-16 w-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-5 relative">
                  <step.icon className="h-7 w-7 text-indigo-600 dark:text-indigo-500" />
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">{step.n.replace('0', '')}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Permanent stake callout */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 to-indigo-600 p-8 text-center">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 left-4 text-8xl font-black text-white select-none">$</div>
              <div className="absolute bottom-2 right-4 text-8xl font-black text-white select-none">∞</div>
            </div>
            <p className="relative text-indigo-100 text-sm font-semibold mb-2 uppercase tracking-widest">Social proof</p>
            <p className="relative text-2xl md:text-3xl font-black text-white leading-snug max-w-2xl mx-auto">
              "Think of it as owning a permanent stake in every customer you bring in."
            </p>
            <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto text-center">
              {[
                { n: '6',    label: 'refs = Free Pro' },
                { n: '20',   label: 'refs = +$14/mo' },
                { n: '100',  label: 'refs = +$94/mo' },
                { n: '1,000', label: 'refs = +$994/mo' },
              ].map((c) => (
                <div key={c.n} className="bg-white/10 rounded-xl px-3 py-3">
                  <p className="text-xl font-black text-white">{c.n}</p>
                  <p className="text-xs text-indigo-100 mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. FINAL CTA ── */}
      <section className="py-24 px-6 bg-brand-500">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">
            Never miss a meeting again.
          </h2>
          <p className="text-brand-100 text-lg mb-10 max-w-lg mx-auto">
            Calendar scheduling plus super reminders over email, SMS, WhatsApp, and voice. Set up in minutes. No credit card required.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-3 px-10 py-5 bg-white text-brand-600 font-black text-lg rounded-full transition-all shadow-2xl hover:bg-brand-50 hover:scale-105"
          >
            Create Your Free Account <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-5 text-brand-200 text-sm">14-day trial · $6/mo after · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-10 px-6 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
          <img src="/pinonit_logo.png" alt="Pin on It" className="h-7 w-auto" />
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#reminders" className="hover:text-slate-900 dark:hover:text-white transition-colors">Reminders</a>
            <a href="#compare" className="hover:text-slate-900 dark:hover:text-white transition-colors">vs. Calendly</a>
            <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</a>
            <a href="#earn" className="hover:text-slate-900 dark:hover:text-white transition-colors">Referral Program</a>
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
