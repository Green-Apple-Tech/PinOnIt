import {
  MONTH_NTH_OPTIONS,
  WEEKDAY_SHORT,
  type StandingFrequency,
} from '../lib/standingJobs';

export const FREQUENCY_OPTIONS: { key: StandingFrequency; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Every 2 weeks' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom', label: 'Custom' },
];

export function FrequencyPicker({
  value,
  intervalDays,
  onChange,
  size = 'md',
  advanced = false,
  weekdays,
  monthNth,
  onWeekdaysChange,
  onMonthNthChange,
}: {
  value: StandingFrequency | null;
  intervalDays?: number | null;
  onChange: (frequency: StandingFrequency, intervalDays: number | null) => void;
  size?: 'sm' | 'md';
  /** Host recurring jobs: Tue & Fri, first Monday, etc. Guest event types stay simple. */
  advanced?: boolean;
  weekdays?: number[] | null;
  monthNth?: number | null;
  onWeekdaysChange?: (days: number[]) => void;
  onMonthNthChange?: (nth: number | null) => void;
}) {
  const pad = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm';
  const days = Math.max(1, intervalDays ?? 1);
  const selectedDays = [...new Set(weekdays ?? [])].sort((a, b) => a - b);
  const showDays = advanced && (value === 'weekly' || value === 'biweekly');
  const showMonthly = advanced && value === 'monthly';

  const toggleDay = (dow: number) => {
    if (!onWeekdaysChange) return;
    const set = new Set(selectedDays);
    if (set.has(dow)) {
      if (set.size === 1) return;
      set.delete(dow);
    } else set.add(dow);
    onWeekdaysChange([...set].sort((a, b) => a - b));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {FREQUENCY_OPTIONS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key, f.key === 'custom' ? days : null)}
            className={`${pad} rounded-full font-semibold border min-h-[40px] transition-all ${
              value === f.key
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <label className="text-sm text-slate-600 dark:text-slate-300 block">
          Every
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => onChange('custom', Math.max(1, Number(e.target.value) || 1))}
            className="ml-2 w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
          />{' '}
          days
        </label>
      )}
      {showDays && (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Repeat on</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((label, dow) => {
              const on = selectedDays.includes(dow);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(dow)}
                  className={`w-9 h-9 rounded-full text-xs font-semibold border ${
                    on
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  aria-pressed={on}
                  aria-label={label}
                >
                  {label.slice(0, 2)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showMonthly && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onMonthNthChange?.(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                monthNth == null
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600'
              }`}
            >
              Same date each month
            </button>
            <button
              type="button"
              onClick={() => {
                onMonthNthChange?.(monthNth && monthNth !== 0 ? monthNth : 1);
                if (!selectedDays.length) onWeekdaysChange?.([1]);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                monthNth != null && monthNth !== 0
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600'
              }`}
            >
              On a weekday
            </button>
          </div>
          {monthNth != null && monthNth !== 0 && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {MONTH_NTH_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onMonthNthChange?.(o.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      monthNth === o.value
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_SHORT.map((label, dow) => {
                  const on = (selectedDays[0] ?? 1) === dow;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onWeekdaysChange?.([dow])}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        on
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
