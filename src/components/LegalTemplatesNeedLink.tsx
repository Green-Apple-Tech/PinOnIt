import { Link } from 'react-router-dom';

/** Muted pointer to the one maintainable third-party template page. */
export function LegalTemplatesNeedLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/legal-templates"
      className={`text-[11px] text-black dark:text-white hover:underline ${className}`}
    >
      Need a state-specific version?
    </Link>
  );
}
