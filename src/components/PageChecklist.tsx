import { useState, type MouseEvent } from 'react';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storageGet, storageSet } from '../lib/safeStorage';

export interface ChecklistItem {
  id: string;
  label: string;
  why: string;
  done: boolean;
  to?: string;
  action?: () => void;
}

interface PageChecklistProps {
  items: ChecklistItem[];
  title?: string;
  storageKey: string;
}

export function PageChecklist({ items, title = 'Get Started', storageKey }: PageChecklistProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => storageGet(storageKey + '_open') === '0');
  const [dismissed, setDismissed] = useState(() => storageGet(storageKey + '_dismissed') === '1');

  const allDone = items.every(i => i.done);
  const doneCount = items.filter(i => i.done).length;

  if (dismissed) return null;

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    storageSet(storageKey + '_open', next ? '0' : '1');
  };

  const handleDismiss = (e: MouseEvent) => {
    e.stopPropagation();
    storageSet(storageKey + '_dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className={`mb-5 rounded-2xl border overflow-hidden transition-all ${
      allDone
        ? 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/20'
        : 'border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/10'
    }`}>
      <div className="w-full flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="flex items-center gap-2.5 min-w-0 text-left flex-1"
        >
          {allDone ? (
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 shrink-0">
              <Check className="h-3 w-3 text-white" />
            </span>
          ) : (
            <div className="flex gap-0.5 items-center shrink-0">
              {items.map((item, i) => (
                <div key={i} className={`h-2 w-2 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              ))}
            </div>
          )}
          <span className={`text-sm font-semibold ${allDone ? 'text-indigo-700 dark:text-indigo-500' : 'text-amber-800 dark:text-amber-300'}`}>
            {allDone ? `${title} — all done!` : `${title} — ${doneCount} of ${items.length} done`}
          </span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            title="Don't show this again"
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="p-1 text-slate-400"
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={`border-t divide-y ${
          allDone
            ? 'border-indigo-200 dark:border-indigo-800/50 divide-indigo-100 dark:divide-indigo-900/30'
            : 'border-amber-200 dark:border-amber-800/40 divide-amber-100 dark:divide-amber-900/20'
        }`}>
          {items.map(item => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                !item.done && (item.to || item.action)
                  ? 'cursor-pointer hover:bg-white/60 dark:hover:bg-white/5'
                  : ''
              }`}
              onClick={() => {
                if (item.done) return;
                if (item.action) item.action();
                else if (item.to) navigate(item.to);
              }}
            >
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                item.done
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-slate-300 dark:border-slate-600'
              }`}>
                {item.done && <Check className="h-3.5 w-3.5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{item.why}</p>
              </div>
              {!item.done && (item.to || item.action) && (
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">→</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
