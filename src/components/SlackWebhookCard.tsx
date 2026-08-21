import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2, MessageSquare, Save, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatFunctionError } from '../lib/errors';
import { isValidSlackWebhookUrl } from '../lib/slackWebhook';
import { toast } from './Toast';

function SlackLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path fill="#E01E5A" d="M6.5 15.2a1.7 1.7 0 1 1-1.7-1.7h1.7v1.7zM7.3 15.2a1.7 1.7 0 1 1 3.4 0v4.3a1.7 1.7 0 1 1-3.4 0v-4.3z" />
      <path fill="#36C5F0" d="M8.8 6.5A1.7 1.7 0 1 1 10.5 4.8v1.7H8.8zM8.8 7.3a1.7 1.7 0 1 1 0 3.4H4.5a1.7 1.7 0 1 1 0-3.4h4.3z" />
      <path fill="#2EB67D" d="M17.5 8.8a1.7 1.7 0 1 1 1.7 1.7h-1.7V8.8zM16.7 8.8a1.7 1.7 0 1 1-3.4 0V4.5a1.7 1.7 0 1 1 3.4 0v4.3z" />
      <path fill="#ECB22E" d="M15.2 17.5a1.7 1.7 0 1 1-1.7 1.7v-1.7h1.7zM15.2 16.7a1.7 1.7 0 1 1 0-3.4h4.3a1.7 1.7 0 1 1 0 3.4h-4.3z" />
    </svg>
  );
}

export function SlackWebhookCard({ compact = false }: { compact?: boolean }) {
  const { profile, refreshProfile } = useAuth();
  const [url, setUrl] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState('');

  const connected = isValidSlackWebhookUrl(profile?.slack_webhook_url ?? '');

  useEffect(() => {
    setUrl(profile?.slack_webhook_url ?? '');
  }, [profile?.slack_webhook_url]);

  const handleConnect = async () => {
    setConnecting(true);
    setMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-auth`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        },
      );
      const json = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok || json.error || !json.url) {
        setMsg(json.error || 'Could not start Slack Connect. Paste a webhook URL below instead.');
        setShowPaste(true);
        setConnecting(false);
        return;
      }
      window.location.href = json.url;
    } catch (e) {
      setMsg(String(e));
      setShowPaste(true);
      setConnecting(false);
    }
  };

  const handleSave = async (nextUrl: string) => {
    if (!profile?.id) return;
    const trimmed = nextUrl.trim();
    if (trimmed && !isValidSlackWebhookUrl(trimmed)) {
      setMsg('URL must start with https://hooks.slack.com/services/');
      return;
    }
    setSaving(true);
    setMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ slack_webhook_url: trimmed || null })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    await refreshProfile();
    setMsg(trimmed ? 'Saved.' : 'Disconnected.');
    toast.success(trimmed ? 'Slack webhook saved.' : 'Slack disconnected.');
    setTimeout(() => setMsg(''), 2500);
  };

  const handleDisconnect = () => {
    setUrl('');
    void handleSave('');
  };

  const handleTest = async () => {
    const trimmed = url.trim();
    if (!isValidSlackWebhookUrl(trimmed)) {
      setMsg('URL must start with https://hooks.slack.com/services/');
      return;
    }
    setTesting(true);
    setMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            test_slack: true,
            slack_webhook_url: trimmed,
            text: 'PinOnIt test: Slack notifications are working.',
          }),
        },
      );
      const json = await res.json().catch(() => ({})) as { success?: boolean; error?: unknown };
      if (!res.ok || json.error) {
        setMsg(formatFunctionError(json, 'Slack test failed. Check the webhook URL.'));
      } else {
        setMsg('Test sent. Check your Slack channel.');
        toast.success('Test sent. Check your Slack channel.');
      }
    } catch (e) {
      setMsg(String(e));
    }
    setTesting(false);
  };

  const errorish = msg.startsWith('URL') || msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') || msg.toLowerCase().includes('could not');

  return (
    <div className={compact
      ? 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 md:p-5 space-y-4'
      : `p-4 bg-white dark:bg-slate-900/60 border rounded-xl ${connected ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-slate-200 dark:border-slate-800'}`
    }>
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0">
          <SlackLogo />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Slack</p>
            {connected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                <Check className="h-3 w-3" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium rounded-full">
                <WifiOff className="h-3 w-3" /> Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Post booking confirmations and reminders to a Slack channel. Failures are logged and never block the booking.
          </p>
        </div>
        <div className="shrink-0 flex flex-col gap-2 items-end">
          {connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={connecting}
              className="px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 hover:opacity-90"
              style={{ backgroundColor: '#5864C6' }}
            >
              {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Connect Slack
            </button>
          )}
        </div>
      </div>

      {connected && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
            className="min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Send test message
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPaste((v) => !v)}
        className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1"
      >
        {showPaste ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {connected ? 'Replace webhook URL' : 'Or paste an Incoming Webhook URL'}
      </button>

      {showPaste && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Create an Incoming Webhook in Slack, then paste it here.{' '}
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noreferrer"
              className="underline font-medium text-slate-600 dark:text-slate-300"
            >
              Slack webhook docs
            </a>
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setMsg(''); }}
            placeholder="https://hooks.slack.com/services/…"
            className="w-full min-h-11 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-base text-slate-900 dark:text-white"
          />
          <button
            type="button"
            onClick={() => void handleSave(url)}
            disabled={saving}
            className="min-h-11 px-4 rounded-xl text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            style={{ backgroundColor: '#5864C6' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save webhook
          </button>
        </div>
      )}

      {msg && (
        <p className={`mt-2 text-sm ${errorish ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
