import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Database, Eye, Share2, Clock, Mail, ExternalLink, Globe, User, Cookie, Server, Lock, MessageSquare } from 'lucide-react';
import { Footer } from '../components/Footer';
import { SMS_PRIVACY_DISCLOSURE, SMS_OPTIONAL_POLICY_SENTENCE } from '../lib/smsCompliance';
import { SUPPORT_EMAIL } from '../lib/contactEmail';

interface Section {
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    icon: Shield,
    title: 'Introduction',
    content: (
      <p>
        PinOnIt ("<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") is a scheduling and meeting management platform operated by Miami Expeditions LLC, doing business as PinOnIt. This Privacy Policy explains how we collect, use, and protect your personal information when you use{' '}
        <a href="https://pinonit.com" className="text-brand-600 dark:text-brand-400 hover:underline">pinonit.com</a>{' '}
        and any related services (collectively, the "<strong>Service</strong>"). By using the Service, you agree to the practices described in this policy.
      </p>
    ),
  },
  {
    icon: Database,
    title: 'Information We Collect',
    content: (
      <div className="space-y-3">
        <p>We collect the following categories of information:</p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Account information</strong> — your name and email address when you register for an account.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Calendar data</strong> — availability information and confirmed meeting times, but only when you explicitly connect a calendar integration (Google Calendar, Outlook, Apple). We do not access calendar data without your authorization.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Contacts data</strong> — when you choose to sync contacts from Google or Outlook, we import names, email addresses, and phone numbers from your contacts list. We do not access contacts without your explicit action.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Booking information</strong> — names, email addresses, and any details provided by guests who book meetings through your scheduling link.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Usage data</strong> — technical information such as IP address, browser type, and pages visited, collected automatically to operate and improve the Service.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Payment information</strong> — billing details are processed and stored by Stripe. We do not store full payment card numbers.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Contact information</strong> — phone numbers or WhatsApp numbers if you choose to provide them for SMS reminder functionality.</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: Eye,
    title: 'How We Use Your Information',
    content: (
      <div className="space-y-3">
        <p>We use the information we collect to:</p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Provide and operate the scheduling service, including creating and managing booking links and calendar events.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Send booking confirmations and automated reminders via email, SMS, or WhatsApp as configured by you.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Detect calendar conflicts and prevent double-bookings by checking your connected calendar's availability.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Process payments and manage your subscription plan.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Respond to support requests and communicate service updates.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Improve the Service through aggregated, anonymized usage analysis. We do not sell your personal data.</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: MessageSquare,
    title: 'SMS Notifications',
    content: (
      <div className="space-y-3">
        <p>{SMS_PRIVACY_DISCLOSURE}</p>
        <p>{SMS_OPTIONAL_POLICY_SENTENCE}</p>
        <p>
          For more detail on our SMS program, including example messages and opt-in instructions, see our{' '}
          <Link to="/sms-consent" className="text-brand-600 dark:text-brand-400 hover:underline">SMS Consent page</Link>.
        </p>
      </div>
    ),
  },
  {
    icon: ExternalLink,
    title: 'Google User Data — Access, Use, Storage & Sharing',
    content: (
      <div className="space-y-4">
        <p>
          PinOnIt integrates with Google services when you explicitly choose to connect them. This section fully discloses how we access, use, store, and share data obtained through Google APIs, in compliance with the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline">Google API Services User Data Policy</a>,
          including the Limited Use requirements.
        </p>

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Google API scopes we request and why:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="text-left p-2 font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Scope</th>
                  <th className="text-left p-2 font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { scope: 'userinfo.email / userinfo.profile', purpose: 'Sign in with Google — identifies your account and pre-fills your display name.' },
                  { scope: 'calendar.readonly', purpose: 'Read calendar events to check availability and prevent double-bookings.' },
                  { scope: 'calendar.events', purpose: 'Create and update meeting events in your calendar when a booking is confirmed or cancelled.' },
                  { scope: 'contacts.readonly', purpose: 'Import your Google Contacts into PinOnIt so you can quickly add attendees (only when you initiate a sync).' },
                  { scope: 'gmail.readonly (email address only)', purpose: 'Retrieve your Gmail address to link your Gmail account to your PinOnIt profile for contact sync. We do not read email message content.' },
                ].map((row) => (
                  <tr key={row.scope} className="even:bg-slate-50 dark:even:bg-slate-900/50">
                    <td className="p-2 font-mono text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 align-top">{row.scope}</td>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 align-top">{row.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">How we use Google data:</p>
          <ul className="space-y-2 pl-4">
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Calendar data is used exclusively to display your availability and write confirmed bookings to your calendar.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Contact data is used only to populate your Contacts list inside PinOnIt when you explicitly trigger a sync.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Your Google account email and name are used to identify your PinOnIt account.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Google data is <strong>never</strong> used for advertising, marketing profiling, or any purpose unrelated to providing scheduling functionality to you.</span></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">How we store Google data:</p>
          <ul className="space-y-2 pl-4">
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>OAuth access and refresh tokens are stored encrypted in our database (Supabase / AWS). Tokens are never logged or exposed in plaintext.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Calendar event metadata (titles, times, attendees) is stored only as needed to display your schedule and is deleted when you disconnect the integration or delete your account.</span></li>
            <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Imported contacts are stored in your PinOnIt contacts list and are deleted with your account.</span></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">How we share Google data:</p>
          <ul className="space-y-2 pl-4">
            <li className="flex gap-2"><span className="text-indigo-500 font-bold shrink-0">·</span><span>We do <strong>not</strong> sell, rent, or share your Google user data with third parties.</span></li>
            <li className="flex gap-2"><span className="text-indigo-500 font-bold shrink-0">·</span><span>We do <strong>not</strong> transfer Google user data to other apps or services.</span></li>
            <li className="flex gap-2"><span className="text-indigo-500 font-bold shrink-0">·</span><span>We do <strong>not</strong> allow humans to read your calendar or contact data except to resolve a support issue you have reported and only with your explicit permission.</span></li>
            <li className="flex gap-2"><span className="text-indigo-500 font-bold shrink-0">·</span><span>Our infrastructure sub-processor (Supabase/AWS) stores encrypted tokens under our data processing agreement; they have no independent access to your Google data.</span></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Revoking Google access:</p>
          <p>
            You can disconnect Google integrations at any time from <strong>Settings → Integrations</strong> inside PinOnIt. You may also revoke access directly at{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline">myaccount.google.com/permissions</a>.
            Revoking access immediately prevents further calendar reads or writes. Any tokens we hold are invalidated and deleted within 30 days.
          </p>
        </div>

        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
          <p className="font-semibold text-indigo-800 dark:text-indigo-200 mb-1">Limited Use Compliance Statement</p>
          <p className="text-indigo-700 dark:text-indigo-300">
            PinOnIt's use and transfer of information received from Google APIs to any other app adheres to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google API Services User Data Policy</a>,
            including the Limited Use requirements. We use Google user data only to provide or improve user-facing features that are prominent in PinOnIt's user interface. We do not use Google data to serve advertisements, for purposes unrelated to our scheduling service, or to build user profiles for any purpose other than delivering PinOnIt's core functionality.
          </p>
        </div>
      </div>
    ),
  },
  {
    icon: Share2,
    title: 'Third-Party Services',
    content: (
      <div className="space-y-3">
        <p>We use the following third-party services to operate the platform. Each has its own privacy policy governing their data practices:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {[
            { name: 'Stripe', role: 'Payment processing', url: 'https://stripe.com/privacy' },
            { name: 'Google', role: 'Calendar & authentication', url: 'https://policies.google.com/privacy' },
            { name: 'Microsoft', role: 'Outlook calendar & auth', url: 'https://privacy.microsoft.com' },
            { name: 'Twilio', role: 'SMS reminders', url: 'https://www.twilio.com/en-us/legal/privacy' },
            { name: 'WhatsApp / Meta', role: 'WhatsApp reminders', url: 'https://www.whatsapp.com/legal/privacy-policy' },
            { name: 'Supabase', role: 'Database & infrastructure', url: 'https://supabase.com/privacy' },
          ].map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-300 dark:hover:border-brand-700 transition-colors group"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{s.role}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-brand-500 transition-colors shrink-0" />
            </a>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Clock,
    title: 'Data Retention & Deletion',
    content: (
      <p>
        We retain your data for as long as your account is active or as needed to provide the Service. You may delete your account and all associated data at any time from your account settings or by contacting us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline">{SUPPORT_EMAIL}</a>.
        Upon deletion, your personal data, booking history, and calendar connections will be permanently removed within 30 days, except where retention is required by law.
        Disconnecting a calendar integration immediately revokes our access to that calendar's data.
      </p>
    ),
  },
  {
    icon: Shield,
    title: 'Changes to This Policy',
    content: (
      <p>
        We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page. For material changes, we will notify you by email or through a notice within the Service. Continued use of the Service after changes take effect constitutes your acceptance of the updated policy.
      </p>
    ),
  },
  {
    icon: Globe,
    title: 'GDPR & International Users',
    content: (
      <div className="space-y-3">
        <p>
          If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, the General Data Protection Regulation (GDPR) or equivalent laws may apply to our processing of your personal data.
        </p>
        <p><strong>Legal bases for processing:</strong></p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Contract performance</strong> — processing necessary to provide the scheduling service you signed up for.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Legitimate interests</strong> — security, fraud prevention, and product improvement through aggregated analytics.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Consent</strong> — when you explicitly opt in to marketing communications or optional integrations.</span></li>
        </ul>
        <p><strong>Your GDPR rights:</strong> You have the right to access, rectify, erase, restrict, or port your personal data, and to object to certain processing. To exercise any of these rights, contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline">{SUPPORT_EMAIL}</a>. We will respond within 30 days. You also have the right to lodge a complaint with your local supervisory authority.</p>
        <p>Personal data is stored in the United States. When transferred from the EEA, we rely on Standard Contractual Clauses (SCCs) or other lawful transfer mechanisms to ensure adequate protection.</p>
      </div>
    ),
  },
  {
    icon: User,
    title: 'CCPA — California Residents',
    content: (
      <div className="space-y-3">
        <p>
          If you are a California resident, the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA) grant you additional rights regarding your personal information.
        </p>
        <p><strong>Your California rights:</strong></p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Right to Know</strong> — you may request details about the categories and specific pieces of personal information we have collected about you.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Right to Delete</strong> — you may request deletion of your personal information, subject to certain exceptions.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Right to Opt-Out of Sale</strong> — we do <strong>not</strong> sell your personal information to third parties.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Right to Non-Discrimination</strong> — we will not discriminate against you for exercising any CCPA rights.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Right to Correct</strong> — you may request correction of inaccurate personal information we hold about you.</span></li>
        </ul>
        <p>To submit a verifiable consumer request, email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline">{SUPPORT_EMAIL}</a> with "CCPA Request" in the subject line. We will verify your identity before responding.</p>
      </div>
    ),
  },
  {
    icon: Cookie,
    title: 'Cookies & Tracking',
    content: (
      <div className="space-y-3">
        <p>We use cookies and similar tracking technologies to operate and improve the Service.</p>
        <p><strong>Types of cookies we use:</strong></p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Strictly necessary</strong> — session cookies required to keep you logged in and operate core functionality. These cannot be disabled.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Preference</strong> — cookies that remember your settings such as dark/light mode and language preferences.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Analytics</strong> — aggregated, anonymized data used to understand how the Service is used and identify areas for improvement. We do not use advertising or cross-site tracking cookies.</span></li>
        </ul>
        <p>Most browsers allow you to control cookies through their settings. Disabling strictly necessary cookies may prevent parts of the Service from functioning correctly.</p>
      </div>
    ),
  },
  {
    icon: Server,
    title: 'Sub-Processors',
    content: (
      <div className="space-y-3">
        <p>
          We engage the following sub-processors (third-party companies that process personal data on our behalf) to help deliver the Service. All sub-processors are bound by data processing agreements that require them to protect your data in accordance with applicable law.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {[
            { name: 'Supabase', role: 'Database, auth & infrastructure', location: 'USA (AWS)' },
            { name: 'Stripe', role: 'Payment processing', location: 'USA' },
            { name: 'Twilio', role: 'SMS delivery', location: 'USA' },
            { name: 'Google', role: 'Calendar integration & OAuth', location: 'USA' },
            { name: 'Microsoft Azure', role: 'Outlook calendar & OAuth', location: 'USA / EU' },
            { name: 'Zoom', role: 'Video conferencing links', location: 'USA' },
          ].map((sp) => (
            <div key={sp.name} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{sp.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{sp.role}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sp.location}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">We will update this list when we add or remove sub-processors. You may opt out of non-essential integrations at any time from your account settings.</p>
      </div>
    ),
  },
  {
    icon: Lock,
    title: 'Data Security',
    content: (
      <div className="space-y-3">
        <p>
          We implement a comprehensive set of technical and organizational measures to protect your personal information:
        </p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Encryption in transit</strong> — all data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Encryption at rest</strong> — stored data is encrypted at rest using AES-256 through our infrastructure provider.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Access controls</strong> — strict role-based access controls and Row Level Security (RLS) policies ensure users can only access their own data.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>OAuth tokens</strong> — third-party calendar and integration credentials are stored encrypted and are never exposed in plaintext.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Incident response</strong> — in the event of a data breach that is likely to result in a risk to your rights and freedoms, we will notify you and relevant authorities within 72 hours of becoming aware of the breach, as required by applicable law.</span></li>
        </ul>
        <p>Despite these measures, no internet transmission or electronic storage is completely secure. We cannot guarantee absolute security and disclaim liability for unauthorized access resulting from circumstances beyond our reasonable control.</p>
      </div>
    ),
  },
  {
    icon: Shield,
    title: "Children's Privacy",
    content: (
      <p>
        The Service is not directed to individuals under the age of 13, or under the age of 16 for users in the EEA. We do not knowingly collect personal information from children under these ages. If you are a parent or guardian and believe your child has provided us with personal information without your consent, please contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline">{SUPPORT_EMAIL}</a> and we will delete it promptly.
      </p>
    ),
  },
  {
    icon: Mail,
    title: 'Contact for Privacy Requests',
    content: (
      <div className="space-y-3">
        <p>
          For any privacy-related questions, data subject requests (access, deletion, correction, portability), or to report a potential data breach, please contact our privacy team:
        </p>
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Miami Expeditions LLC (DBA PinOnIt) — Privacy Team</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Email: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline font-medium">{SUPPORT_EMAIL}</a></p>
          <p className="text-sm text-slate-500 dark:text-slate-500">Subject line: "Privacy Request — [Type of Request]"</p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-500">We aim to respond to all legitimate privacy requests within 30 days. For complex requests we may extend this period by an additional 60 days with notice.</p>
      </div>
    ),
  },
];

export function PrivacyPage() {
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
              <Shield className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Privacy Policy
            </h1>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">Last updated: July 7, 2026</p>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
            PinOnIt is a DBA (Doing Business As) of Miami Expeditions LLC. This website and the PinOnIt appointment scheduling platform are owned and operated by Miami Expeditions LLC.
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
