export type CreateGuestBookingPayload = {
  service_id: string;
  host_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  guest_address: string | null;
  notify_via: string[] | null;
  guest_timezone: string;
  start_time: string;
  end_time: string;
  notes: string;
  is_recurring: boolean;
  recurrence_frequency: string | null;
  parent_booking_id?: string | null;
  request_repeating?: boolean;
  repeat_frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom' | null;
  repeat_interval_days?: number | null;
  repeat_weekdays?: number[] | null;
  repeat_month_nth?: number | null;
  reminder_channels: string[];
  reminder_times: string[];
  stripe_payment_id: string | null;
  created_by_host?: boolean;
  sms_consent?: boolean;
  whatsapp_consent?: boolean;
  sms_consent_source?: string | null;
  sms_consent_user_agent?: string | null;
  sms_consent_disclosure?: string | null;
  sms_consent_page_url?: string | null;
};

export function repeatRequestPayload(opts: {
  requestRepeating: boolean;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  intervalDays?: number | null;
  weekdays?: number[] | null;
  monthNth?: number | null;
}): Pick<
  CreateGuestBookingPayload,
  'request_repeating' | 'repeat_frequency' | 'repeat_interval_days' | 'repeat_weekdays' | 'repeat_month_nth'
> {
  if (!opts.requestRepeating) {
    return { request_repeating: false };
  }
  const weeklyish = opts.frequency === 'weekly' || opts.frequency === 'biweekly';
  const monthlyWeekday = opts.frequency === 'monthly' && opts.monthNth != null;
  return {
    request_repeating: true,
    repeat_frequency: opts.frequency,
    repeat_interval_days: opts.frequency === 'custom' ? Math.max(1, opts.intervalDays ?? 1) : null,
    repeat_weekdays: weeklyish || monthlyWeekday ? (opts.weekdays ?? null) : null,
    repeat_month_nth: opts.frequency === 'monthly' ? (opts.monthNth ?? null) : null,
  };
}

export function mapCreateGuestBookingError(
  message?: string | null,
  code?: string | null,
): string {
  const msg = `${message ?? ''} ${code ?? ''}`;
  if (/guest_blocked/i.test(msg)) return 'This email cannot book with this host.';
  if (/host_inactive/i.test(msg)) return 'This host is not taking bookings right now.';
  if (/invalid_service/i.test(msg)) return 'This meeting type is no longer available.';
  if (/invalid_payload/i.test(msg)) return 'Some booking details are missing. Please check the form and try again.';
  return 'Could not complete this booking. Please try another time.';
}
