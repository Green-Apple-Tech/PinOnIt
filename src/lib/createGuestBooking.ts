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
  reminder_channels: string[];
  reminder_times: string[];
  stripe_payment_id: string | null;
};

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
