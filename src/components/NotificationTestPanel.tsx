import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  PhoneCall,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatFunctionError } from '../lib/errors';
import { PHONE_PLACEHOLDER, PHONE_HINT, blurFormatPhone, normalizePhoneE164 } from '../lib/phone';
import { SmsBookingConsent } from './SmsConsentText';

type TestChannel = 'sms' | 'whatsapp' | 'voice' | 'email';

export function NotificationTestPanel() {
  const { profile } = useAuth();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState<TestChannel | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const profileEmail = (profile?.email ?? '').trim();

  useEffect(() => {
    const seed = profile?.phone || (profile as { whatsapp_number?: string } | null)?.whatsapp_number || '';
    if (seed) setPhone((prev) => (prev.trim() ? prev : blurFormatPhone(seed)));
  }, [profile?.phone, profile]);

  const anySending = sending !== null;

  const handleTest = async (channel: TestChannel) => {
    setResult(null);
    if (channel !== 'email') {
      const to = normalizePhoneE164(phone);
      if (!to) return;
    } else if (!profileEmail) {
      setResult({ ok: false, message: 'Add an email on your profile to send a test email.' });
      return;
    }

    setSending(channel);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const now = new Date();
      const body: Record<string, unknown> = {
        guest_name: 'Test Guest',
        host_name: profile?.full_name ?? 'Your Host',
        duration: '30',
        date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
      if (channel === 'email') {
        body.test_email = true;
      } else {
        body.test_sms = channel === 'sms';
        body.test_whatsapp = channel === 'whatsapp';
        body.test_voice = channel === 'voice';
        body.to = normalizePhoneE164(phone);
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => ({})) as { success?: boolean; error?: unknown; to?: string };
      const labels: Record<TestChannel, string> = {
        sms: 'SMS',
        whatsapp: 'WhatsApp',
        voice: 'voicemail',
        email: 'email',
      };
      const label = labels[channel];
      const sent = res.ok && json.success === true && !json.error;
      if (!sent) {
        setResult({
          ok: false,
          message: formatFunctionError(
            json,
            channel === 'email'
              ? 'Failed to send test email. Check Resend configuration.'
              : `Failed to send ${label}. Check Twilio WhatsApp template / credentials.`,
          ),
        });
      } else if (channel === 'email') {
        setResult({
          ok: true,
          message: `Test email queued to ${json.to ?? profileEmail}. Check your inbox (and spam).`,
        });
      } else if (channel === 'voice') {
        setResult({
          ok: true,
          message: `Test call started to ${json.to ?? normalizePhoneE164(phone)}. Answer to hear the reminder voicemail.`,
        });
      } else {
        setResult({
          ok: true,
          message: `Test ${label} queued to ${json.to ?? normalizePhoneE164(phone)}. Check your phone — “queued” is not the same as delivered.`,
        });
      }
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    }
    setSending(null);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-slate-400" />
          Test channels
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Send a sample SMS, WhatsApp, voicemail, or email. Results also appear in{' '}
          <Link to="/dashboard/settings?tab=activity" className="font-semibold underline">
            Settings → Activity
          </Link>
          .
        </p>
      </div>
      <div className="px-5 py-4 space-y-3">
        <input
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setResult(null);
          }}
          onBlur={(e) => {
            if (e.target.value.trim()) setPhone(blurFormatPhone(e.target.value));
          }}
          placeholder={PHONE_PLACEHOLDER}
          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleTest('sms')}
            disabled={anySending || !phone.trim()}
            className="px-4 py-2 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 hover:opacity-90"
            style={{ backgroundColor: '#5864C6' }}
          >
            {sending === 'sms' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            {sending === 'sms' ? 'Sending…' : 'Test SMS'}
          </button>
          <button
            type="button"
            onClick={() => void handleTest('whatsapp')}
            disabled={anySending || !phone.trim()}
            className="px-4 py-2 disabled:opacity-50 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {sending === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            {sending === 'whatsapp' ? 'Sending…' : 'Test WhatsApp'}
          </button>
          <button
            type="button"
            onClick={() => void handleTest('voice')}
            disabled={anySending || !phone.trim()}
            className="px-4 py-2 disabled:opacity-50 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {sending === 'voice' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
            {sending === 'voice' ? 'Calling…' : 'Test voicemail'}
          </button>
          <button
            type="button"
            onClick={() => void handleTest('email')}
            disabled={anySending || !profileEmail}
            title={profileEmail ? `Send to ${profileEmail}` : 'Add email on your profile'}
            className="px-4 py-2 disabled:opacity-50 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {sending === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sending === 'email' ? 'Sending…' : 'Test Email'}
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">{PHONE_HINT}</p>
        {profileEmail ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Test Email goes to <span className="font-medium text-slate-600 dark:text-slate-300">{profileEmail}</span>
          </p>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Add an email on your profile to enable Test Email.
          </p>
        )}
        <SmsBookingConsent className="text-xs text-gray-500 dark:text-slate-400 mt-1" />
        {result && (
          <div
            className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${
              result.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span className="whitespace-pre-wrap">{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
