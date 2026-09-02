import { Link } from 'react-router-dom';

/** Conspicuous notice at trial/checkout — clicking start constitutes agreement. */
export function TrialTermsNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-center break-words px-1 ${className}`}>
      By starting your free trial, you agree to our{' '}
      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
        Terms of Service
      </Link>
      {' '}and{' '}
      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
        Privacy Policy
      </Link>
      . PinOnIt is best-effort — we do not guarantee legal outcomes, delivery, or uninterrupted service.
    </p>
  );
}
