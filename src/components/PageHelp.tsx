import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, X } from 'lucide-react';
import { getPageHelp } from '../lib/pageHelp';

export function PageHelpButton({ compact }: { compact?: boolean }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const guide = getPageHelp(location.pathname, location.search, location.hash);

  useEffect(() => {
    setOpen(false);
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
                <p className="text-xs font-bold uppercase tracking-widest text-brand-600">How to</p>
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
