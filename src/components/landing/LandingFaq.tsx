import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'What is PinOnIt?',
    a: 'You run the job by text. Quote it, get it signed, send a booking link, and remind them before they show up. They tap a normal SMS — no app, no account.',
  },
  {
    q: 'Does my customer need an app?',
    a: 'No. They get a normal text and open a link in their phone’s browser. Nothing to install, no account to create, no email required.',
  },
  {
    q: 'How do they sign?',
    a: 'Sign-by-Text: we text a code to their phone, they draw their signature with a finger. Meets federal ESIGN Act requirements. Every signature includes a complete audit record. PinOnIt does not provide legal advice.',
  },
  {
    q: 'How do I get paid?',
    a: 'Paste your own Zelle, Cash App, Venmo, or PayPal link. After they approve, they see Pay Now. PinOnIt never takes the money. When you’ve got it, one tap on the quote texts a receipt.',
  },
  {
    q: 'What about no-shows?',
    a: 'Reminders go out by text, WhatsApp, email, or a voice call. They reply 1 to cancel or 2 to reschedule. That’s the phone-tag loop, closed.',
  },
  {
    q: 'Does it work with my calendar?',
    a: 'Yes. Google and Outlook stay in sync (including new bookings). Apple Calendar connects with a private iCloud link so busy times are blocked. You can import from Calendly if you’re switching.',
  },
  {
    q: 'Is it really $8.99 a month?',
    a: 'Yes. One plan. Free trial first.',
  },
];

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : i)}
            >
              <span>{item.q}</span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="px-5 pb-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
