import {
  Bell,
  CalendarCheck,
  ClipboardSignature,
  LayoutGrid,
  Mail,
  QrCode,
  Settings,
  Shield,
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

/** Simple-mode top of sidebar. Everything else stays under More Tools / Settings. */
export const SIMPLE_PRIMARY_NAV: MoreToolsNavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, path: '/dashboard' },
  { label: 'Calendar', icon: CalendarCheck, path: '/dashboard/appointments' },
  { label: 'Smart Reminders', icon: Bell, path: '/dashboard/reminders' },
];

/** Always-visible shortcuts, inserted above More Tools. */
export const FEATURED_NAV: MoreToolsNavItem[] = [
  {
    label: 'Send SMS NDA/Waiver',
    icon: Shield,
    path: '/dashboard/documents/new',
  },
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
  {
    label: 'Doc Center',
    icon: ClipboardSignature,
    path: '/dashboard/documents',
    toolId: 'quotes',
    activePaths: ['/dashboard/quotes'],
  },
  { label: 'Paid Booking', icon: ShoppingBag, path: '/dashboard/paid-booking', toolId: 'paid-booking' },
  {
    label: 'QR Code Creator',
    icon: QrCode,
    path: '/dashboard/qr-code',
    activePaths: ['/dashboard/qr'],
  },
  { label: 'Email Signature', icon: Mail, path: '/dashboard/signature' },
  { label: 'Settings', icon: Settings, path: '/dashboard/settings' },
];

/** Tools that can be permanently surfaced after a trigger — derived from MORE_TOOLS_NAV. */
export const REVEALABLE_NAV: MoreToolsNavItem[] = MORE_TOOLS_NAV.filter((item) => item.toolId);

export const MORE_TOOLS_HUB_PATH = '/dashboard/more-tools';

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
  return true;
}

export function isMoreToolsChildActive(pathname: string, search = '', hash = ''): boolean {
  return MORE_TOOLS_NAV.some((item) => isMoreToolsNavActive(item, pathname, search, hash));
}

/** Hub page or any More Tools child — keeps the sidebar group expanded. */
export function isMoreToolsSectionActive(pathname: string, search = '', hash = ''): boolean {
  if (pathname === MORE_TOOLS_HUB_PATH || pathname.startsWith(`${MORE_TOOLS_HUB_PATH}/`)) return true;
  return isMoreToolsChildActive(pathname, search, hash);
}

function toDashboardItem(item: MoreToolsNavItem): DashboardNavItem {
  return { to: item.path, icon: item.icon, label: item.label, badge: item.badge };
}

export function buildSidebarNav(
  uiMode: UiMode,
): { primary: DashboardNavItem[]; moreTools: MoreToolsNavItem[] } {
  const primary = [...SIMPLE_PRIMARY_NAV, ...FEATURED_NAV].map(toDashboardItem);
  const extras = MORE_TOOLS_NAV.filter(
    (item) => !SIMPLE_PRIMARY_NAV.some((p) => p.path === item.path) && !FEATURED_NAV.some((p) => p.path === item.path),
  );
  if (uiMode === 'advanced') {
    return { primary: [...primary, ...extras.map(toDashboardItem)], moreTools: [] };
  }
  return { primary, moreTools: extras };
}
