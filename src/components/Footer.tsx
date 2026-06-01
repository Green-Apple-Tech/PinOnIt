import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-6 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-slate-400 dark:text-slate-500">
        <Link to="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          Terms of Service
        </Link>
        <span className="hidden sm:inline">|</span>
        <Link to="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          Privacy Policy
        </Link>
        <span className="hidden sm:inline">|</span>
        <Link to="/acceptable-use" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          Acceptable Use Policy
        </Link>
        <span className="hidden sm:inline">|</span>
        <span>&copy; 2026 Pin on It. All rights reserved.</span>
      </div>
    </footer>
  );
}
