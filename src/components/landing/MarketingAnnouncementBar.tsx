import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import {
  MARKETING_ANNOUNCEMENT_CTA,
  MARKETING_ANNOUNCEMENT_HREF,
  MARKETING_ANNOUNCEMENT_STORAGE_KEY,
  MARKETING_ANNOUNCEMENT_TEXT,
} from '../../lib/marketingLanding';
import { storageGet, storageSet } from '../../lib/safeStorage';

function isDismissed() {
  return storageGet(MARKETING_ANNOUNCEMENT_STORAGE_KEY) === '1';
}

/** Slim Calendly-switcher bar. Marketing pages only. */
export function MarketingAnnouncementBar() {
  const [hidden, setHidden] = useState(isDismissed);

  if (hidden) return null;

  const dismiss = () => {
    storageSet(MARKETING_ANNOUNCEMENT_STORAGE_KEY, '1');
    setHidden(true);
  };

  return (
    <div className="bg-brand-600 text-white">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-center gap-2 sm:gap-3">
        <p className="text-xs sm:text-sm font-medium leading-snug text-center">
          {MARKETING_ANNOUNCEMENT_TEXT}{' '}
          <Link
            to={MARKETING_ANNOUNCEMENT_HREF}
            className="underline underline-offset-2 font-semibold hover:text-brand-50"
          >
            {MARKETING_ANNOUNCEMENT_CTA}
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10"
          aria-label="Dismiss announcement"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MarketingStickyHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-50">
      <MarketingAnnouncementBar />
      {children}
    </header>
  );
}
