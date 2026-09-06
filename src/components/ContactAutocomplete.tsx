import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search, UserRound } from 'lucide-react';
import {
  hostHasSyncedContactSources,
  searchSyncedContacts,
  toContactPickerSelection,
  type ContactPickerSelection,
  type PickerContact,
} from '../lib/contactPicker';

type Props = {
  hostId: string | undefined;
  onSelect: (contact: ContactPickerSelection) => void;
  /** Extra classes for the outer wrapper. */
  className?: string;
  /** Match surrounding form field styling. */
  inputClassName?: string;
  placeholder?: string;
};

export function ContactAutocomplete({
  hostId,
  onSelect,
  className = '',
  inputClassName,
  placeholder = 'Search Gmail / Outlook contacts…',
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickerContact[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!hostId) {
      setEnabled(false);
      return;
    }
    let cancelled = false;
    void hostHasSyncedContactSources(hostId).then((ok) => {
      if (!cancelled) setEnabled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [hostId]);

  useEffect(() => {
    if (!enabled || !hostId) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      void searchSyncedContacts(hostId, q).then((rows) => {
        if (cancelled) return;
        setResults(rows);
        setHighlight(0);
        setOpen(rows.length > 0);
        setLoading(false);
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, hostId, enabled]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!enabled || !hostId) return null;

  const pick = (c: PickerContact) => {
    onSelect(toContactPickerSelection(c));
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const defaultInput =
    'w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-9 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="block">
        <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Find in contacts</span>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (!open || results.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((h) => (h + 1) % results.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => (h - 1 + results.length) % results.length);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                pick(results[highlight]);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={placeholder}
            className={inputClassName ?? defaultInput}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
          )}
        </div>
      </label>

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg"
        >
          {results.map((c, i) => {
            const label = c.full_name?.trim() || c.email;
            const meta = [c.email, c.phone, c.company].filter(Boolean).join(' · ');
            const sourceLabel = c.source === 'outlook' ? 'Outlook' : 'Gmail';
            return (
              <li key={c.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition ${
                    i === highlight
                      ? 'bg-brand-50 dark:bg-brand-500/10'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(c)}
                >
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-gray-900 dark:text-white truncate">{label}</span>
                    {meta && (
                      <span className="block text-xs text-gray-500 dark:text-slate-400 truncate">{meta}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {sourceLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && !loading && query.trim() && results.length === 0 && (
        <p className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-500 shadow-lg">
          No synced contacts match.
        </p>
      )}
    </div>
  );
}
