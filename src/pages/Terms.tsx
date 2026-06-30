import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Zap, CreditCard, Users, Ban, AlertTriangle, Scale, Mail, Gift, Gavel, ShieldAlert, Umbrella, Plug, BookOpen, HardDrive, Globe, MessageSquare } from 'lucide-react';
import { Footer } from '../components/Footer';
import { SMS_TERMS_DISCLOSURE, SMS_OPTIONAL_POLICY_SENTENCE } from '../lib/smsCompliance';
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
        By accessing or using PinOnIt ("<strong>the Service</strong>"), you agree to be bound by these Terms of Service ("<strong>Terms</strong>") and our{' '}
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
    icon: Zap,
    title: 'Free and Pro Plans',
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Free Plan</p>
            <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Unlimited booking links</li>
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Basic event types</li>
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Email reminders</li>
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Core scheduling features</li>
            </ul>
          </div>
          <div className="p-4 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-700/40 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Pro Plan</p>
              <span className="text-xs font-bold text-brand-700 dark:text-brand-300">$6/month</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Everything in Free</li>
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> SMS & WhatsApp reminders</li>
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Calendar integrations</li>
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Advanced event types</li>
              <li className="flex gap-1.5"><span className="text-indigo-600">✓</span> Priority support</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Plan features, pricing, and availability are subject to change. We will provide at least 30 days' notice before increasing prices for existing subscribers.
        </p>
      </div>
    ),
  },
  {
    icon: MessageSquare,
    title: 'SMS Notifications',
    content: (
      <div className="space-y-3">
        <p>{SMS_TERMS_DISCLOSURE}</p>
        <p>{SMS_OPTIONAL_POLICY_SENTENCE}</p>
        <p>
          See our{' '}
          <Link to="/sms-consent" className="text-brand-600 dark:text-brand-400 hover:underline">SMS Consent page</Link>{' '}
          and <Link to="/privacy" className="text-brand-600 dark:text-brand-400 hover:underline">Privacy Policy</Link> for additional information.
        </p>
      </div>
    ),
  },
  {
    icon: Gift,
    title: 'Referral Program',
    content: (
      <div className="space-y-3">
        <p>PinOnIt operates a referral program that allows Pro subscribers to earn credits and cash rewards by referring new users. The key terms are:</p>
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
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Free trials:</strong> Where a free trial is offered (e.g., for Calendly switchers), no payment is required during the trial period. Your subscription will automatically continue at the standard rate unless cancelled before the trial ends.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Failed payments:</strong> If a payment fails, we will attempt to retry. Continued failure may result in downgrade to the Free plan.</span></li>
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
        The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability or fitness for a particular purpose. We do not warrant that the Service will be error-free, uninterrupted, or that scheduled meetings, reminders, or calendar syncs will function without failure or delay. We are not responsible for errors, outages, or data loss caused by third-party calendar providers (Google, Microsoft), messaging providers (Twilio, WhatsApp), or payment providers (Stripe).
      </p>
    ),
  },
  {
    icon: Scale,
    title: 'Limitation of Liability',
    content: (
      <p className="uppercase text-xs leading-relaxed">
        To the fullest extent permitted by law, Miami Expeditions LLC (dba PinOnIt) and its members, managers, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to: missed meetings, failed reminders, calendar sync errors, double-bookings, data loss, lost business, or service interruptions — even if we have been advised of the possibility of such damages. Our total aggregate liability to you for any claim arising out of or relating to these Terms or the Service shall not exceed the greater of (a) the total amount you paid us in the 12 months preceding the claim or (b) $10 USD.
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
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
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
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Terms of Service
            </h1>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">Last updated: May 28, 2026</p>
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
