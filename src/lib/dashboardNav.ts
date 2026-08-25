import {
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  Clock,
  FileText,
  LayoutGrid,
  Mail,
  QrCode,
  Settings,
  Share2,
  ShoppingBag,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { RevealedToolId, UiMode } from './progressiveDisclosure';

export type MoreToolsNavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  toolId?: RevealedToolId;
  /** Extra exact paths that count as this item being active. */
  activePaths?: string[];
  /** Path prefixes that count as this item being active (e.g. nested routes). */
  activePathPrefixes?: string[];
};

export type DashboardNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: string;
  children?: DashboardNavItem[];
};

/** Simple-mode top of sidebar. Everything else sits in More Tools until revealed. */
export const SIMPLE_PRIMARY_NAV: MoreToolsNavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, path: '/dashboard' },
  { label: 'Calendar', icon: CalendarCheck, path: '/dashboard/appointments' },
  { label: 'Availability', icon: Clock, path: '/dashboard/settings?tab=availability' },
  { label: 'Reminders', icon: Bell, path: '/dashboard/settings?tab=reminders' },
  { label: 'Share', icon: Share2, path: '/dashboard#share' },
];

/** Tools that can be permanently surfaced after a trigger. */
export const REVEALABLE_NAV: MoreToolsNavItem[] = [
  { label: 'Paid Booking', icon: ShoppingBag, path: '/dashboard/paid-booking', toolId: 'paid-booking' },
  { label: 'Quote/Invoice', icon: FileText, path: '/dashboard/quotes', toolId: 'quotes' },
  {
    label: 'Group Scheduling',
    icon: Users,
    path: '/dashboard/group-scheduling',
    toolId: 'group-scheduling',
    activePathPrefixes: ['/dashboard/group-scheduling'],
    activePaths: ['/dashboard/coordinate'],
  },
  { label: 'Analytics', icon: BarChart3, path: '/dashboard/settings?tab=analytics', toolId: 'analytics' },
];

/** Single source of truth for sidebar More Tools — add items here. */
export const MORE_TOOLS_NAV: MoreToolsNavItem[] = [
  {
    label: 'Group Scheduling',
    icon: Users,
    path: '/dashboard/group-scheduling',
    toolId: 'group-scheduling',
    activePathPrefixes: ['/dashboard/group-scheduling'],
    activePaths: ['/dashboard/coordinate'],
  },
  { label: 'Quote/Invoice', icon: FileText, path: '/dashboard/quotes', toolId: 'quotes' },
  { label: 'Paid Booking', icon: ShoppingBag, path: '/dashboard/paid-booking', toolId: 'paid-booking' },
  {
    label: 'QR Code Creator',
    icon: QrCode,
    path: '/dashboard/qr-code',
    activePaths: ['/dashboard/qr'],
  },
  { label: 'Email Signature', icon: Mail, path: '/dashboard/signature' },
  { label: 'Event types', icon: CalendarDays, path: '/dashboard/services' },
  { label: 'Contacts', icon: Users, path: '/dashboard/contacts' },
  { label: 'Analytics', icon: BarChart3, path: '/dashboard/settings?tab=analytics', toolId: 'analytics' },
  { label: 'Settings', icon: Settings, path: '/dashboard/settings' },
];

export const MORE_TOOLS_HUB_PATH = '/dashboard/more-tools';
export const MORE_TOOLS_OPEN_KEY = 'pinonit_more_tools_open';

export function isMoreToolsNavActive(item: MoreToolsNavItem, pathname: string, search = '', hash = ''): boolean {
  if (navPathMatches(item.path, pathname, search, hash)) return true;
  if (item.activePaths?.includes(pathname)) return true;
  if (item.activePathPrefixes?.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}

export function navPathMatches(to: string, pathname: string, search = '', hash = ''): boolean {
  const [withoutHash, itemHash] = to.split('#');
  const [path, query] = withoutHash.split('?');
  if (pathname !== path) return false;
  if (query && !search.includes(query)) return false;
  if (itemHash) return hash === `#${itemHash}`;
  if (path === '/dashboard' && hash === '#share' && !query) return false;
  if (path === '/dashboard/settings' && !query && /tab=(availability|reminders|analytics)/.test(search)) {
    return false;
  }
  return true;
}

export function isMoreToolsChildActive(pathname: string, search = '', hash = ''): boolean {
  return MORE_TOOLS_NAV.some((item) => isMoreToolsNavActive(item, pathname, search, hash));
}

function toDashboardItem(item: MoreToolsNavItem): DashboardNavItem {
  return { to: item.path, icon: item.icon, label: item.label, badge: item.badge };
}

export function buildSidebarNav(
  uiMode: UiMode,
  revealed: RevealedToolId[],
): { primary: DashboardNavItem[]; moreTools: MoreToolsNavItem[] } {
  const revealedSet = new Set(revealed);
  const primary = SIMPLE_PRIMARY_NAV.map(toDashboardItem);
  const surfaced = REVEALABLE_NAV.filter((item) => item.toolId && revealedSet.has(item.toolId));
  if (uiMode === 'advanced') {
    const rest = MORE_TOOLS_NAV.filter(
      (item) => !SIMPLE_PRIMARY_NAV.some((p) => p.path === item.path),
    );
    return { primary: [...primary, ...rest.map(toDashboardItem)], moreTools: [] };
  }
  const moreTools = MORE_TOOLS_NAV.filter((item) => {
    if (SIMPLE_PRIMARY_NAV.some((p) => p.path === item.path)) return false;
    if (item.toolId && revealedSet.has(item.toolId)) return false;
    return true;
  });
  return {
    primary: [...primary, ...surfaced.map(toDashboardItem)],
    moreTools,
  };
}

export function readMoreToolsOpen(): boolean {
  try {
    const stored = localStorage.getItem(MORE_TOOLS_OPEN_KEY);
    if (stored === '0') return false;
    if (stored === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function writeMoreToolsOpen(open: boolean): void {
  try {
    localStorage.setItem(MORE_TOOLS_OPEN_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}
