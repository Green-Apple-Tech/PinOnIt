import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function ReminderDonePage() {
  const { token } = useParams();
  const [state, setState] = useState<'working' | 'done' | 'already' | 'error'>('working');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('That link is not valid.');
      return;
    }
    let cancelled = false;
    void supabase.functions.invoke('ack-personal-reminder', { body: { token } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.error) {
          setState('error');
          setMessage(typeof data?.error === 'string' ? data.error : 'Could not mark that done.');
          return;
        }
        setTitle(typeof data.title === 'string' ? data.title : '');
        setState(data.already ? 'already' : 'done');
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
          setMessage('Could not mark that done.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-3">
        {state === 'working' ? (
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Marking this reminder done…
          </p>
        ) : state === 'error' ? (
          <p className="text-sm text-red-600">{message}</p>
        ) : (
          <>
            <p className="inline-flex items-center gap-2 text-base font-semibold">
              <Check className="h-5 w-5 text-brand-600" />
              {state === 'already' ? 'Already marked done' : 'Marked done'}
            </p>
            {title ? <p className="text-sm text-slate-700">{title}</p> : null}
            <p className="text-sm text-slate-500">
              Extra reminders for this will stop. PinOnIt was only reminding you of what you asked. It was not checking whether it was still true.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
