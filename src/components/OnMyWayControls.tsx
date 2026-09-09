import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Navigation, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Booking } from '../lib/types';
import { toast } from './Toast';
import {
  ON_MY_WAY_ETA_OPTIONS,
  ON_MY_WAY_SMS_ENABLED,
  clampOnMyWayEta,
  guestAllowsOnMyWaySms,
  guestHasOnMyWayEmail,
  isOnMyWayEligibleStatus,
  pickDefaultOnMyWayEta,
} from '../lib/onMyWay';

type Props = {
  booking: Booking;
  compact?: boolean;
  onSent?: (patch: { sent_on_my_way_at: string; on_my_way_eta_minutes: number }) => void;
};

export function OnMyWayControls({ booking, compact, onSent }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [sending, setSending] = useState(false);

  const defaultEta = useMemo(
    () => pickDefaultOnMyWayEta(profile?.on_my_way_eta_usage, profile?.on_my_way_default_eta_minutes),
    [profile?.on_my_way_eta_usage, profile?.on_my_way_default_eta_minutes],
  );
  const [eta, setEta] = useState(defaultEta);

  useEffect(() => {
    setEta(defaultEta);
  }, [defaultEta]);

  if (!isOnMyWayEligibleStatus(booking.status)) return null;

  const already = Boolean(booking.sent_on_my_way_at);
  const smsOk = guestAllowsOnMyWaySms(booking);
  const emailOk = guestHasOnMyWayEmail(booking);

  const send = async (channel: 'sms' | 'email') => {
    const minutes = clampOnMyWayEta(custom.trim() ? Number(custom) : eta);
    if (minutes == null) {
      toast('ETA must be between 1 and 180 minutes.');
      return;
    }
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const access = sessionData.session?.access_token;
      if (!access) {
        toast('Sign in again to send.');
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-on-my-way`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ bookingId: booking.id, etaMinutes: minutes, channel }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
        sent_on_my_way_at?: string;
        on_my_way_eta_minutes?: number;
      };
      if (!res.ok || !json.ok) {
        toast(json.error || 'Could not send.');
        return;
      }
      onSent?.({
        sent_on_my_way_at: json.sent_on_my_way_at || new Date().toISOString(),
        on_my_way_eta_minutes: json.on_my_way_eta_minutes || minutes,
      });
      setOpen(false);
      toast(channel === 'sms' ? 'On-my-way text sent.' : 'On-my-way email sent.');
      void refreshProfile();
    } finally {
      setSending(false);
    }
  };

  if (already) {
    const mins = booking.on_my_way_eta_minutes;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 ${compact ? '' : 'px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30'}`}>
        <Check className="h-3.5 w-3.5" />
        Notified{mins ? ` · ${mins} min` : ''}
      </span>
    );
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? 'inline-flex items-center gap-1 min-h-11 px-2.5 rounded-lg text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/30'
            : 'w-full inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-xl border border-brand-200 dark:border-brand-800 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/20'
        }
      >
        <Navigation className="h-3.5 w-3.5" />
        On my way
      </button>
      {open && (
        <div className={`z-20 ${compact ? 'absolute right-0 mt-1 w-64' : 'mt-2'} rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-3 space-y-2`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ETA</p>
          <div className="flex flex-wrap gap-1.5">
            {ON_MY_WAY_ETA_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setEta(n); setCustom(''); }}
                className={`min-h-9 px-2.5 rounded-lg text-xs font-semibold border ${
                  !custom && eta === n
                    ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {n} min
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={180}
            inputMode="numeric"
            placeholder="Custom minutes"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-full min-h-11 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
          />
          {!ON_MY_WAY_SMS_ENABLED && smsOk && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
              On-my-way texts are off until our SMS campaign includes them.
            </p>
          )}
          {smsOk && ON_MY_WAY_SMS_ENABLED ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => void send('sms')}
              className="w-full min-h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              Text {custom.trim() || eta} min
            </button>
          ) : !smsOk && emailOk ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => void send('email')}
              className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              They didn’t opt in to texts — email instead
            </button>
          ) : !smsOk && !emailOk ? (
            <p className="text-xs text-slate-500">No SMS consent and no email on this booking.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
