import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock, Loader2, Phone, User, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { AvailabilitySlot, Booking, DateOverride, Profile, Service } from '../lib/types';
import { DEFAULT_CALENDAR_CONFLICT_SETTINGS } from '../lib/types';
import {
  buildSlots,
  busyPeriodsFromEvents,
  formatSlotTime12,
  type PublicBusyPayload,
} from '../lib/bookingSlots';
import { mapCreateGuestBookingError } from '../lib/createGuestBooking';
import { PHONE_HINT, PHONE_PLACEHOLDER, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { publicBusyWindow } from '../lib/queryWindow';
import { SMS_BOOKING_CONSENT_CTA } from '../lib/smsCompliance';
import { syncBookingToExternalCalendarsAsHost } from '../lib/writeCalendarEvent';
import { ContactAutocomplete } from './ContactAutocomplete';

const BRAND = '#5864C6';

function dateHeading(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function HostProxyBookingModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [busyTimes, setBusyTimes] = useState<{ start: Date; end: Date }[]>([]);
  const [loading, setLoading] = useState(true);

  const [serviceId, setServiceId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneMasked, setPhoneMasked] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-sync`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }).catch(() => {});
        }
        const { from, to } = publicBusyWindow();
        const [svcRes, availRes, busyRes, ovRes] = await Promise.all([
          supabase.from('services').select('*').eq('host_id', profile.id).eq('is_active', true).order('created_at'),
          supabase.from('availability').select('*').eq('host_id', profile.id).eq('is_active', true),
          supabase.rpc('get_public_busy_times', { p_host_id: profile.id, p_from: from, p_to: to }),
          supabase.from('date_overrides').select('*').eq('host_id', profile.id),
        ]);
        if (cancelled) return;
        const list = (svcRes.data as Service[]) ?? [];
        setServices(list);
        if (list[0] && !serviceId) setServiceId(list[0].id);
        setAvailability((availRes.data as AvailabilitySlot[]) ?? []);
        const busy = (busyRes.data ?? {}) as PublicBusyPayload;
        setBookings((busy.bookings ?? []) as Booking[]);
        setDateOverrides((ovRes.data as DateOverride[]) ?? []);
        const conflictSettings = {
          ...DEFAULT_CALENDAR_CONFLICT_SETTINGS,
          ...((profile as Profile).calendar_conflict_settings ?? {}),
        };
        setBusyTimes(busyPeriodsFromEvents(busy.events ?? [], conflictSettings));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const slotMap = useMemo(() => {
    if (!selectedService) return new Map<string, string[]>();
    return buildSlots(availability, bookings, selectedService, dateOverrides, busyTimes);
  }, [selectedService, availability, bookings, dateOverrides, busyTimes]);

  const dateKeys = useMemo(() => [...slotMap.keys()].sort(), [slotMap]);
  const slotsForDay = selectedDate ? (slotMap.get(selectedDate) ?? []) : [];

  const handleSave = useCallback(async () => {
    if (!profile?.id || !selectedService || !selectedDate || !selectedSlot || !guestName.trim() || !phone.trim()) {
      setError('Name, phone, and a free time slot are required.');
      return;
    }
    setError('');
    setSaving(true);
    const [y, m, d] = selectedDate.split('-').map(Number);
    const [sh, sm] = selectedSlot.split(':').map(Number);
    const startTime = new Date(y, m - 1, d, sh, sm);
    const endTime = new Date(startTime.getTime() + selectedService.duration_minutes * 60000);
    const e164 = normalizePhoneE164(phone.trim());
    const { data, error: insertError } = await supabase.rpc('create_guest_booking', {
      p_payload: {
        service_id: selectedService.id,
        host_id: profile.id,
        guest_name: guestName.trim(),
        guest_email: null,
        guest_phone: e164,
        guest_address: null,
        notify_via: ['sms'],
        guest_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: '',
        is_recurring: false,
        recurrence_frequency: null,
        reminder_channels: ['sms'],
        reminder_times: ['24hour', '1hour'],
        stripe_payment_id: null,
        created_by_host: true,
        sms_consent: true,
        sms_consent_source: 'host_proxy',
        sms_consent_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        sms_consent_disclosure: SMS_BOOKING_CONSENT_CTA,
        sms_consent_page_url: typeof window !== 'undefined' ? window.location.href : null,
      },
    });
    if (insertError || !data) {
      setSaving(false);
      setError(mapCreateGuestBookingError(insertError?.message, insertError?.code));
      return;
    }
    const booking = data as Booking;
    void syncBookingToExternalCalendarsAsHost({ bookingId: booking.id, hostId: profile.id });
    try {
      const { data: rules } = await supabase
        .from('reminder_rules')
        .select('template_id, timing_offset_minutes')
        .eq('host_id', profile.id)
        .eq('is_active', true);
      for (const rule of rules ?? []) {
        if ((rule.timing_offset_minutes ?? 0) !== 0) continue;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            booking_id: booking.id,
            template_id: rule.template_id,
            action_token: booking.action_token,
          }),
        }).catch(() => {});
      }
    } catch { /* non-blocking */ }
    setSaving(false);
    onSaved();
    onClose();
  }, [profile, selectedService, selectedDate, selectedSlot, guestName, phone, onSaved, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Book for someone</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-2">{error}</p>
          )}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : services.length === 0 ? (
            <p className="text-sm text-slate-500">Add an active service first, then you can book a slot for someone.</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Service</label>
                <select
                  value={serviceId}
                  onChange={(e) => { setServiceId(e.target.value); setSelectedDate(null); setSelectedSlot(null); }}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>
                  ))}
                </select>
              </div>
              <div>
                <ContactAutocomplete
                  hostId={profile?.id}
                  onSelect={(c) => {
                    setGuestName(c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' '));
                    if (c.phone) {
                      setPhone(c.phone);
                      setPhoneMasked(false);
                    }
                  }}
                />
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 mt-2">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Client name"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phoneMasked ? `***-***-${phone.replace(/\D/g, '').slice(-4)}` : phone}
                    onChange={(e) => { if (!phoneMasked) setPhone(e.target.value); }}
                    onBlur={() => {
                      if (phone.trim()) {
                        setPhone(blurFormatPhone(phone));
                        setPhoneMasked(true);
                      }
                    }}
                    onClick={() => { if (phoneMasked) setPhoneMasked(false); }}
                    placeholder={PHONE_PLACEHOLDER}
                    readOnly={phoneMasked}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">{PHONE_HINT} We&apos;ll text a confirmation and reminders at this number.</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Open times (same rules as your booking page)
                </p>
                {dateKeys.length === 0 ? (
                  <p className="text-sm text-slate-500">No open times in the booking window. Check availability hours and calendar conflicts.</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {dateKeys.slice(0, 21).map((dk) => (
                      <button
                        key={dk}
                        type="button"
                        onClick={() => { setSelectedDate(dk); setSelectedSlot(null); }}
                        className={`shrink-0 min-w-[4.5rem] px-2 py-2 rounded-xl border text-xs font-semibold ${
                          selectedDate === dk
                            ? 'text-white border-transparent'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                        style={selectedDate === dk ? { background: BRAND, borderColor: BRAND } : undefined}
                      >
                        {dateHeading(dk)}
                      </button>
                    ))}
                  </div>
                )}
                {selectedDate && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {slotsForDay.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`min-h-[44px] rounded-xl border text-sm font-semibold ${
                          selectedSlot === slot
                            ? 'text-white border-transparent'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                        }`}
                        style={selectedSlot === slot ? { background: BRAND, borderColor: BRAND } : undefined}
                      >
                        {formatSlotTime12(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !guestName.trim() || !phone.trim() || !selectedSlot || !selectedService}
                className="w-full min-h-[48px] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: BRAND }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? 'Booking…' : 'Confirm booking'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
