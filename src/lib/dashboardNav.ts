import {
  Bell,
  CalendarCheck,
  ClipboardSignature,
  FileText,
  LayoutGrid,
  Mail,
  QrCode,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { RevealedToolId, UiMode } from './progressiveDisclosure';
import { documentsNewPath } from './documentActions';

export type MoreToolsNavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  toolId?: RevealedToolId;
  activePaths?: string[];
  activePathPrefixes?: string[];
  signByText?: boolean;
};

export type DashboardNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: string;
  children?: DashboardNavItem[];
  signByText?: boolean;
};

/** Primary sidebar — product areas only (Settings is appended after More Tools). */
export const SIMPLE_PRIMARY_NAV: MoreToolsNavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, path: '/dashboard' },
  { label: 'Booking', icon: CalendarCheck, path: '/dashboard/appointments' },
  {
    label: 'Sign-by-Text',
    icon: ClipboardSignature,
    path: documentsNewPath('sign'),
    signByText: true,
  },
  {
    label: 'Send Docs',
    icon: FileText,
    path: documentsNewPath('send'),
  },
  { label: 'NeverMiss Reminders', icon: Bell, path: '/dashboard/reminders' },
];

export const FEATURED_NAV: MoreToolsNavItem[] = [];

export const SETTINGS_NAV_ITEM: MoreToolsNavItem = {
  label: 'Settings',
  icon: Settings,
  path: '/dashboard/settings',
};

/** Secondary tools under More Tools (QR + Signature live here). */
export const MORE_TOOLS_NAV: MoreToolsNavItem[] = [
  {
    label: 'Group Scheduling',
    icon: Users,
    path: '/dashboard/group-scheduling',
    toolId: 'group-scheduling',
    activePathPrefixes: ['/dashboard/group-scheduling'],
    activePaths: ['/dashboard/coordinate'],
  },
  { label: 'Paid Booking', icon: ShoppingBag, path: '/dashboard/paid-booking', toolId: 'paid-booking' },
  {
    label: 'QR Codes',
    icon: QrCode,
    path: '/dashboard/qr-code',
    activePaths: ['/dashboard/qr'],
  },
  { label: 'Signature Creator', icon: Mail, path: '/dashboard/signature' },
];

export const REVEALABLE_NAV: MoreToolsNavItem[] = MORE_TOOLS_NAV.filter((item) => item.toolId);

export const MORE_TOOLS_HUB_PATH = '/dashboard/more-tools';

export function isMoreToolsNavActive(item: MoreToolsNavItem, pathname: string, search = '', hash = ''): boolean {
  if (navPathMatches(item.path, pathname, search, hash)) return true;
  if (item.activePaths?.includes(pathname)) return true;
  if (item.activePathPrefixes?.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}

export function isDashboardNavActive(
  item: { to: string; label: string; signByText?: boolean },
  pathname: string,
  search = '',
  hash = '',
): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const mode = params.get('mode') ?? (params.get('action') === 'sign' || params.get('action') === 'send' ? params.get('action') : null);

  if (item.signByText || item.label === 'Sign-by-Text') {
    if (!pathname.startsWith('/dashboard/documents/new')) return false;
    return mode === 'sign';
  }
  if (item.label === 'Send Docs') {
    if (pathname === '/dashboard/documents') return true;
    if (!pathname.startsWith('/dashboard/documents')) return false;
    return mode !== 'sign';
  }
  return navPathMatches(item.to, pathname, search, hash);
}

export function navPathMatches(to: string, pathname: string, search = '', hash = ''): boolean {
  const [withoutHash, itemHash] = to.split('#');
  const [path, query] = withoutHash.split('?');
  if (pathname !== path) return false;
  if (query) {
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    for (const [k, v] of want.entries()) {
      if (have.get(k) !== v) return false;
    }
  }
  if (itemHash) return hash === `#${itemHash}`;
  if (path === '/dashboard' && hash === '#share' && !query) return false;
  return true;
}

export function isMoreToolsChildActive(pathname: string, search = '', hash = ''): boolean {
  return MORE_TOOLS_NAV.some((item) => isMoreToolsNavActive(item, pathname, search, hash));
}

export function isMoreToolsSectionActive(pathname: string, search = '', hash = ''): boolean {
  if (pathname === MORE_TOOLS_HUB_PATH || pathname.startsWith(`${MORE_TOOLS_HUB_PATH}/`)) return true;
  return isMoreToolsChildActive(pathname, search, hash);
}

function toDashboardItem(item: MoreToolsNavItem): DashboardNavItem {
  return {
    to: item.path,
    icon: item.icon,
    label: item.label,
    badge: item.badge,
    signByText: item.signByText,
  };
}

export function buildSidebarNav(
  uiMode: UiMode,
): { primary: DashboardNavItem[]; moreTools: MoreToolsNavItem[]; settings: DashboardNavItem } {
  const primary = SIMPLE_PRIMARY_NAV.map(toDashboardItem);
  const settings = toDashboardItem(SETTINGS_NAV_ITEM);
  if (uiMode === 'advanced') {
    return {
      primary: [...primary, ...MORE_TOOLS_NAV.map(toDashboardItem)],
      moreTools: [],
      settings,
    };
  }
  return { primary, moreTools: MORE_TOOLS_NAV, settings };
}
