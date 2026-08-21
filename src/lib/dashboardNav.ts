import {
  CalendarDays,
  FileText,
  Mail,
  QrCode,
  ShoppingBag,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type MoreToolsNavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  /** Extra exact paths that count as this item being active. */
  activePaths?: string[];
  /** Path prefixes that count as this item being active (e.g. nested routes). */
  activePathPrefixes?: string[];
};

/** Single source of truth for sidebar More Tools — add items here. */
export const MORE_TOOLS_NAV: MoreToolsNavItem[] = [
  {
    label: 'Group Scheduling',
    icon: Users,
    path: '/dashboard/group-scheduling',
    activePathPrefixes: ['/dashboard/group-scheduling'],
    activePaths: ['/dashboard/coordinate'],
  },
  { label: 'Quote/Invoice', icon: FileText, path: '/dashboard/quotes' },
  { label: 'Paid Booking', icon: ShoppingBag, path: '/dashboard/paid-booking' },
  {
    label: 'QR Code Creator',
    icon: QrCode,
    path: '/dashboard/qr-code',
    activePaths: ['/dashboard/qr'],
  },
  { label: 'Email Signature', icon: Mail, path: '/dashboard/signature' },
  { label: 'Event types', icon: CalendarDays, path: '/dashboard/services' },
];

export const MORE_TOOLS_HUB_PATH = '/dashboard/more-tools';
export const MORE_TOOLS_OPEN_KEY = 'pinonit_more_tools_open';

export function isMoreToolsNavActive(item: MoreToolsNavItem, pathname: string): boolean {
  if (pathname === item.path) return true;
  if (item.activePaths?.includes(pathname)) return true;
  if (item.activePathPrefixes?.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}

export function isMoreToolsChildActive(pathname: string): boolean {
  return MORE_TOOLS_NAV.some((item) => isMoreToolsNavActive(item, pathname));
}

export function readMoreToolsOpen(): boolean {
  try {
    const stored = localStorage.getItem(MORE_TOOLS_OPEN_KEY);
    if (stored === '0') return false;
    if (stored === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function writeMoreToolsOpen(open: boolean): void {
  try {
    localStorage.setItem(MORE_TOOLS_OPEN_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}
