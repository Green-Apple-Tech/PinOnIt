import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../lib/supabase';
import { PageChecklist } from '../components/PageChecklist';
import type { Booking, Service } from '../lib/types';
import {
  Search,
  Plus,
  X,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Link2,
  Copy,
  FileText,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { PHONE_PLACEHOLDER, normalizePhoneE164 } from '../lib/phone';
import {
  canUseSystemShare,
  isMobileShareClient,
  openEmailComposer as openSharedEmailComposer,
  openSmsComposer as openSharedSmsComposer,
  openWhatsAppComposer as openSharedWhatsAppComposer,
  shareViaSystemSheet,
} from '../lib/bookingShare';

interface Contact {
  id: string;
  host_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

type Filter = 'all' | 'recent' | 'upcoming';

const PAGE_SIZE = 50;

interface EnrichedContact extends Contact {
  meetingCount: number;
  lastMeeting: string | null;
  nextMeeting: string | null;
  nextMeetingService: string | null;
  bookings: (Booking & { services?: Service })[];
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function avatarColor(email: string): string {
  const colors = [
    'bg-blue-500', 'bg-indigo-600', 'bg-violet-500', 'bg-rose-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-teal-500', 'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const inputCls = 'w-full px-3 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition text-base';

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length === 10) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (raw.trimStart().startsWith('+')) return raw;
  return `+${digits}`;
}

export function ContactsPage() {
  const { profile } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allBookings, setAllBookings] = useState<(Booking & { services?: Service })[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [contactsRefreshKey, setContactsRefreshKey] = useState(0);

  const [selected, setSelected] = useState<EnrichedContact | null>(null);

  // Add contact form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Detail view notes
  const [editingNotes, setEditingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Detail view contact edit
  const [editingContact, setEditingContact] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [editError, setEditError] = useState('');

  // Gmail state
  const [gmailBannerDismissed, setGmailBannerDismissed] = useState(() =>
    localStorage.getItem('gmail_banner_dismissed') === '1'
  );
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailContactsCount, setGmailContactsCount] = useState(0);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailError, setGmailError] = useState('');

  // Outlook state
  const [outlookBannerDismissed, setOutlookBannerDismissed] = useState(() =>
    localStorage.getItem('outlook_contacts_banner_dismissed') === '1'
  );
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookContactsCount, setOutlookContactsCount] = useState(0);
  const [outlookConnecting, setOutlookConnecting] = useState(false);
  const [outlookSyncing, setOutlookSyncing] = useState(false);
  const [outlookError, setOutlookError] = useState('');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [copied, setCopied] = useState(false);
  const [openMenu, setOpenMenu] = useState<{ kind: 'email' | 'text'; menuId: string } | null>(null);

  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem('contacts_checklist_dismissed') === 'true',
  );
  const [importCardDismissed, setImportCardDismissed] = useState(
    () => localStorage.getItem('contacts_import_card_dismissed') === '1',
  );

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Handle URL params from OAuth callback
  useEffect(() => {
    let mounted = true;

    const params = new URLSearchParams(window.location.search);
    let cleanUrl = false;

    if (params.get('code') || params.get('state')) {
      cleanUrl = true;
    }

    const calendarError = params.get('calendar_error');
    if (calendarError) {
      cleanUrl = true;
      if (mounted) {
        setGmailError(calendarError);
        setToast({ msg: `Google connection failed: ${calendarError}`, type: 'error' });
      }
    }

    const gmailConnectedParam = params.get('gmail_connected');
    if (gmailConnectedParam === '1') {
      cleanUrl = true;
      const importedParam = params.get('contacts_imported');
      const contactsError = params.get('contacts_error');
      if (mounted) {
        setGmailConnected(true);
        setGmailBannerDismissed(true);
        localStorage.setItem('gmail_banner_dismissed', '1');
        if (contactsError) {
          setGmailError(contactsError);
          setToast({ msg: `Gmail connected, but contacts import failed: ${contactsError}`, type: 'error' });
        } else if (importedParam !== null) {
          const n = parseInt(importedParam, 10);
          setGmailContactsCount(n);
          setToast({
            msg: n > 0 ? `${n} contact${n !== 1 ? 's' : ''} imported from Gmail` : 'Gmail connected — no contacts found to import',
            type: n > 0 ? 'success' : 'error',
          });
        }
      }
    }

    const outlookConnectedParam = params.get('outlook_connected');
    if (outlookConnectedParam === '1') {
      cleanUrl = true;
      const importedParam = params.get('contacts_imported');
      const contactsError = params.get('contacts_error');
      if (mounted) {
        setOutlookBannerDismissed(true);
        localStorage.setItem('outlook_contacts_banner_dismissed', '1');
        if (contactsError === 'contacts_permission_not_granted') {
          setOutlookConnected(false);
          setOutlookError('Outlook connected for calendar but contacts permission was not granted. Please reconnect Outlook to enable contact sync.');
          setToast({ msg: 'Contacts permission not granted. Please reconnect Outlook.', type: 'error' });
        } else if (contactsError) {
          setOutlookConnected(true);
          setOutlookError(contactsError);
          setToast({ msg: `Outlook connected, but contacts import failed: ${contactsError}`, type: 'error' });
        } else if (importedParam !== null) {
          const n = parseInt(importedParam, 10);
          setOutlookConnected(true);
          setOutlookContactsCount(n);
          setToast({
            msg: n > 0 ? `${n} contact${n !== 1 ? 's' : ''} imported from Outlook` : 'Outlook connected — no contacts found to import',
            type: n > 0 ? 'success' : 'error',
          });
        }
      }
    }

    if (cleanUrl && mounted) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => { mounted = false };
  }, []);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('gmail_connected, gmail_contacts_count, outlook_contacts_connected, outlook_contacts_count')
        .eq('id', profile.id)
        .maybeSingle();
      if (profileData?.gmail_connected) {
        setGmailConnected(true);
        setGmailBannerDismissed(true);
      }
      if (profileData?.gmail_contacts_count != null && profileData.gmail_contacts_count > 0) {
        setGmailContactsCount(profileData.gmail_contacts_count);
      }
      if (profileData?.outlook_contacts_connected) {
        setOutlookConnected(true);
        setOutlookBannerDismissed(true);
      }
      if (profileData?.outlook_contacts_count != null && profileData.outlook_contacts_count > 0) {
        setOutlookContactsCount(profileData.outlook_contacts_count);
      }
    })();
  }, [profile?.id]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const bookingsRes = await supabase
        .from('bookings')
        .select('*, services(name, color, duration_minutes)')
        .eq('host_id', profile.id)
        .order('start_time', { ascending: false });

      const fetchedBookings = (bookingsRes.data ?? []) as (Booking & { services?: Service })[];
      setAllBookings(fetchedBookings);

      const { data: existingRows } = await supabase
        .from('contacts')
        .select('email, address, phone, full_name')
        .eq('host_id', profile.id);

      const existingByEmail = new Map(
        (existingRows ?? []).map((c) => [c.email.toLowerCase(), c as { email: string; address: string | null; phone: string | null; full_name: string | null }]),
      );
      const toUpsert: {
        host_id: string;
        email: string;
        full_name: string | null;
        phone: string | null;
        address: string | null;
        source: string;
      }[] = [];
      const seen = new Set<string>();
      for (const b of fetchedBookings) {
        if (!b.guest_email) continue;
        const key = b.guest_email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const existing = existingByEmail.get(key);
        const bookingAddr = (b.guest_address ?? '').trim() || null;
        const bookingPhone = (b.guest_phone ?? '').trim() || null;
        if (!existing) {
          toUpsert.push({
            host_id: profile.id,
            email: b.guest_email,
            full_name: b.guest_name,
            phone: bookingPhone,
            address: bookingAddr,
            source: 'booking',
          });
          continue;
        }
        // Refresh address/phone from newest booking when contact is missing them
        const needAddress = bookingAddr && !existing.address;
        const needPhone = bookingPhone && !existing.phone;
        if (needAddress || needPhone) {
          toUpsert.push({
            host_id: profile.id,
            email: b.guest_email,
            full_name: existing.full_name || b.guest_name,
            phone: existing.phone || bookingPhone,
            address: existing.address || bookingAddr,
            source: 'booking',
          });
        }
      }

      if (toUpsert.length) {
        await supabase
          .from('contacts')
          .upsert(toUpsert, { onConflict: 'host_id,email' });
        setContactsRefreshKey((k) => k + 1);
      }
    })();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      if (page === 0) setLoading(true);

      let query = supabase
        .from('contacts')
        .select('*')
        .eq('host_id', profile.id)
        .order('created_at', { ascending: false });

      const q = debouncedSearch.trim();
      if (q) {
        const escaped = q.replace(/[%_]/g, '\\$&');
        query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,address.ilike.%${escaped}%`);
      }

      const { data, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (cancelled) return;
      if (error) {
        console.error('Failed to load contacts:', error);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as Contact[];
      setContacts((prev) => (page === 0 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, page, debouncedSearch, contactsRefreshKey]);

  const enriched = useMemo((): EnrichedContact[] => {
    const now = new Date();
    return contacts.map((c) => {
      const cBookings = allBookings.filter(
        (b) => b.guest_email && b.guest_email.toLowerCase() === c.email.toLowerCase(),
      );
      const past = cBookings.filter((b) => new Date(b.start_time) < now).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      const future = cBookings.filter((b) => new Date(b.start_time) >= now).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      return {
        ...c,
        meetingCount: cBookings.length,
        lastMeeting: past[0]?.start_time ?? null,
        nextMeeting: future[0]?.start_time ?? null,
        nextMeetingService: (future[0]?.services as Service)?.name ?? null,
        bookings: cBookings.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
      };
    });
  }, [contacts, allBookings]);

  const filtered = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    let list = enriched;
    if (filter === 'recent') list = list.filter((c) => c.lastMeeting && new Date(c.lastMeeting) >= thirtyDaysAgo);
    if (filter === 'upcoming') list = list.filter((c) => c.nextMeeting !== null);
    return list;
  }, [enriched, filter]);

  const gmailContactsImported = useMemo(
    () => contacts.filter((c) => c.source === 'gmail').length,
    [contacts],
  );
  const outlookContactsImported = useMemo(
    () => contacts.filter((c) => c.source === 'outlook').length,
    [contacts],
  );

  /** Import complete if profile says so, or we already have contacts from that provider. */
  const gmailImportComplete = gmailConnected || gmailContactsImported > 0 || gmailContactsCount > 0;
  const outlookImportComplete = outlookConnected || outlookContactsImported > 0 || outlookContactsCount > 0;
  const gmailSyncedCount = Math.max(gmailContactsCount, gmailContactsImported);
  const outlookSyncedCount = Math.max(outlookContactsCount, outlookContactsImported);

  const contactsChecklistItems = useMemo(() => [
    { id: 'booking_link', label: 'Share your booking link', why: 'Contacts are auto-added when someone books with you', done: !!profile?.slug, to: '/dashboard/settings' },
    { id: 'add_contact', label: 'Add your first contact manually', why: 'Great for existing clients before you get bookings', done: contacts.length > 0 },
    { id: 'connect_gmail', label: 'Connect Gmail for in-app emailing', why: 'Send your booking link without leaving PinOnIt', done: gmailImportComplete || gmailBannerDismissed },
  ], [profile?.slug, contacts.length, gmailImportComplete, gmailBannerDismissed]);

  const hasSharedLink = !!profile?.slug;
  const hasAddedContact = contacts.length > 0;
  const allDone = hasSharedLink && hasAddedContact && (gmailImportComplete || gmailBannerDismissed);

  useEffect(() => {
    if (checklistDismissed || !allDone) return;
    const timer = setTimeout(() => {
      localStorage.setItem('contacts_checklist_dismissed', 'true');
      setChecklistDismissed(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [allDone, checklistDismissed]);

  const handleAddContact = async () => {
    if (!profile) return;
    if (!addEmail.trim()) { setAddError('Email is required.'); return; }
    setSaving(true);
    setAddError('');
    const { data, error } = await supabase.from('contacts').upsert({
      host_id: profile.id,
      email: addEmail.trim().toLowerCase(),
      full_name: addName.trim() || null,
      phone: addPhone.trim() || null,
      notes: addNotes.trim() || null,
      source: 'manual',
    }, { onConflict: 'host_id,email' }).select().maybeSingle();
    if (error) { setAddError(error.message); setSaving(false); return; }
    if (data) {
      setContacts((prev) => {
        const exists = prev.find((c) => c.id === (data as Contact).id);
        return exists ? prev.map((c) => c.id === (data as Contact).id ? data as Contact : c) : [data as Contact, ...prev];
      });
    }
    setShowAddForm(false);
    setAddName(''); setAddEmail(''); setAddPhone(''); setAddNotes('');
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    await supabase.from('contacts').update({ notes: editingNotes, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setContacts((prev) => prev.map((c) => c.id === selected.id ? { ...c, notes: editingNotes } : c));
    setSelected((prev) => prev ? { ...prev, notes: editingNotes } : prev);
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const resetContactEditFields = (contact: EnrichedContact) => {
    setEditName(contact.full_name ?? '');
    setEditEmail(contact.email);
    setEditPhone(contact.phone ? formatPhone(contact.phone) : '');
    setEditAddress(contact.address ?? '');
    setEditError('');
  };

  const handleStartEditContact = () => {
    if (!selected) return;
    resetContactEditFields(selected);
    setEditingContact(true);
  };

  const handleCancelEditContact = () => {
    if (selected) resetContactEditFields(selected);
    setEditingContact(false);
    setEditError('');
  };

  const handleSaveContact = async () => {
    if (!selected || !profile) return;
    const email = editEmail.trim().toLowerCase();
    if (!email) {
      setEditError('Email is required.');
      return;
    }
    setSavingContact(true);
    setEditError('');
    const phoneVal = editPhone.trim() ? normalizePhoneE164(editPhone.trim()) : null;
    const { data, error } = await supabase
      .from('contacts')
      .update({
        full_name: editName.trim() || null,
        email,
        phone: phoneVal,
        address: editAddress.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id)
      .eq('host_id', profile.id)
      .select()
      .maybeSingle();

    if (error) {
      setEditError(error.message.includes('duplicate') ? 'A contact with this email already exists.' : error.message);
      setSavingContact(false);
      return;
    }

    if (data) {
      const updated = data as Contact;
      const enrichedUpdated: EnrichedContact = { ...selected, ...updated };
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      setSelected(enrichedUpdated);
      setEditingContact(false);
      showToast('Contact updated', 'success');
    }
    setSavingContact(false);
  };

  const bookingUrl = profile?.slug
    ? `${window.location.origin}/${profile.slug}`
    : `${window.location.origin}/book/${profile?.id}`;

  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildBookingInvite = (contact: Contact) => {
    const firstName = contact.full_name?.split(' ')[0]?.trim() ?? '';
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
    const hostName = profile?.full_name?.trim();
    const lines = [
      greeting,
      '',
      "I'd love to find a time to connect. You can grab a slot on my calendar here:",
      '',
      bookingUrl,
      '',
      'Looking forward to it!',
    ];
    if (hostName) lines.push(hostName);
    return {
      subject: 'Schedule a meeting with me',
      body: lines.join('\n'),
    };
  };

  const buildSmsInvite = (contact: Contact) => {
    const firstName = contact.full_name?.split(' ')[0]?.trim() ?? '';
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
    const hostName = profile?.full_name?.trim();
    const lines = [
      `${greeting} grab a slot on my calendar:`,
      bookingUrl,
      'Looking forward to it!',
    ];
    if (hostName) lines.push(`— ${hostName}`);
    return lines.join('\n');
  };

  const contactSmsNumber = (contact: Contact) => {
    if (!contact.phone?.trim()) return null;
    const e164 = normalizePhoneE164(contact.phone);
    return e164 || null;
  };

  const closeInviteMenus = () => {
    setOpenMenu(null);
  };

  const isInviteMenuOpen = (kind: 'email' | 'text', menuId: string) =>
    openMenu?.kind === kind && openMenu.menuId === menuId;

  const toggleInviteMenu = (kind: 'email' | 'text', menuId: string) => {
    setOpenMenu((prev) => (prev?.kind === kind && prev.menuId === menuId ? null : { kind, menuId }));
  };

  const openSmsComposer = (contact: Contact) => {
    const phone = contactSmsNumber(contact);
    if (!phone) {
      showToast('Add a phone number to send an SMS invite', 'error');
      return;
    }
    openSharedSmsComposer(buildSmsInvite(contact), phone);
    closeInviteMenus();
    showToast('Opened Messages', 'success');
  };

  const openWhatsAppComposer = (contact: Contact) => {
    const phone = contactSmsNumber(contact);
    if (!phone) {
      showToast('Add a phone number to send a WhatsApp invite', 'error');
      return;
    }
    openSharedWhatsAppComposer(buildSmsInvite(contact), phone);
    closeInviteMenus();
    showToast('Opened WhatsApp', 'success');
  };

  const openEmailComposer = (provider: 'gmail' | 'outlook' | 'default', contact: Contact) => {
    const { subject, body } = buildBookingInvite(contact);
    openSharedEmailComposer(provider, subject, body, contact.email);
    closeInviteMenus();
    if (isMobileShareClient() || provider === 'default') {
      showToast('Opened email app', 'success');
    } else {
      showToast(provider === 'gmail' ? 'Opened Gmail compose' : 'Opened Outlook compose', 'success');
    }
  };

  const shareContactInvite = async (contact: Contact) => {
    const { subject, body } = buildBookingInvite(contact);
    const result = await shareViaSystemSheet({ title: subject, text: body });
    closeInviteMenus();
    if (result === 'shared') showToast('Opened share sheet', 'success');
    else if (result === 'unavailable') showToast('Share not available on this device', 'error');
  };

  const copyBookingInvite = async (contact: Contact) => {
    const { subject, body } = buildBookingInvite(contact);
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    closeInviteMenus();
    showToast('Invite message copied', 'success');
  };

  const copySmsInvite = async (contact: Contact) => {
    await navigator.clipboard.writeText(buildSmsInvite(contact));
    closeInviteMenus();
    showToast('SMS message copied', 'success');
  };

  const renderEmailMenu = (contact: Contact) => (
    <div
      className="absolute right-0 top-full mt-2 w-52 z-50 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5"
      role="menu"
    >
      {canUseSystemShare() && (
        <>
          <button
            type="button"
            onClick={() => void shareContactInvite(contact)}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Share via phone…
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-slate-800" />
        </>
      )}
      <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
        Send email with
      </p>
      {isMobileShareClient() ? (
        <button
          type="button"
          onClick={() => openEmailComposer('default', contact)}
          className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          Email app (Mail / Gmail / Outlook)
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => openEmailComposer('gmail', contact)}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Gmail
          </button>
          <button
            type="button"
            onClick={() => openEmailComposer('outlook', contact)}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Outlook
          </button>
          <button
            type="button"
            onClick={() => openEmailComposer('default', contact)}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Default email app
          </button>
        </>
      )}
      <div className="my-1 border-t border-gray-100 dark:border-slate-800" />
      <button
        type="button"
        onClick={() => copyBookingInvite(contact)}
        className="w-full flex items-center gap-1.5 text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
      >
        <Copy className="h-3.5 w-3.5" /> Copy email message
      </button>
    </div>
  );

  const renderTextMenu = (contact: Contact) => (
    <div
      className="absolute right-0 top-full mt-2 w-52 z-50 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5"
      role="menu"
    >
      <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
        Send text with
      </p>
      <button
        type="button"
        onClick={() => openSmsComposer(contact)}
        className="w-full flex items-center gap-1.5 text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" /> SMS
      </button>
      <button
        type="button"
        onClick={() => openWhatsAppComposer(contact)}
        className="w-full flex items-center gap-1.5 text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" style={{ color: '#25D366' }} /> WhatsApp
      </button>
      <div className="my-1 border-t border-gray-100 dark:border-slate-800" />
      <button
        type="button"
        onClick={() => copySmsInvite(contact)}
        className="w-full flex items-center gap-1.5 text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
      >
        <Copy className="h-3.5 w-3.5" /> Copy text message
      </button>
    </div>
  );

  const inviteButtonCls =
    'flex items-center justify-center gap-1.5 min-h-11 px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-slate-900';

  const renderContactInviteButtons = (contact: Contact, menuId: string) => {
    const hasPhone = !!contactSmsNumber(contact);
    return (
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleInviteMenu('email', menuId); }}
            className={inviteButtonCls}
            aria-expanded={isInviteMenuOpen('email', menuId)}
            aria-haspopup="menu"
            title="Send booking link by email"
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </button>
          {isInviteMenuOpen('email', menuId) && renderEmailMenu(contact)}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (hasPhone) toggleInviteMenu('text', menuId); }}
            disabled={!hasPhone}
            className={inviteButtonCls}
            aria-expanded={isInviteMenuOpen('text', menuId)}
            aria-haspopup="menu"
            title={hasPhone ? 'Send booking link by SMS or WhatsApp' : 'Add a phone number to text this contact'}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            SMS / WhatsApp
          </button>
          {hasPhone && isInviteMenuOpen('text', menuId) && renderTextMenu(contact)}
        </div>
      </div>
    );
  };

  const dismissGmailBanner = () => {
    setGmailBannerDismissed(true);
    localStorage.setItem('gmail_banner_dismissed', '1');
  };

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    setGmailError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setGmailError('Please sign in again to connect Gmail.');
        setGmailConnecting(false);
        return;
      }
      const token = session.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?source=contacts`,
        { headers: { Authorization: `Bearer ${token}`, Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
      );
      const json = await res.json();
      if (json.error) {
        setGmailError(json.error.includes('not configured') ? 'Google OAuth is not configured yet.' : json.error);
        setGmailConnecting(false);
        return;
      }
      window.location.href = json.url;
    } catch (e) {
      setGmailError(String(e));
      setGmailConnecting(false);
    }
  };

  const handleSyncGmail = async () => {
    if (!profile) return;
    setGmailSyncing(true);
    setGmailError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in again to sync contacts.');
      }
      // Use stored Gmail token via edge function — never redirect to OAuth on sync
      const { data, error } = await supabase.functions.invoke('gmail-contacts-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.code === 'reconnect_required' || data?.error) {
        throw new Error(data?.error ?? 'Please disconnect and reconnect Gmail.');
      }
      const n = data?.imported ?? 0;
      setGmailContactsCount(n);
      const { data: refreshed } = await supabase
        .from('contacts')
        .select('*')
        .eq('host_id', profile.id)
        .order('created_at', { ascending: false });
      if (refreshed) setContacts(refreshed as Contact[]);
      showToast(
        n > 0 ? `${n} contact${n !== 1 ? 's' : ''} synced from Google Contacts` : 'Contacts synced successfully',
        'success',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setGmailError(msg);
      showToast(msg, 'error');
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleConnectOutlook = async () => {
    setOutlookConnecting(true);
    setOutlookError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-calendar-auth?source=contacts`,
        { headers: { Authorization: `Bearer ${token}`, Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
      );
      const json = await res.json();
      if (json.error) {
        setOutlookError(json.error.includes('not configured') ? 'Microsoft OAuth is not configured yet.' : json.error);
        setOutlookConnecting(false);
        return;
      }
      window.location.href = json.url;
    } catch (e) {
      setOutlookError(String(e));
      setOutlookConnecting(false);
    }
  };

  const handleSyncOutlook = async () => {
    if (!profile) return;
    setOutlookSyncing(true);
    setOutlookError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in again to sync contacts.');
      }
      const { data, error } = await supabase.functions.invoke('outlook-contacts-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.code === 'reconnect_required' || data?.error) {
        throw new Error(data?.error ?? 'Please disconnect and reconnect Outlook.');
      }
      const n = data?.imported ?? 0;
      setOutlookContactsCount(n);
      setOutlookConnected(true);
      const { data: refreshed } = await supabase
        .from('contacts')
        .select('*')
        .eq('host_id', profile.id)
        .order('created_at', { ascending: false });
      if (refreshed) setContacts(refreshed as Contact[]);
      showToast(
        n > 0 ? `${n} contact${n !== 1 ? 's' : ''} synced from Outlook` : 'Contacts synced successfully',
        'success',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setOutlookError(msg);
      showToast(msg, 'error');
    } finally {
      setOutlookSyncing(false);
    }
  };

  const handleDisconnectOutlook = async () => {
    if (!profile) return;
    await supabase.from('profiles').update({
      outlook_contacts_connected: false,
      outlook_contacts_count: 0,
    }).eq('id', profile.id);
    setOutlookConnected(false);
    setOutlookContactsCount(0);
    setOutlookBannerDismissed(false);
    setOutlookError('');
    localStorage.removeItem('outlook_contacts_banner_dismissed');
  };

  const handleDisconnectGmail = async () => {
    if (!profile) return;
    await supabase.from('profiles').update({
      gmail_connected: false,
      gmail_access_token: null,
      gmail_refresh_token: null,
      gmail_contacts_count: 0,
    }).eq('id', profile.id);
    setGmailConnected(false);
    setGmailContactsCount(0);
    setGmailBannerDismissed(false);
    localStorage.removeItem('gmail_banner_dismissed');
  };

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selected) {
    const ini = initials(selected.full_name, selected.email);
    const color = avatarColor(selected.email);
    const now = new Date();
    const pastBookings = selected.bookings.filter((b) => new Date(b.start_time) < now);
    const futureBookings = selected.bookings.filter((b) => new Date(b.start_time) >= now);

    return (
      <main className="p-6 md:p-8 max-w-2xl">
        <button
          onClick={() => { closeInviteMenus(); setEditingContact(false); setSelected(null); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to contacts
        </button>

        {/* Contact header */}
        <div className="flex items-center gap-4 mb-6">
          <div className={`h-16 w-16 rounded-2xl ${color} flex items-center justify-center text-white font-bold text-xl shrink-0`}>
            {ini}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.full_name || selected.email}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{selected.email}</p>
            {selected.phone && <p className="text-sm text-gray-500 dark:text-slate-400">{selected.phone}</p>}
            {selected.address && <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{selected.address}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs font-semibold rounded-full">
              {selected.meetingCount} meeting{selected.meetingCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Contact details */}
        <div className="bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Contact details</p>
            {!editingContact ? (
              <button
                type="button"
                onClick={handleStartEditContact}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEditContact}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveContact}
                  disabled={savingContact}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {savingContact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </button>
              </div>
            )}
          </div>

          {editingContact ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Full name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setEditError(''); }}
                  placeholder="Jane Smith"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Email *</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => { setEditEmail(e.target.value); setEditError(''); }}
                  placeholder="jane@example.com"
                  className={`${inputCls} ${editError ? 'border-red-400' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  onBlur={() => { if (editPhone.trim()) setEditPhone(formatPhone(editPhone)); }}
                  placeholder={PHONE_PLACEHOLDER}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">Used for SMS and WhatsApp invites</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Address</label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={2}
                  placeholder="Service / property address"
                  className={`${inputCls} resize-none`}
                />
              </div>
              {editError && <p className="text-xs text-red-500">{editError}</p>}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-gray-400 dark:text-slate-500">Name</span>
                <span className="text-gray-900 dark:text-white">{selected.full_name || '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-gray-400 dark:text-slate-500">Email</span>
                <span className="text-gray-900 dark:text-white break-all">{selected.email}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-gray-400 dark:text-slate-500">Phone</span>
                <span className="text-gray-900 dark:text-white">{selected.phone ? formatPhone(selected.phone) : '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-gray-400 dark:text-slate-500">Address</span>
                <span className="text-gray-900 dark:text-white whitespace-pre-wrap">{selected.address || '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Send booking link */}
        <div className="bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Send booking link</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                Email or text your scheduling page to {selected.full_name?.split(' ')[0] ?? 'this contact'}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderContactInviteButtons(selected, 'detail')}
              <button
                onClick={copyBookingLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Notes</p>
          </div>
          <textarea
            value={editingNotes}
            onChange={(e) => setEditingNotes(e.target.value)}
            rows={4}
            placeholder="Add notes about this contact..."
            className={`${inputCls} resize-none`}
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs transition-opacity ${notesSaved ? 'text-emerald-600 opacity-100' : 'opacity-0'}`}>Saved!</span>
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save notes
            </button>
          </div>
        </div>

        {/* Meeting history */}
        <div className="bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Meeting history</p>
            <span className="ml-auto text-xs text-gray-400">{selected.meetingCount} total</span>
          </div>

          {futureBookings.length > 0 && (
            <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-500 mb-2">Upcoming</p>
              {futureBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{(b.services as Service)?.name ?? 'Meeting'}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{formatDateTime(b.start_time)}</p>
                  </div>
                  <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    b.status === 'confirmed' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-500' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                  }`}>{b.status}</span>
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
            {pastBookings.length === 0 && futureBookings.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">
                No meetings with this person yet. Share your booking link and their next visit will show here.
              </p>
            )}
            {pastBookings.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-slate-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{(b.services as Service)?.name ?? 'Meeting'}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(b.start_time)}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  b.status === 'confirmed' || b.status === 'completed'
                    ? 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                    : b.status === 'canceled'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-400'
                }`}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <main className="p-6 md:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contacts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Everyone who has booked with you, in one place. Use <span className="font-medium text-gray-700 dark:text-slate-300">Email</span> or <span className="font-medium text-gray-700 dark:text-slate-300">SMS / WhatsApp</span> to share your booking link.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!gmailConnected && (
            <button
              type="button"
              onClick={handleConnectGmail}
              disabled={gmailConnecting}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 text-gray-800 dark:text-slate-200 text-sm font-semibold rounded-full transition-all shadow-sm disabled:opacity-60"
            >
              {gmailConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-red-500" />}
              {gmailConnecting ? 'Connecting…' : 'Import Gmail'}
            </button>
          )}
          {!outlookConnected && (
            <button
              type="button"
              onClick={handleConnectOutlook}
              disabled={outlookConnecting}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-gray-800 dark:text-slate-200 text-sm font-semibold rounded-full transition-all shadow-sm disabled:opacity-60"
            >
              {outlookConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-blue-600" />}
              {outlookConnecting ? 'Connecting…' : 'Import Outlook'}
            </button>
          )}
          <button
            onClick={() => { setShowAddForm(true); setAddName(''); setAddEmail(''); setAddPhone(''); setAddNotes(''); setAddError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add contact
          </button>
        </div>
      </div>

      {(gmailError || outlookError) && !gmailConnected && !outlookConnected && (
        <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-xs text-red-600 dark:text-red-400">
          {gmailError || outlookError}
        </div>
      )}

      {/* Import card — dismiss if you don't want to connect Gmail/Outlook */}
      {(!gmailConnected || !outlookConnected) && !importCardDismissed && (
        <div className="mb-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Import contacts
            </h2>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('contacts_import_card_dismissed', '1');
                setImportCardDismissed(true);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              title="Don't show this again"
              aria-label="Dismiss import prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Pull contacts from Gmail or Outlook. Works even if a provider account is empty — you can connect now and sync again later.
          </p>
          <div className="flex flex-wrap gap-2">
            {!gmailConnected ? (
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={gmailConnecting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {gmailConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {gmailConnecting ? 'Connecting…' : 'Import from Gmail'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSyncGmail}
                disabled={gmailSyncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {gmailSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {gmailSyncing ? 'Syncing…' : 'Sync Gmail contacts'}
              </button>
            )}
            {!outlookConnected ? (
              <button
                type="button"
                onClick={handleConnectOutlook}
                disabled={outlookConnecting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {outlookConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {outlookConnecting ? 'Connecting…' : 'Import from Outlook'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSyncOutlook}
                disabled={outlookSyncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {outlookSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {outlookSyncing ? 'Syncing…' : 'Sync Outlook contacts'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contextual checklist */}
      {!checklistDismissed && (
        <div className="relative">
          <PageChecklist
            storageKey="contacts_checklist"
            items={contactsChecklistItems}
          />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-brand-600 text-white'
            : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Outlook banner — connected */}
      {outlookConnected ? (
        <div className="mb-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Outlook connected</p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
                {outlookSyncedCount > 0
                  ? `${outlookSyncedCount} contact${outlookSyncedCount !== 1 ? 's' : ''} synced from Outlook`
                  : 'Outlook Contacts synced'}
              </p>
            </div>
            <button
              onClick={handleSyncOutlook}
              disabled={outlookSyncing}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {outlookSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {outlookSyncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button
              onClick={handleDisconnectOutlook}
              className="shrink-0 p-1.5 text-blue-500 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
              title="Disconnect Outlook"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {outlookError && (
            <p className="px-4 pb-3 text-xs text-red-500">{outlookError}</p>
          )}
        </div>
      ) : !outlookImportComplete && !outlookBannerDismissed ? (
        /* Outlook banner — prompt import */
        <div className="mb-4 bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Import contacts from Outlook</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Connect Microsoft to pull in your Outlook contacts automatically.</p>
            </div>
            <button
              onClick={handleConnectOutlook}
              disabled={outlookConnecting}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {outlookConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {outlookConnecting ? 'Redirecting…' : 'Connect Outlook'}
            </button>
            <button
              onClick={() => { setOutlookBannerDismissed(true); localStorage.setItem('outlook_contacts_banner_dismissed', '1'); }}
              className="shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {outlookError && (
            <p className="px-4 pb-3 text-xs text-red-500">{outlookError}</p>
          )}
        </div>
      ) : null}

      {/* Gmail banner — connected */}
      {gmailConnected ? (
        <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Gmail connected</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                {gmailSyncedCount > 0
                  ? `${gmailSyncedCount} contact${gmailSyncedCount !== 1 ? 's' : ''} synced from Google Contacts`
                  : 'Google Contacts synced'}
              </p>
            </div>
            <button
              onClick={handleSyncGmail}
              disabled={gmailSyncing}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#5864C6' }}
            >
              {gmailSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {gmailSyncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button
              onClick={handleDisconnectGmail}
              className="shrink-0 p-1.5 text-indigo-600 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
              title="Disconnect Gmail"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {gmailError && (
            <p className="px-4 pb-3 text-xs text-red-500">{gmailError}</p>
          )}
        </div>
      ) : !gmailImportComplete && !gmailBannerDismissed ? (
        /* Gmail banner — prompt import */
        <div className="mb-4 bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Import contacts from Google</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Connect Google to pull in your contacts automatically.</p>
            </div>
            <button
              onClick={handleConnectGmail}
              disabled={gmailConnecting}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {gmailConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {gmailConnecting ? 'Redirecting…' : 'Connect Gmail'}
            </button>
            <button
              onClick={dismissGmailBanner}
              className="shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {gmailError && (
            <p className="px-4 pb-3 text-xs text-red-500">{gmailError}</p>
          )}
        </div>
      ) : null}

      {/* Add contact form */}
      {showAddForm && (
        <div className="mb-5 bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Add contact</h3>
            <button onClick={() => setShowAddForm(false)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Full name</label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Email *</label>
                <input type="email" value={addEmail} onChange={(e) => { setAddEmail(e.target.value); setAddError(''); }} placeholder="jane@example.com" className={`${inputCls} ${addError ? 'border-red-400' : ''}`} />
                {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Phone</label>
              <input
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                onBlur={() => { if (addPhone.trim()) setAddPhone(formatPhone(addPhone)); }}
                placeholder="+1 (555) 000-0000"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">US 10-digit or international with +</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Notes</label>
              <textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} rows={2} placeholder="Optional notes..." className={`${inputCls} resize-none`} />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddContact}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save contact
              </button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
          <div className="h-14 w-14 rounded-2xl bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-brand-500 dark:text-brand-400" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">No contacts yet</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
            Import from Gmail or Outlook, add contacts manually, or share your booking link — guests appear here automatically when they book.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {!gmailConnected && (
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={gmailConnecting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-60"
              >
                {gmailConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {gmailConnecting ? 'Connecting…' : 'Import from Gmail'}
              </button>
            )}
            {!outlookConnected && (
              <button
                type="button"
                onClick={handleConnectOutlook}
                disabled={outlookConnecting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all disabled:opacity-60"
              >
                {outlookConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {outlookConnecting ? 'Connecting…' : 'Import from Outlook'}
              </button>
            )}
          </div>
          <button
            onClick={copyBookingLink}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-all"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Share your booking link'}
          </button>
        </div>
      ) : (
        <>
          {/* Search + filter */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>
            <div className="flex gap-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-1">
              {(['all', 'recent', 'upcoming'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
                    filter === f
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {f === 'upcoming' ? 'Upcoming' : f === 'recent' ? 'Recent' : 'All'}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
              No contacts match your search.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-visible divide-y divide-gray-50 dark:divide-slate-800/50">
              {filtered.map((c) => {
                const ini = initials(c.full_name, c.email);
                const color = avatarColor(c.email);
                const hasPhone = !!contactSmsNumber(c);
                return (
                  <div
                    key={c.id}
                    className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => { closeInviteMenus(); setSelected(c); setEditingNotes(c.notes ?? ''); setNotesSaved(false); }}
                        className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center text-white font-bold text-sm shrink-0`}
                        aria-label={`Open ${c.full_name || c.email}`}
                      >
                        {ini}
                      </button>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => { closeInviteMenus(); setSelected(c); setEditingNotes(c.notes ?? ''); setNotesSaved(false); }}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {c.full_name || c.email}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{c.email}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                                {c.meetingCount} {c.meetingCount === 1 ? 'meeting' : 'meetings'}
                              </p>
                              {c.nextMeeting ? (
                                <p className="text-[11px] text-indigo-600 dark:text-indigo-500 mt-0.5">
                                  Next: {formatDate(c.nextMeeting)}
                                </p>
                              ) : c.lastMeeting ? (
                                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                                  Last: {formatDate(c.lastMeeting)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                        <div
                          className="flex flex-wrap items-center gap-2 mt-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderContactInviteButtons(c, c.id)}
                          {!hasPhone && (
                            <span className="text-[11px] text-gray-400 dark:text-slate-500">
                              Add a phone number to enable texting
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { closeInviteMenus(); setSelected(c); setEditingNotes(c.notes ?? ''); setNotesSaved(false); }}
                        className="shrink-0 mt-1"
                        aria-label="Open contact"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-slate-600 group-hover:text-gray-500 dark:group-hover:text-slate-400 transition-colors" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              className="w-full py-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-xl mt-4 transition-colors"
            >
              Load more contacts
            </button>
          )}

          <p className="text-xs text-gray-400 dark:text-slate-600 mt-3 text-center">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} total
          </p>
        </>
      )}
    </main>
  );
}
