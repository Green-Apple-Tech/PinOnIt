import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Phone, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BookPage } from './Book';
import type { Profile, Service } from '../lib/types';
import {
  RESCHEDULE_BLOCK_COPY,
  type RescheduleBlockReason,
  type RescheduleContact,
  type RescheduleSession,
} from '../lib/reschedule';

function isBlockReason(value: unknown): value is RescheduleBlockReason {
  return value === 'expired' || value === 'used' || value === 'cutoff' || value === 'not_found' || value === 'not_allowed';
}

function BlockedMessage({
  reason,
  contact,
}: {
  reason: RescheduleBlockReason;
  contact: RescheduleContact | null;
}) {
  const name = contact?.name?.trim() || 'the business';
  const email = contact?.email?.trim() || '';
  const phone = contact?.phone?.trim() || '';
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-3">Can&apos;t reschedule here</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          {RESCHEDULE_BLOCK_COPY[reason]} Contact {name} to pick a new time.
        </p>
        {(email || phone) && (
          <div className="mt-6 space-y-2 text-sm">
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center justify-center gap-2 text-brand-600 dark:text-brand-400 font-medium">
                <Phone className="h-4 w-4" />
                {phone}
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="flex items-center justify-center gap-2 text-brand-600 dark:text-brand-400 font-medium">
                <Mail className="h-4 w-4" />
                {email}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReschedulePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<RescheduleSession | null>(null);
  const [reason, setReason] = useState<RescheduleBlockReason>('not_found');
  const [contact, setContact] = useState<RescheduleContact | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_reschedule_session', { p_token: token });
      if (cancelled) return;
      const row = data as Record<string, unknown> | null;
      if (error || !row) {
        setReason('not_found');
        setLoading(false);
        return;
      }
      const contactRow = (row.contact as RescheduleContact) ?? null;
      setContact(contactRow);
      if (!row.ok) {
        setReason(isBlockReason(row.reason) ? row.reason : 'not_found');
        setLoading(false);
        return;
      }
      setSession({
        token: String(row.token),
        bookingId: String(row.booking_id),
        host: row.host as Profile,
        service: row.service as Service,
        guestName: String(row.guest_name || ''),
        guestEmail: String(row.guest_email || ''),
        guestPhone: String(row.guest_phone || ''),
        guestTimezone: typeof row.guest_timezone === 'string' ? row.guest_timezone : undefined,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
    return <BlockedMessage reason={reason} contact={contact} />;
  }

  return <BookPage rescheduleSession={session} />;
}
