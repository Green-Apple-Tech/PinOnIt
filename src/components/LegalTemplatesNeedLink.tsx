import { Link } from 'react-router-dom';

/** Muted pointer to the one maintainable third-party template page. */
export function LegalTemplatesNeedLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/legal-templates"
      className={`text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:underline ${className}`}
    >
      Need a state-specific version?
    </Link>
  );
}
