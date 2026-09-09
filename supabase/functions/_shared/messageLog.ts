import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

/** Record an outbound SMS on message_log so it counts toward the host's usage. */
export async function logHostSmsUsage(
  supabase: SupabaseClient,
  row: {
    hostId: string;
    recipient: string;
    subject: string;
    body: string;
    status?: 'sent' | 'failed';
    bookingId?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('message_log').insert({
    booking_id: row.bookingId ?? null,
    host_id: row.hostId,
    template_id: null,
    channel: 'sms',
    status: row.status ?? 'sent',
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    language: 'en',
    sent_at: new Date().toISOString(),
  });
  if (error) console.error('message_log insert failed:', error.message);
}
