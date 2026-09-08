import { supabase } from './supabase';
import { formatPhoneDisplay } from './phone';
import {
  expandImportedContact,
  looksMalformedContact,
} from './normalizeImportedContacts';

export type PickerContact = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  source: string;
};

export type ContactPickerSelection = {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  source: string;
};

/** Split "Jane Smith" → first/last; single token → first only. */
export function splitContactName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function toContactPickerSelection(c: PickerContact): ContactPickerSelection {
  const { firstName, lastName } = splitContactName(c.full_name);
  const phoneRaw = (c.phone ?? '').trim();
  return {
    firstName,
    lastName,
    fullName: (c.full_name ?? '').trim() || [firstName, lastName].filter(Boolean).join(' '),
    email: (c.email ?? '').trim(),
    phone: phoneRaw ? formatPhoneDisplay(phoneRaw) : '',
    source: c.source,
  };
}

export function contactHasPhone(c: Pick<PickerContact, 'phone'>): boolean {
  return Boolean((c.phone ?? '').trim());
}

/** Fields this result will copy onto the compose form. */
export function contactFillPreview(c: PickerContact): Array<'name' | 'phone' | 'email'> {
  const fields: Array<'name' | 'phone' | 'email'> = [];
  if ((c.full_name ?? '').trim()) fields.push('name');
  if (contactHasPhone(c)) fields.push('phone');
  if ((c.email ?? '').trim()) fields.push('email');
  return fields;
}

export function expandPickerContact(c: PickerContact): PickerContact[] {
  if (!looksMalformedContact(c.full_name, c.email)) return [c];
  return expandImportedContact({
    email: c.email,
    full_name: c.full_name,
    phone: c.phone,
    company: c.company,
    source: c.source,
  }).map((row, i) => ({
    id: `${c.id}:${row.email}:${i}`,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone,
    company: row.company,
    source: row.source,
  }));
}

export function rankPickerContacts(rows: PickerContact[]): PickerContact[] {
  return [...rows].sort((a, b) => {
    const ap = contactHasPhone(a) ? 0 : 1;
    const bp = contactHasPhone(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const an = (a.full_name || a.email || '').toLowerCase();
    const bn = (b.full_name || b.email || '').toLowerCase();
    return an.localeCompare(bn);
  });
}

export function contactSourceLabel(source: string): string {
  switch (source) {
    case 'outlook':
      return 'Outlook';
    case 'gmail':
      return 'Gmail';
    case 'booking':
      return 'Booked';
    case 'device':
      return 'Phone';
    case 'manual':
      return 'Saved';
    default:
      return source?.trim() ? source : 'Saved';
  }
}

/**
 * Search the host's people list (manual, bookings, Gmail, Outlook).
 * Empty query returns a browse page of recent/alpha names.
 */
export async function searchHostContacts(
  hostId: string,
  query: string,
  limit = 8,
): Promise<PickerContact[]> {
  const escaped = query.trim().replace(/[%_,]/g, '');
  const fetchLimit = Math.min(Math.max(limit * 6, 40), 200);
  let req = supabase
    .from('contacts')
    .select('id, email, full_name, phone, company, source')
    .eq('host_id', hostId)
    .order('full_name', { ascending: true, nullsFirst: false })
    .limit(fetchLimit);

  if (escaped) {
    req = req.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,company.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await req;
  if (error) {
    console.error('[contactPicker] search failed', error.message);
    return [];
  }
  const expanded = ((data ?? []) as PickerContact[]).flatMap(expandPickerContact);
  return rankPickerContacts(expanded).slice(0, limit);
}

/** @deprecated Use searchHostContacts — includes saved + booked people, not only Gmail/Outlook. */
export async function searchSyncedContacts(
  hostId: string,
  query: string,
  limit = 8,
): Promise<PickerContact[]> {
  return searchHostContacts(hostId, query, limit);
}

type DeviceContactPayload = {
  name?: string[];
  tel?: string[];
  email?: string[];
};

type ContactsPickerNavigator = Navigator & {
  contacts?: {
    select: (
      properties: string[],
      options?: { multiple?: boolean },
    ) => Promise<DeviceContactPayload[]>;
  };
};

/** Android Chrome Contact Picker. iOS Safari does not support it. */
export function canSelectDeviceContacts(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as ContactsPickerNavigator).contacts?.select === 'function';
}

export async function selectDeviceContact(): Promise<ContactPickerSelection | null> {
  const picker = (navigator as ContactsPickerNavigator).contacts;
  if (!picker?.select) return null;
  try {
    const [c] = await picker.select(['name', 'tel', 'email'], { multiple: false });
    if (!c) return null;
    const fullName = (c.name?.[0] ?? '').trim();
    const { firstName, lastName } = splitContactName(fullName);
    const tel = (c.tel?.[0] ?? '').trim();
    return {
      firstName,
      lastName,
      fullName,
      email: (c.email?.[0] ?? '').trim(),
      phone: tel ? formatPhoneDisplay(tel) : '',
      source: 'device',
    };
  } catch {
    return null;
  }
}
