import { Link } from 'react-router-dom';
import {
  QrCode, Mail, FileText, ArrowRight,
  CalendarDays, Users, ShoppingBag, Bell, Sparkles, Gift,
} from 'lucide-react';

function ToolCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  to,
}: {
  icon: typeof QrCode;
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
}) {
  return (
    <div className="group flex flex-col rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="h-16 w-16 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-8 w-8 text-brand-600 dark:text-brand-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-2.5 text-sm text-gray-600 dark:text-slate-400 leading-relaxed flex-1">{description}</p>
      <Link
        to={to}
        className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {buttonLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ComingSoonCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof QrCode;
  title: string;
  description: string;
}) {
  return (
    <div className="group flex flex-col rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 p-8">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-6">
        <Icon className="h-8 w-8 text-gray-400 dark:text-slate-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-500 dark:text-slate-400">{title}</h2>
      <p className="mt-2.5 text-sm text-gray-400 dark:text-slate-500 leading-relaxed flex-1">{description}</p>
      <span className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 text-sm font-semibold rounded-xl cursor-not-allowed">
        Coming Soon
      </span>
    </div>
  );
}

export function MoreToolsPage() {
  return (
    <main className="p-6 md:p-8 max-w-6xl w-full">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">All Tools</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              Everything included with your PinOnIt subscription — scheduling, reminders, quotes, and more.
            </p>
          </div>
        </div>
      </div>

      {/* Featured tools — the main two */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-4">
          Main Tools
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="group flex flex-col rounded-3xl border-2 border-brand-200 dark:border-brand-500/30 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900 p-8 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-16 w-16 rounded-2xl bg-brand-600 flex items-center justify-center">
                <CalendarDays className="h-8 w-8 text-white" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-brand-500">Tool 1</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Calendar Scheduler</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed flex-1">
              Your booking page, event types, and calendar sync — Google, Outlook, and Apple. Prevent double-bookings, accept payments, and share one link everywhere.
            </p>
            <Link
              to="/dashboard"
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Open Scheduler <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="group flex flex-col rounded-3xl border-2 border-teal-200 dark:border-teal-500/30 bg-gradient-to-br from-teal-50 to-white dark:from-teal-900/20 dark:to-slate-900 p-8 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-16 w-16 rounded-2xl bg-teal-500 flex items-center justify-center">
                <Bell className="h-8 w-8 text-white" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-teal-500">Tool 2</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Smart Reminders</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed flex-1">
              Email, SMS, WhatsApp, and Voice reminders for every booking and any calendar event. Make sure nobody misses a meeting.
            </p>
            <Link
              to="/dashboard/reminders"
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Open Smart Reminders <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Extra tools */}
      <div className="mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-4">
          Included Tools
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            icon={FileText}
            title="Quote/Invoice Text App"
            description="Send quotes, invoices, and cash receipts by email or text. Add a PayPal, Venmo, or Cash App link so clients can pay anywhere. PinOnIt sends it — you don't need a separate app."
            buttonLabel="Open Quote/Invoice"
            to="/dashboard/quotes"
          />
          <ToolCard
            icon={QrCode}
            title="QR Code Creator"
            description="Generate QR codes for your booking links to share anywhere — business cards, flyers, signs, or storefronts."
            buttonLabel="Open QR Creator"
            to="/dashboard/qr-code"
          />
          <ToolCard
            icon={Mail}
            title="Email Signature"
            description="Create a professional email signature with your booking link built in. Every email you send becomes a booking opportunity."
            buttonLabel="Open Signature Builder"
            to="/dashboard/signature"
          />
          <ToolCard
            icon={ShoppingBag}
            title="Paid Bookings"
            description="Accept payments at booking time — Stripe, PayPal, Venmo, Cash App, or Zelle. No separate invoicing or payment links needed."
            buttonLabel="Open Paid Bookings"
            to="/dashboard/paid-booking"
          />
          <ToolCard
            icon={Gift}
            title="Referrals — save on Pro"
            description="Share your referral link. When someone upgrades to Pro, you earn $1/month off your bill. Six referrals covers a full Pro plan."
            buttonLabel="Open Referrals"
            to="/dashboard/settings?tab=referrals"
          />
          <ToolCard
            icon={Users}
            title="Group Scheduling"
            description="Run meeting polls, coordinate via SMS with phone-only invitees, and find a time that works for everyone."
            buttonLabel="Open Group Scheduling"
            to="/dashboard/group-scheduling"
          />
          <ToolCard
            icon={Users}
            title="Contacts"
            description="Import from Gmail or Outlook, add people by hand, and see every booking with a client in one place."
            buttonLabel="Open Contacts"
            to="/dashboard/contacts"
          />
          <ToolCard
            icon={CalendarDays}
            title="Appointments"
            description="See your full calendar of upcoming, past, and pending bookings. Cancel or reschedule with one tap."
            buttonLabel="Open Calendar"
            to="/dashboard/appointments"
          />
        </div>
      </div>

      {/* Coming soon */}
      <div className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-4">
          Coming Soon
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ComingSoonCard
            icon={Sparkles}
            title="AI Booking Assistant"
            description="Let AI draft your event descriptions, reminder messages, and follow-up notes in seconds."
          />
        </div>
      </div>
    </main>
  );
}
