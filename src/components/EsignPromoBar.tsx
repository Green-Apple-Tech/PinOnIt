import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const BAR_CLASS =
  'flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-center transition-colors';

function PromoCopy() {
  return (
    <>
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-200" aria-hidden="true" />
      <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        New
      </span>
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
  const label = 'New: eSignature via Text. Get something signed in seconds.';
  if (to.startsWith('#')) {
    return (
      <a href={to} aria-label={label} className={BAR_CLASS}>
        <PromoCopy />
      </a>
    );
  }
  return (
    <Link to={to} aria-label={label} className={BAR_CLASS}>
      <PromoCopy />
    </Link>
  );
}
