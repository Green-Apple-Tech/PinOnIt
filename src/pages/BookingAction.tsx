import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Booking } from '../lib/types';
import { Check, X, CalendarDays, Loader2, ArrowRight, Video } from 'lucide-react';

export function BookingActionPage() {
  const { bookingId, action, actionToken } = useParams<{ bookingId: string; action: string; actionToken: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'confirmed' | 'canceled' | 'reschedule' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!bookingId || !actionToken) return;
    supabase
      .from('bookings')
      .select('*, services(name, color, duration_minutes), profiles(full_name, slug)')
      .eq('id', bookingId)
      .eq('action_token', actionToken)
      .maybeSingle()
      .then(({ data }) => {
        setBooking(data as Booking | null);
        setLoading(false);
      });
  }, [bookingId, actionToken]);

  const handleAction = async () => {
    if (!bookingId || !action) return;
    setProcessing(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ booking_id: bookingId, action_token: actionToken, action }),
      });

      const data = await res.json();

      if (data.error) {
        setErrorMsg(data.error);
        setResult('error');
      } else if (action === 'confirm') {
        setResult('confirmed');
      } else if (action === 'cancel') {
        setResult('canceled');
      } else if (action === 'reschedule') {
        setResult('reschedule');
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setResult('error');
    }

    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Booking not found</h1>
          <p className="text-slate-500 dark:text-slate-400">This booking may have been removed.</p>
        </div>
      </div>
    );
  }

  const service = booking.services as any;
  const hostProfile = booking.profiles as any;
  const actionLabel = action === 'confirm' ? 'Confirm' : action === 'cancel' ? 'Cancel' : 'Reschedule';
  const actionColor = action === 'confirm' ? 'brand' : action === 'cancel' ? 'red' : 'blue';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {result === null && (
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{actionLabel} Appointment</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {action === 'confirm'
                  ? 'Confirm your attendance for this appointment.'
                  : action === 'cancel'
                  ? 'Are you sure you want to cancel this appointment?'
                  : 'Reschedule to a new time that works for you.'}
              </p>
            </div>

            {/* Booking details */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6 space-y-2">
              <div className="flex items-center gap-2">
                {service?.color && (
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: service.color }} />
                )}
                <span className="font-medium text-sm text-slate-900 dark:text-white">{service?.name ?? 'Appointment'}</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                with {hostProfile?.full_name ?? 'Host'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date(booking.start_time).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })} at {new Date(booking.start_time).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
              {booking.meet_link && (
                <a
                  href={booking.meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  <Video className="h-3.5 w-3.5 shrink-0" />
                  {booking.meet_link.includes('teams.microsoft') ? 'Join Microsoft Teams' : booking.meet_link.includes('zoom.us') ? 'Join Zoom Meeting' : 'Join Google Meet'}
                </a>
              )}
            </div>

            <button
              onClick={handleAction}
              disabled={processing}
              className={`w-full py-3 font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                actionColor === 'brand'
                  ? 'bg-brand-600 hover:bg-brand-500 text-white'
                  : actionColor === 'red'
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-brand-600 hover:bg-brand-500 text-white'
              }`}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : action === 'confirm' ? (
                <Check className="h-4 w-4" />
              ) : action === 'cancel' ? (
                <X className="h-4 w-4" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )}
              {actionLabel} appointment
            </button>

            {action !== 'reschedule' && (
              <div className="mt-4 flex justify-center gap-4 text-xs">
                {action !== 'confirm' && (
                  <Link
                    to={`/booking/${bookingId}/confirm/${actionToken}`}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Confirm instead
                  </Link>
                )}
                {action !== 'cancel' && (
                  <Link
                    to={`/booking/${bookingId}/cancel/${actionToken}`}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    Cancel instead
                  </Link>
                )}
                <Link
                  to={`/booking/${bookingId}/reschedule/${actionToken}`}
                  className="text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Reschedule
                </Link>
              </div>
            )}
          </div>
        )}

        {result === 'confirmed' && (
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Appointment confirmed!</h2>
            <p className="text-slate-500 dark:text-slate-400">You're all set. See you there.</p>
            {booking?.meet_link && (
              <a
                href={booking.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Video className="h-4 w-4" />
                {booking.meet_link.includes('teams.microsoft') ? 'Join Microsoft Teams' : booking.meet_link.includes('zoom.us') ? 'Join Zoom Meeting' : 'Join Google Meet'}
              </a>
            )}
          </div>
        )}

        {result === 'canceled' && (
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Appointment canceled</h2>
            <p className="text-slate-500 dark:text-slate-400">Your appointment has been canceled.</p>
            {hostProfile?.slug && (
              <Link
                to={`/${hostProfile.slug}`}
                className="mt-4 inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
              >
                Book a new time <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        {result === 'reschedule' && hostProfile?.slug && (
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-brand-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="h-8 w-8 text-brand-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Pick a new time</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-4">Visit the booking page to schedule a new appointment.</p>
            <Link
              to={`/${hostProfile.slug}`}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Book new time <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {result === 'error' && (
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-slate-500 dark:text-slate-400">{errorMsg || 'Please try again later.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
