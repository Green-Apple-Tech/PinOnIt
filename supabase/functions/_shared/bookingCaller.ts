export type BookingAuthRow = {
  id: string;
  host_id: string;
  action_token: string | null;
  start_time: string;
  end_time: string;
};

export async function loadAuthorizedBooking(
  supabase: { from: (table: string) => any },
  bookingId: string,
  hostId: string,
  actionToken: string | undefined,
): Promise<{ booking: BookingAuthRow } | { error: string; status: number }> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, host_id, action_token, start_time, end_time')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) {
    return { error: 'Booking not found', status: 404 };
  }
  if (booking.host_id !== hostId) {
    return { error: 'Host mismatch', status: 403 };
  }
  if (!actionToken || actionToken !== booking.action_token) {
    return { error: 'Invalid booking token', status: 401 };
  }
  return { booking: booking as BookingAuthRow };
}
