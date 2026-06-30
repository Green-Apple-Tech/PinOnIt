import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle, XCircle, Shield, Users, Lock, AlertTriangle, Globe, Scale, Mail } from 'lucide-react';
import { Footer } from '../components/Footer';
import { SUPPORT_EMAIL } from '../lib/contactEmail';

interface Section {
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    icon: BookOpen,
    title: 'Purpose of This Policy',
    content: (
      <p>
        This Acceptable Use Policy ("<strong>AUP</strong>") governs how you may use PinOnIt and any related services (collectively, the "<strong>Service</strong>") operated by PinOnIt, Inc. It supplements our{' '}
        <Link to="/terms" className="text-brand-600 dark:text-brand-400 hover:underline">Terms of Service</Link>{' '}
        and{' '}
        <Link to="/privacy" className="text-brand-600 dark:text-brand-400 hover:underline">Privacy Policy</Link>.
        By using the Service you agree to comply with this AUP. Violation of this policy may result in immediate suspension or termination of your account without notice or refund.
      </p>
    ),
  },
  {
    icon: CheckCircle,
    title: 'Permitted Uses',
    content: (
      <div className="space-y-3">
        <p>You may use the Service to:</p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Create and share scheduling links for legitimate professional or personal meetings.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Send automated booking confirmations and reminders to individuals who have consented to receive them by booking through your scheduling link.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Integrate with third-party calendar and video conferencing services you are authorized to use.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Access and use features consistent with the subscription plan you have purchased.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Build lawful businesses or professional practices that rely on appointment scheduling.</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: XCircle,
    title: 'Prohibited Activities',
    content: (
      <div className="space-y-3">
        <p>You may <strong>not</strong> use the Service to:</p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Send unsolicited commercial messages, spam, or bulk communications to individuals who have not opted in.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Harass, threaten, intimidate, or abuse any person through the Service's messaging or reminder features.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Collect, store, or process personal data of minors under the age of 13 (or 16 in the EEA) through the Service.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Impersonate any person or entity, or falsely claim an affiliation with any person or organization.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Attempt to gain unauthorized access to other users' accounts, data, or systems.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Use the Service to facilitate illegal activities, including fraud, money laundering, or the sale of prohibited goods or services.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Reverse engineer, decompile, or attempt to extract source code from the Service.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Scrape, crawl, or systematically extract data from the Service without express written permission.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Introduce malware, viruses, or other harmful code into the Service or its infrastructure.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Circumvent or disable any security, rate limiting, or access control features of the Service.</span></li>
          <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">·</span><span>Resell, sublicense, or white-label access to the Service without a separate written agreement with PinOnIt, Inc.</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: Users,
    title: 'Guest and Contact Data',
    content: (
      <div className="space-y-3">
        <p>
          When guests book meetings through your scheduling link, they provide their name, email address, and other details. As the account holder, you are responsible for ensuring:
        </p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>You have a lawful basis for collecting and using guest data under applicable privacy laws.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Your booking pages accurately describe how guest data will be used (e.g., through a visible privacy notice or link).</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>You do not use guest data for purposes unrelated to the meeting they booked — for example, adding them to unrelated marketing lists without separate consent.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>You honor any guest requests to delete or correct their information promptly.</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: Lock,
    title: 'Account Security',
    content: (
      <div className="space-y-3">
        <p>You are responsible for maintaining the security of your account. Specifically, you must:</p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Use a strong, unique password and not share your credentials with others.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Notify us immediately at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline">{SUPPORT_EMAIL}</a> if you suspect unauthorized access to your account.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Not allow third-party applications to access your account unless you have independently verified they are trustworthy.</span></li>
        </ul>
        <p>PinOnIt, Inc. is not liable for any loss or damage arising from your failure to maintain account security.</p>
      </div>
    ),
  },
  {
    icon: Globe,
    title: 'Compliance with Laws',
    content: (
      <div className="space-y-3">
        <p>
          You are solely responsible for ensuring your use of the Service complies with all laws, regulations, and third-party rights applicable to you, including but not limited to:
        </p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Anti-spam laws</strong> — CAN-SPAM Act (USA), CASL (Canada), and equivalent regulations governing commercial electronic communications.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Privacy laws</strong> — GDPR (EEA/UK), CCPA (California), and any other applicable data protection legislation in your jurisdiction.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Telecommunications regulations</strong> — TCPA (USA) and equivalent rules governing SMS and automated communications.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span><strong>Professional licensing</strong> — any regulatory requirements applicable to your industry or profession (e.g., healthcare, legal, financial services).</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: AlertTriangle,
    title: 'Reporting Violations',
    content: (
      <p>
        If you become aware of any use of the Service that violates this AUP, please report it to us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline">{SUPPORT_EMAIL}</a>{' '}
        with the subject line "AUP Violation Report." We investigate all credible reports and will take appropriate action, which may include disabling the offending account. We will not disclose the identity of the reporter without your consent.
      </p>
    ),
  },
  {
    icon: Shield,
    title: 'Enforcement & Consequences',
    content: (
      <div className="space-y-3">
        <p>We reserve the right to investigate any potential violation of this AUP. Upon determining that a violation has occurred, we may take one or more of the following actions at our sole discretion:</p>
        <ul className="space-y-2 pl-4">
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Issue a written warning to your account email address.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Temporarily suspend your account pending investigation.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Permanently terminate your account without notice or refund.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Remove or disable access to content or features that violate this policy.</span></li>
          <li className="flex gap-2"><span className="text-brand-500 font-bold shrink-0">·</span><span>Report violations to relevant law enforcement or regulatory authorities where required by law.</span></li>
        </ul>
        <p>Serious violations — including illegal activity, fraud, or data breaches — will result in immediate termination without warning.</p>
      </div>
    ),
  },
  {
    icon: Scale,
    title: 'No Warranty for Compliance',
    content: (
      <p>
        PinOnIt, Inc. provides the Service as a tool; we do not provide legal advice. We make no representations or warranties that use of the Service will satisfy your specific legal or regulatory obligations. You should consult qualified legal counsel to ensure your use of the Service is compliant with the laws applicable to you.
      </p>
    ),
  },
  {
    icon: BookOpen,
    title: 'Relationship to Terms of Service',
    content: (
      <p>
        This AUP is incorporated by reference into our{' '}
        <Link to="/terms" className="text-brand-600 dark:text-brand-400 hover:underline">Terms of Service</Link>.
        In the event of any conflict between this AUP and the Terms of Service, the Terms of Service shall control. Capitalized terms used but not defined in this AUP have the meanings assigned to them in the Terms of Service.
      </p>
    ),
  },
  {
    icon: Mail,
    title: 'Contact Us',
    content: (
      <p>
        If you have questions about this Acceptable Use Policy, please contact us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 dark:text-brand-400 hover:underline font-medium">{SUPPORT_EMAIL}</a>.
      </p>
    ),
  },
];

export function AcceptableUsePage() {
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
              <BookOpen className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Acceptable Use Policy
            </h1>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">Last updated: May 28, 2026</p>
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
