import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GUEST_NOINDEX_ROBOTS, isGuestNoIndexPath } from '../lib/guestNoIndex';

const INDEXABLE = 'index, follow';

function setRobots(content: string) {
  let el = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Guest token pages share index.html (index, follow). Flip the meta after hydrate. */
export function GuestNoIndex() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (!isGuestNoIndexPath(pathname)) return;
    setRobots(GUEST_NOINDEX_ROBOTS);
    return () => setRobots(INDEXABLE);
  }, [pathname]);
  return null;
}
