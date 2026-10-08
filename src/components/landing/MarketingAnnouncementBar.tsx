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

const SEEN_KEY = 'pinonit_switch_announce_seen_v1';
const VISIT_KEY = 'pinonit_switch_announce_visit';

function sessionGet(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* blocked iframe */
  }
}

/** First visit only. Stays up while they click around that visit, then stays hidden. */
function shouldShowAnnouncement() {
  const seen = storageGet(SEEN_KEY) === '1' || storageGet(MARKETING_ANNOUNCEMENT_STORAGE_KEY) === '1';
  const thisVisit = sessionGet(VISIT_KEY) === '1';
  if (seen && !thisVisit) return false;
  storageSet(SEEN_KEY, '1');
  sessionSet(VISIT_KEY, '1');
  return true;
}

/** Slim switcher bar for Calendly and DocuSign. Marketing pages only. */
export function MarketingAnnouncementBar() {
  const [hidden, setHidden] = useState(() => !shouldShowAnnouncement());

  if (hidden) return null;

  const dismiss = () => {
    storageSet(SEEN_KEY, '1');
    storageSet(MARKETING_ANNOUNCEMENT_STORAGE_KEY, '1');
    try {
      sessionStorage.removeItem(VISIT_KEY);
    } catch {
      /* ignore */
    }
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
