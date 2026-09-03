import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { getPageHelp } from '../lib/pageHelp';
import {
  PRODUCT_CAN,
  PRODUCT_CANNOT,
  buildHelpContextPack,
  matchHelpFaq,
  suggestedQuestions,
} from '../lib/productHelpKnowledge';
import { supabase } from '../lib/supabase';

type Tab = 'howto' | 'ask';

type ChatMsg = { role: 'user' | 'assistant'; text: string };

export function PageHelpButton({ compact }: { compact?: boolean }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('howto');
  const guide = getPageHelp(location.pathname, location.search, location.hash);

  useEffect(() => {
    setOpen(false);
    setTab('howto');
  }, [location.pathname, location.search, location.hash]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors ${
          compact ? 'min-h-11 min-w-11' : 'min-h-9 px-3'
        }`}
        title="How to use this page"
      >
        <HelpCircle className="h-4 w-4 shrink-0" />
        {!compact && <span>How to</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-labelledby="page-help-title">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close how to"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-slate-800">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Help</p>
                <h2 id="page-help-title" className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {guide.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-gray-200 dark:border-slate-800 px-3 gap-1">
              <TabButton active={tab === 'howto'} onClick={() => setTab('howto')} icon={HelpCircle} label="How to" />
              <TabButton active={tab === 'ask'} onClick={() => setTab('ask')} icon={MessageCircle} label="Ask" />
            </div>

            {tab === 'howto' ? <HowToPanel guide={guide} onAsk={() => setTab('ask')} /> : <AskPanel guide={guide} />}
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof HelpCircle;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 text-sm font-semibold border-b-2 transition-colors ${
        active
          ? 'border-brand-600 text-brand-700 dark:text-brand-300'
          : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function HowToPanel({
  guide,
  onAsk,
}: {
  guide: ReturnType<typeof getPageHelp>;
  onAsk: () => void;
}) {
  const canDo = guide.canDo?.length ? guide.canDo : PRODUCT_CAN.slice(0, 3);
  const cannotDo = guide.cannotDo?.length ? guide.cannotDo : PRODUCT_CANNOT.slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">What this page is for</p>
        <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{guide.purpose}</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Set it up</p>
        <ol className="space-y-3">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
              <span className="shrink-0 h-6 w-6 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20 px-3.5 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1.5">
            Can do
          </p>
          <ul className="space-y-1.5">
            {canDo.map((item) => (
              <li key={item} className="text-sm text-gray-700 dark:text-slate-300 leading-snug flex gap-2">
                <span className="text-emerald-600 shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 px-3.5 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1.5">
            Cannot / limits
          </p>
          <ul className="space-y-1.5">
            {cannotDo.map((item) => (
              <li key={item} className="text-sm text-gray-700 dark:text-slate-300 leading-snug flex gap-2">
                <span className="text-amber-600 shrink-0">✗</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={onAsk}
        className="w-full min-h-11 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
      >
        Still stuck? Ask a question
      </button>
    </div>
  );
}

function AskPanel({ guide }: { guide: ReturnType<typeof getPageHelp> }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      text: 'Ask how to do something on this page. I only answer from PinOnIt help — not legal advice, and not guesses about features we do not have.',
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const suggestions = suggestedQuestions(guide);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setBusy(true);

    const faq = matchHelpFaq(q);
    if (faq) {
      setMessages((prev) => [...prev, { role: 'assistant', text: faq.answer }]);
      setBusy(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke<{ answer?: string; error?: string }>(
        'product-help-chat',
        {
          body: {
            question: q,
            pageTitle: guide.title,
            contextPack: buildHelpContextPack(guide),
          },
        },
      );
      if (error) throw error;
      const answer =
        data?.answer?.trim() ||
        data?.error ||
        'I could not answer that from the help notes. Try the How to tab, or rephrase with the page name (for example “send NDA” or “turn on reminders”).';
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Help chat is briefly unavailable. Use the How to tab for steps, or try again in a moment.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'ml-8 bg-brand-600 text-white'
                : 'mr-6 bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200'
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="mr-6 inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!busy && messages.length < 4 && (
        <div className="px-5 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="border-t border-gray-200 dark:border-slate-800 p-3 flex items-end gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. How do I send a waiver?"
          className="flex-1 min-h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
          disabled={busy}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-brand-600 text-white disabled:opacity-40 hover:bg-brand-700"
          aria-label="Send question"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      <p className="px-4 pb-3 text-[11px] text-gray-400 dark:text-slate-500 leading-snug">
        Answers use PinOnIt help only. Not legal advice.
      </p>
    </div>
  );
}
