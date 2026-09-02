import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Zap, CreditCard, Users, Ban, AlertTriangle, Scale, Mail, Gift, Gavel, ShieldAlert, Umbrella, Plug, BookOpen, HardDrive, Globe, MessageSquare, ClipboardSignature, Bell, Sparkles } from 'lucide-react';
import { Footer } from '../components/Footer';
import { SMS_BOOKING_CONSENT_CTA, SMS_OPTIONAL_POLICY_SENTENCE } from '../lib/smsCompliance';
import { SUPPORT_EMAIL } from '../lib/contactEmail';

interface Section {
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    icon: FileText,
    title: 'Acceptance of Terms',
    content: (
      <p>
        By accessing or using PinOnIt ("<strong>the Service</strong>") — including creating an account, starting a free trial, or clicking a button that indicates acceptance — you agree to be bound by these Terms of Service ("<strong>Terms</strong>") and our{' '}
        <Link to="/privacy" className="text-brand-600 dark:text-brand-400 hover:underline">Privacy Policy</Link>.
        If you do not agree to these Terms, do not use the Service. These Terms constitute a legally binding agreement between you and Miami Expeditions LLC, doing business as PinOnIt.
      </p>
    ),
  },
  {
    icon: Zap,
    title: 'Description of Service',
    content: (
      <div className="space-y-3">
        <p>
          PinOnIt is a scheduling and meeting management platform that allows users to create shareable booking links, manage availability, coordinate meetings, and send automated reminders. Key features include:
        </p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Shareable booking pages at <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">pinonit.com/yourname</code></span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Calendar integration with Google Calendar and Microsoft Outlook to prevent double-bookings</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Automated email, SMS, and WhatsApp reminders for confirmed meetings</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Custom event types, availability windows, and meeting management tools</span></li>
        </ul>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">Features and availability may change at any time. We will endeavor to provide reasonable notice of significant changes.</p>
      </div>
    ),
  },
  {
    icon: Sparkles,
    title: 'PinOnIt Pro — trial then $6/mo',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Every account includes a <strong>14-day full-access trial</strong> (no credit card required). After the trial, Pro is <strong>$6/month</strong> unless you cancel. Calendly switchers can get <strong>60 days</strong> with a card on file ($0 today).
        </p>
        <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
          <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> SMS, WhatsApp, voice, and calendar write-back</li>
          <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Unlimited event types and reminders</li>
          <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> If your trial ends without subscribing, your account becomes read-only — data stays, booking and reminders pause</li>
        </ul>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Plan features, pricing, and availability are subject to change. We will provide at least 30 days' notice before increasing prices for existing subscribers.
        </p>
      </div>
    ),
  },
  {
    icon: MessageSquare,
    title: 'SMS Communications',
    content: (
      <div className="space-y-4">
        <p>{SMS_BOOKING_CONSENT_CTA}</p>
        <p>{SMS_OPTIONAL_POLICY_SENTENCE}</p>
        <p>
          PinOnIt sends appointment-related SMS text messages to users and booking guests who have voluntarily provided a mobile phone number and explicitly opted in. This section governs your rights and obligations with respect to SMS communications from PinOnIt.
        </p>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wide">SMS Program Summary</p>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <li><strong>Program name:</strong> PinOnIt Appointment Reminders</li>
            <li><strong>Message types:</strong> Booking confirmations, upcoming meeting reminders, cancellation and rescheduling notices</li>
            <li><strong>Frequency:</strong> Varies based on your appointment activity and reminder settings</li>
            <li><strong>Rates:</strong> Message and data rates may apply</li>
            <li><strong>Provider:</strong> Twilio, Inc.</li>
            <li><strong>Opt-out:</strong> Reply STOP to any message</li>
            <li><strong>Help:</strong> Reply HELP or email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline">{SUPPORT_EMAIL}</a></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Consent:</p>
          <ul className="space-y-2 pl-4">
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>By providing a mobile phone number and checking the SMS consent checkbox during the booking process, you agree to receive appointment-related SMS messages from PinOnIt.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>SMS consent is optional and is not required to schedule an appointment.</strong> You may complete a booking without providing a phone number or consenting to SMS.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Consent applies only to transactional, appointment-related messages. We do not send marketing or promotional SMS blasts. PinOnIt SMS messages are strictly limited to appointment confirmations, reminders, and operational notices related to scheduled meetings.</span></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Opt-out and support:</p>
          <ul className="space-y-2 pl-4">
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>You may opt out of SMS messages at any time by replying <strong>STOP</strong> to any message. You will receive one final confirmation message and no further messages will be sent.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Reply <strong>HELP</strong> for help or assistance information.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>You may also remove your phone number at any time from Settings in your PinOnIt account.</span></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Liability:</p>
          <ul className="space-y-2 pl-4">
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>PinOnIt is not liable for delayed or undelivered SMS messages due to carrier routing, network conditions, or recipient device issues.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>You are responsible for ensuring the mobile number you provide is accurate and that you are the authorized user of that number.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>SMS consent is never sold, rented, or shared with third parties or affiliates for marketing purposes.</span></li>
          </ul>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          See our <Link to="/sms-consent" className="text-brand-600 dark:text-brand-400 hover:underline">SMS Consent page</Link> and <Link to="/privacy" className="text-brand-600 dark:text-brand-400 hover:underline">Privacy Policy</Link> for additional information.
        </p>
      </div>
    ),
  },
  {
    icon: Bell,
    title: 'Reminders & Notifications',
    content: (
      <div className="space-y-3">
        <p>
          PinOnIt sends booking confirmations, reminders, and related notices by email, SMS, WhatsApp, or voice when you configure them. We work to deliver messages promptly and reliably, but <strong>we do not guarantee</strong> that any reminder will be sent, received, read, or acted on at a particular time.
        </p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Delivery depends on third-party networks, carriers, device settings, spam filters, and recipient availability. Delays, failures, and undelivered messages can occur even when our systems appear to be operating normally.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>You remain responsible for your appointments, deadlines, and client communications. Use PinOnIt as a supplement to—not a replacement for—your own scheduling practices.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Software bugs, maintenance, outages, or integration errors may occasionally affect reminders or other features. While uncommon, technical errors are always possible.</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: ClipboardSignature,
    title: 'Doc Center — Waivers, NDAs, Contracts & Invoices',
    content: (
      <div className="space-y-3">
        <p>
          PinOnIt Doc Center helps you send waivers, NDAs, contracts, quotes, invoices, and receipts for review or signature by text or link. The Service is designed to support a <strong>strong evidentiary record</strong> (for example, SMS verification, timestamps, and capture of signature or approval on the recipient&apos;s device). <strong>We do not guarantee</strong> that any document will be enforceable, admissible in court, or sufficient for your particular situation.
        </p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Not legal advice:</strong> PinOnIt is not a law firm and does not provide legal advice. Templates and tools are for convenience only. You are solely responsible for the content of documents you send and for determining whether they meet your legal, regulatory, or industry requirements.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>No guarantee of outcome:</strong> We make no promise that a waiver, NDA, contract, quote, invoice, or signature collected through PinOnIt will be upheld in any dispute, audit, or proceeding. Enforceability depends on many factors outside our control, including applicable law, document content, and how the document is used.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Your content:</strong> You represent that you have the right to send each document and that its terms are accurate. You indemnify PinOnIt for claims arising from documents you create or send through the Service.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Record integrity:</strong> We strive to preserve accurate logs of delivery, viewing, verification, and signature events, but we do not warrant that records are complete, tamper-proof, or error-free. Maintain your own backups of important agreements when appropriate.</span></li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Consult a qualified attorney before relying on any template or electronic signature workflow for high-risk or regulated transactions.
        </p>
      </div>
    ),
  },
  {
    icon: Gift,
    title: 'Referral Program',
    content: (
      <div className="space-y-3">
        <p>
          PinOnIt offers a referral program that rewards you when people you refer subscribe to Pro. Program details, eligibility, and payout rules may change; the following applies unless we notify you otherwise.
        </p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Credit:</strong> You earn $1/month in credit for each referred user who becomes and remains an active Pro subscriber.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Plan offset:</strong> Credits first offset your own Pro subscription cost (up to $6/month). Once your plan is fully covered, additional referral earnings accumulate as cash credits.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Payout threshold:</strong> Cash credits are eligible for payout once your accumulated balance reaches a minimum of $10.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Conditions:</strong> Credits are only earned while the referred user maintains an active paid Pro subscription. Credits are forfeited if the referred user cancels or downgrades.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Abuse:</strong> Self-referrals, fake accounts, and referral fraud will result in immediate account termination and forfeiture of all credits.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Changes:</strong> We reserve the right to modify or discontinue the referral program at any time with 30 days' notice to existing participants.</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: CreditCard,
    title: 'Payments & Billing',
    content: (
      <div className="space-y-3">
        <p>All payments are processed securely by <strong>Stripe, Inc.</strong> By providing payment information, you authorize us to charge your payment method on a recurring monthly basis.</p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Billing cycle:</strong> Pro subscriptions are billed monthly on the anniversary of your subscription start date.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>No refunds:</strong> All subscription payments are non-refundable. If you cancel, you retain access until the end of your current billing period.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Cancellation:</strong> You may cancel your subscription at any time from your Billing settings. Cancellation takes effect at the end of the current billing period.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Free trials:</strong> New accounts may start a 14-day Pro trial with no credit card after agreeing to these Terms and our Privacy Policy. A 60-day Pro trial is available when you add a payment method ($0 is charged at signup). When a 60-day trial ends, your subscription bills automatically at the standard monthly rate unless you cancel first. The 14-day no-card trial does not store a card and does not auto-charge; add a card before it ends to keep Pro.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Failed payments:</strong> If a payment fails, we will attempt to retry. Continued failure may result in your account becoming read-only until you reactivate.</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: Users,
    title: 'User Accounts & Responsibilities',
    content: (
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account, including all bookings made through your scheduling links. You must provide accurate information when creating your account. You are solely responsible for the scheduling links you share, the availability you set, and any meetings booked through your account.
      </p>
    ),
  },
  {
    icon: Ban,
    title: 'Prohibited Uses',
    content: (
      <div className="space-y-3">
        <p>You agree not to use the Service to:</p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-red-400 font-bold shrink-0">✗</span><span>Send spam, unsolicited communications, or harass other users or guests.</span></li>
          <li className="flex gap-2"><span className="text-red-400 font-bold shrink-0">✗</span><span>Engage in any illegal activity or violate the rights of any third party.</span></li>
          <li className="flex gap-2"><span className="text-red-400 font-bold shrink-0">✗</span><span>Attempt to gain unauthorized access to any part of the Service or other users' accounts.</span></li>
          <li className="flex gap-2"><span className="text-red-400 font-bold shrink-0">✗</span><span>Reverse engineer, decompile, or attempt to extract the source code of the Service.</span></li>
          <li className="flex gap-2"><span className="text-red-400 font-bold shrink-0">✗</span><span>Use the Service to collect data from other users without their consent.</span></li>
          <li className="flex gap-2"><span className="text-red-400 font-bold shrink-0">✗</span><span>Impersonate any person or entity or misrepresent your affiliation with any person or entity.</span></li>
        </ul>
        <p className="text-xs text-slate-400 dark:text-slate-500">Violation of these prohibitions may result in immediate suspension or termination of your account without refund.</p>
      </div>
    ),
  },
  {
    icon: AlertTriangle,
    title: 'Termination',
    content: (
      <p>
        Either party may terminate this agreement at any time. You may close your account from your account settings. We reserve the right to suspend or terminate your account immediately, without notice or liability, if we determine in our sole discretion that you have violated these Terms, engaged in fraudulent activity, or pose a risk to other users or the Service. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination will do so, including limitations of liability and governing law.
      </p>
    ),
  },
  {
    icon: AlertTriangle,
    title: 'Disclaimer of Warranties',
    content: (
      <p className="uppercase text-xs leading-relaxed">
        The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, non-infringement, or that use of the Service will achieve any particular legal, business, or financial result. We do not warrant that the Service will be error-free, uninterrupted, secure, or that scheduled meetings, reminders, calendar syncs, Doc Center deliveries, signatures, or payment flows will function without failure or delay. We are not responsible for errors, outages, or data loss caused by third-party calendar providers (Google, Microsoft), messaging providers (Twilio, WhatsApp), email providers, or payment providers (Stripe, PayPal).
      </p>
    ),
  },
  {
    icon: Scale,
    title: 'Limitation of Liability',
    content: (
      <p className="uppercase text-xs leading-relaxed">
        To the fullest extent permitted by law, Miami Expeditions LLC (dba PinOnIt) and its members, managers, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to: missed meetings, failed or delayed reminders, undelivered messages, calendar sync errors, double-bookings, lost or disputed contracts, waivers, NDAs, invoices, or signatures, data loss, lost business, or service interruptions — even if we have been advised of the possibility of such damages. Our total aggregate liability to you for any claim arising out of or relating to these Terms or the Service shall not exceed the greater of (a) the total amount you paid us in the 12 months preceding the claim or (b) $10 USD.
      </p>
    ),
  },
  {
    icon: Scale,
    title: 'Governing Law',
    content: (
      <p>
        These Terms are governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of law provisions. PinOnIt is a trade name of Miami Expeditions LLC, a Florida limited liability company. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in Florida, and you consent to personal jurisdiction in such courts.
      </p>
    ),
  },
  {
    icon: FileText,
    title: 'Changes to These Terms',
    content: (
      <p>
        We may update these Terms at any time. When we do, we will revise the "Last updated" date below and, for material changes, notify you by email or via a notice within the Service. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Service.
      </p>
    ),
  },
  {
    icon: Mail,
    title: 'Contact Us',
    content: (
      <p>
        For questions about these Terms, billing disputes, or legal notices, contact us at:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline font-medium">{SUPPORT_EMAIL}</a>
        <br />
        <span className="text-slate-500 dark:text-slate-500">Miami Expeditions LLC dba PinOnIt, Miami-Dade County, Florida</span>
      </p>
    ),
  },
  {
    icon: Gavel,
    title: 'Dispute Resolution & Arbitration',
    content: (
      <div className="space-y-3">
        <p>
          Any dispute arising out of or relating to these Terms or the Service shall first be submitted to us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline">{SUPPORT_EMAIL}</a>{' '}
          with your name, address, description of the claim, and relief sought. If unresolved within 45 days, disputes shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules, conducted in Florida. The arbitrator may award any relief a court could award. Judgment on the award may be entered in any court of competent jurisdiction.
        </p>
      </div>
    ),
  },
  {
    icon: Users,
    title: 'Class Action Waiver',
    content: (
      <p className="uppercase text-xs leading-relaxed">
        ALL DISPUTES MUST BE BROUGHT IN YOUR INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY CLASS ACTION, CONSOLIDATED ACTION, OR REPRESENTATIVE PROCEEDING. The arbitrator may not consolidate claims of more than one person and may not preside over any class proceeding. If this waiver is found unenforceable, the entire arbitration provision shall be void.
      </p>
    ),
  },
  {
    icon: ShieldAlert,
    title: 'Indemnification',
    content: (
      <p>
        You agree to defend, indemnify, and hold harmless PinOnIt and its founders, officers, employees, and affiliates from any claims, damages, losses, costs, and expenses (including reasonable legal fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third party's rights; (d) any content or data you submit through the Service; or (e) your use of any third-party integrations.
      </p>
    ),
  },
  {
    icon: Umbrella,
    title: 'Force Majeure',
    content: (
      <p>
        PinOnIt shall not be liable for any failure or delay caused by circumstances beyond our reasonable control, including internet or telecommunications outages, third-party service failures (Google, Microsoft, Zoom, Stripe, Twilio), natural disasters, pandemics, acts of government, or power failures.
      </p>
    ),
  },
  {
    icon: Plug,
    title: 'Third-Party Applications & Integrations',
    content: (
      <p>
        The Service integrates with third-party platforms including Google Calendar, Microsoft Outlook, Zoom, Stripe, PayPal, and Twilio. Your use of these integrations is governed by those providers' own terms. PinOnIt is not responsible for the availability, accuracy, security, or performance of any third-party service. We may cease providing any integration at any time without compensation if the third-party provider discontinues or restricts access.
      </p>
    ),
  },
  {
    icon: BookOpen,
    title: 'Acceptable Use',
    content: (
      <div className="space-y-3">
        <p>You may not use the Service to: send spam or unsolicited commercial messages; harvest contact data from other users; impersonate any person or entity; circumvent any security or access controls; use automated tools to scrape or extract data; engage in any activity that could damage, disable, or impair the Service; or violate any applicable law or regulation.</p>
        <p><strong>SMS-specific restriction:</strong> PinOnIt's SMS messaging infrastructure is approved only for transactional, appointment-related messages. You may not use PinOnIt to send marketing blasts, promotional campaigns, or any non-appointment SMS content to your guests or contacts. Doing so constitutes a material violation of these Terms and will result in immediate account suspension.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Violation may result in immediate account termination without refund. See also our <Link to="/acceptable-use" className="text-brand-600 dark:text-brand-400 hover:underline">Acceptable Use Policy</Link>.</p>
      </div>
    ),
  },
  {
    icon: HardDrive,
    title: 'Data Retention',
    content: (
      <p>
        We retain your personal data for as long as your account is active or as needed to provide the Service. Upon account deletion, we will delete or anonymize your personal data within 30 days, except where retention is required by law. Calendar tokens, booking data, and contact information are deleted upon account termination.
        <br /><br />
        <strong>Phone numbers</strong> are stored only for as long as your account remains active or until you opt out of SMS communications, whichever comes first. Replying STOP to any SMS message or removing your phone number from account settings immediately removes your number from future message queues.
      </p>
    ),
  },
  {
    icon: Globe,
    title: 'Governing Law & Venue',
    content: (
      <p>
        These Terms are governed by the laws of the State of Florida. For any disputes not subject to arbitration, you consent to exclusive jurisdiction in the state or federal courts of Miami-Dade County, Florida.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 bg-brand-50 dark:bg-brand-500/10 rounded-xl flex items-center justify-center">
              <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Terms of Service
            </h1>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">Last updated: September 2, 2026</p>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
            These Terms govern the PinOnIt platform, a DBA of Miami Expeditions LLC.
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((s, i) => (
            <div key={s.title} className="pb-10 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div className="flex items-center gap-2.5 mb-3">
                <s.icon className="h-4 w-4 text-brand-500 dark:text-brand-400 shrink-0" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {i + 1}. {s.title}
                </h2>
              </div>
              <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {s.content}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
