import { Trash2 } from 'lucide-react';
import type { HostQuoteLineItem } from '../lib/types';

const inputClass =
  'rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-3 text-base min-h-12 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500';

type Props = {
  item: HostQuoteLineItem;
  onChange: (next: HostQuoteLineItem) => void;
  onRemove?: () => void;
  canRemove: boolean;
};

export function QuoteLineItemRow({ item, onChange, onRemove, canRemove }: Props) {
  return (
    <div className="flex flex-row items-center gap-2">
      <input
        value={item.description}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
        className={`${inputClass} min-w-0 flex-1 px-3`}
        placeholder="Description"
        aria-label="Description"
      />
      <div className="relative w-[6.75rem] shrink-0">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={item.amount || ''}
          onChange={(e) => onChange({ ...item, amount: Number(e.target.value) || 0 })}
          className={`${inputClass} w-full pl-6 pr-2`}
          placeholder="0.00"
          aria-label="Amount"
        />
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 min-w-11 min-h-12 text-gray-400"
          aria-label="Remove line"
        >
          <Trash2 className="h-5 w-5 mx-auto" />
        </button>
      )}
    </div>
  );
}
