import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, Smartphone, UserRound, Users, X } from 'lucide-react';
import { formatPhoneDisplay } from '../lib/phone';
import {
  canSelectDeviceContacts,
  contactFillPreview,
  contactHasPhone,
  contactSourceLabel,
  searchHostContacts,
  selectDeviceContact,
  toContactPickerSelection,
  type ContactPickerSelection,
  type PickerContact,
} from '../lib/contactPicker';

type Props = {
  hostId: string | undefined;
  onSelect: (contact: ContactPickerSelection) => void;
  /** Called when the confirmed chip is cleared. */
  onClear?: () => void;
  /** Extra classes for the outer wrapper. */
  className?: string;
  /** Match surrounding form field styling. */
  inputClassName?: string;
  placeholder?: string;
};

const BROWSE_LIMIT = 80;

export function ContactAutocomplete({
  hostId,
  onSelect,
  onClear,
  className = '',
  inputClassName,
  placeholder = 'Name, phone, or email…',
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickerContact[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseRows, setBrowseRows] = useState<PickerContact[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [selected, setSelected] = useState<ContactPickerSelection | null>(null);
  const devicePicker = canSelectDeviceContacts();

  useEffect(() => {
    if (hostId) void searchHostContacts(hostId, '', 1);
  }, [hostId]);

  useEffect(() => {
    if (!hostId) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      void searchHostContacts(hostId, q, 8).then((rows) => {
        if (cancelled) return;
        setResults(rows);
        setHighlight(0);
        setOpen(true);
        setLoading(false);
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, hostId]);

  useEffect(() => {
    if (!browseOpen || !hostId) return;
    let cancelled = false;
    setBrowseLoading(true);
    const t = window.setTimeout(() => {
      void searchHostContacts(hostId, browseQuery, BROWSE_LIMIT).then((rows) => {
        if (cancelled) return;
        setBrowseRows(rows);
        setBrowseLoading(false);
      });
    }, browseQuery.trim() ? 180 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [browseOpen, browseQuery, hostId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!browseOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBrowseOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [browseOpen]);

  if (!hostId) return null;

  const applySelection = (sel: ContactPickerSelection) => {
    setSelected(sel);
    onSelect(sel);
    setQuery('');
    setResults([]);
    setOpen(false);
    setBrowseOpen(false);
    setBrowseQuery('');
  };

  const pick = (c: PickerContact) => {
    applySelection(toContactPickerSelection(c));
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery('');
    onClear?.();
  };

  const pickFromPhone = async () => {
    const sel = await selectDeviceContact();
    if (sel) applySelection(sel);
  };

  const defaultInput =
    'w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-9 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {selected ? (
        <div>
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Chosen contact</span>
          <div className="mt-1 flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/20 px-3 py-2.5">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {selected.fullName || selected.email || 'Contact'}
              </p>
              <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                {[
                  selected.phone || 'No mobile',
                  selected.email,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
              aria-label="Clear selected contact"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <label className="block min-w-0 flex-1">
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
          <button
            type="button"
            onClick={() => {
              setBrowseQuery('');
              setBrowseOpen(true);
            }}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <Users className="h-4 w-4" />
            Browse
          </button>
        </div>
      )}

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg"
        >
          {results.map((c, i) => (
            <ContactResultRow
              key={c.id}
              contact={c}
              active={i === highlight}
              onHover={() => setHighlight(i)}
              onPick={() => pick(c)}
            />
          ))}
        </ul>
      )}

      {open && !loading && query.trim() && results.length === 0 && (
        <p className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-500 shadow-lg">
          No contacts match. Try Browse, or type the name and phone below.
        </p>
      )}

      {browseOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" role="presentation" onClick={() => setBrowseOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="browse-contacts-title"
            className="w-full sm:max-w-md max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
              <h2 id="browse-contacts-title" className="text-base font-bold text-gray-900 dark:text-white">
                Browse contacts
              </h2>
              <button
                type="button"
                onClick={() => setBrowseOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 pb-3 space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  type="search"
                  value={browseQuery}
                  onChange={(e) => setBrowseQuery(e.target.value)}
                  placeholder="Search your list…"
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2.5 text-sm"
                />
              </div>
              {devicePicker && (
                <button
                  type="button"
                  onClick={() => void pickFromPhone()}
                  className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-200"
                >
                  <Smartphone className="h-4 w-4" />
                  Choose from this phone
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto border-t border-gray-100 dark:border-slate-800">
              {browseLoading ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Loading…
                </p>
              ) : browseRows.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500 space-y-2">
                  <p>No contacts in PinOnIt yet.</p>
                  <p>
                    <Link to="/dashboard/settings?tab=contacts" className="font-semibold text-brand-600" onClick={() => setBrowseOpen(false)}>
                      Add people in Contacts
                    </Link>
                    {' '}or type a name and phone on this screen.
                  </p>
                </div>
              ) : (
                <ul>
                  {browseRows.map((c) => (
                    <ContactResultRow key={c.id} contact={c} onPick={() => pick(c)} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactResultRow({
  contact,
  active,
  onHover,
  onPick,
}: {
  contact: PickerContact;
  active?: boolean;
  onHover?: () => void;
  onPick: () => void;
}) {
  const label = contact.full_name?.trim() || contact.email || contact.phone || 'Contact';
  const hasPhone = contactHasPhone(contact);
  const fill = contactFillPreview(contact);
  const phoneLabel = hasPhone
    ? (formatPhoneDisplay(contact.phone!) || contact.phone)
    : 'No mobile';
  const emailLabel = (contact.email ?? '').trim() || null;

  const pickNow = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onPick();
  };

  return (
    <li role="option" aria-selected={!!active}>
      <button
        type="button"
        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition ${
          active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800'
        } ${hasPhone ? '' : 'opacity-70'}`}
        onMouseEnter={onHover}
        onPointerDown={(e) => {
          e.preventDefault();
        }}
        onClick={pickNow}
      >
        <UserRound className={`mt-0.5 h-4 w-4 shrink-0 ${hasPhone ? 'text-gray-400' : 'text-amber-500'}`} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-gray-900 dark:text-white truncate">{label}</span>
          <span className="block text-xs text-gray-500 dark:text-slate-400 truncate">
            {phoneLabel}
            {emailLabel ? ` · ${emailLabel}` : ''}
          </span>
          <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-slate-500">
            {fill.length > 0 ? `Will fill: ${fill.join(' · ')}` : 'No name, phone, or email to fill'}
            {!hasPhone ? ' · add a number after you pick' : ''}
          </span>
        </span>
        <span className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {contactSourceLabel(contact.source)}
          </span>
          {!hasPhone && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              No mobile
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
