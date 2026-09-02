import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../lib/contactEmail';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-6 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-3 text-center text-xs text-slate-400 dark:text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <Link to="/calendly-alternative" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Calendly alternative
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link to="/why-pinonit" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Why PinOnIt
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link to="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Terms of Service
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link to="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Privacy Policy
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link to="/sms-consent" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            SMS Consent
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link to="/acceptable-use" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Acceptable Use Policy
          </Link>
          <span className="hidden sm:inline">|</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            {SUPPORT_EMAIL}
          </a>
        </div>
        <p>PinOnIt is a DBA of Miami Expeditions LLC.</p>
        <p>&copy; 2026 Miami Expeditions LLC. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
