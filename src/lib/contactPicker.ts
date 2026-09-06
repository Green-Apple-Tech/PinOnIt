import { supabase } from './supabase';
import { formatPhoneDisplay } from './phone';

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

/** True when the host has authorized Gmail and/or Outlook contacts sync. */
export async function hostHasSyncedContactSources(hostId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('gmail_connected, gmail_contacts_count, outlook_contacts_connected, outlook_contacts_count')
    .eq('id', hostId)
    .maybeSingle();

  if (!data) return false;
  if (data.gmail_connected || (data.gmail_contacts_count ?? 0) > 0) return true;
  if (data.outlook_contacts_connected || (data.outlook_contacts_count ?? 0) > 0) return true;
  return false;
}

/**
 * Search Gmail/Outlook-imported contacts (unified list).
 * Same email from both providers is one row (upsert on host_id+email).
 */
export async function searchSyncedContacts(
  hostId: string,
  query: string,
  limit = 8,
): Promise<PickerContact[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const escaped = q.replace(/[%_,]/g, '');
  let req = supabase
    .from('contacts')
    .select('id, email, full_name, phone, company, source')
    .eq('host_id', hostId)
    .in('source', ['gmail', 'outlook'])
    .order('full_name', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (escaped) {
    req = req.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,company.ilike.%${escaped}%`);
  }

  const { data, error } = await req;
  if (error) {
    console.error('[contactPicker] search failed', error.message);
    return [];
  }
  return (data ?? []) as PickerContact[];
}
