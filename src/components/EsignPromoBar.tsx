import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const BAR_CLASS =
  'flex items-center justify-center gap-2 px-4 py-2 text-white text-center transition-colors hover:brightness-110';
const BAR_STYLE = { backgroundColor: '#5864C6' };

function PromoCopy() {
  return (
    <>
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden="true" />
      <span className="text-sm font-medium leading-snug">
        <strong className="font-bold">eSignature via Text</strong>
        <span className="hidden sm:inline"> — get something signed in seconds!</span>
        <span className="sm:hidden"> — signed in seconds</span>
      </span>
    </>
  );
}

/** Top promo for Sign-by-Text. Use a hash for the public landing, a route for the app. */
export function EsignPromoBar({ to }: { to: string }) {
  const label = 'eSignature via Text. Get something signed in seconds.';
  if (to.startsWith('#')) {
    return (
      <a href={to} aria-label={label} className={BAR_CLASS} style={BAR_STYLE}>
        <PromoCopy />
      </a>
    );
  }
  return (
    <Link to={to} aria-label={label} className={BAR_CLASS} style={BAR_STYLE}>
      <PromoCopy />
    </Link>
  );
}
