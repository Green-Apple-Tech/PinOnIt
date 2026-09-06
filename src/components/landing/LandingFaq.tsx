import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'Does my customer need an app?',
    a: 'No. They get a normal text message and open a link in their phone\'s browser. Nothing to install, no account to create.',
  },
  {
    q: 'Do I need DocuSign or anything else?',
    a: 'No. Sign by Text covers waivers, NDAs, addendums, contracts, quotes, invoices, and receipts — all inside PinOnIt.',
  },
  {
    q: 'What does my customer actually see?',
    a: 'A text from your PinOnIt number with a short link. They tap it, see the document or booking page, and sign, approve, or pick a time. Most people finish in about 10 seconds.',
  },
  {
    q: 'How do you verify who signed?',
    a: 'Their phone number is verified with a one-time SMS code (2FA) before they sign. Every signature includes a complete audit record — including timestamps, IP and device info, the signature image, consent text, document hash, and a unique document ID. Meets federal ESIGN Act requirements for electronic signatures.',
  },
  {
    q: 'Does it work with my calendar?',
    a: 'Yes — Google Calendar, plus import from Calendly if you\'re switching.',
  },
  {
    q: 'Is it really $8.99 a month?',
    a: 'Yes. One plan — booking, Sign by Text, reminders, docs, QR codes, and more. Free trial first.',
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
