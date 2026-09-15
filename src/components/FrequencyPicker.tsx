import type { StandingFrequency } from '../lib/standingJobs';

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
}: {
  value: StandingFrequency | null;
  intervalDays?: number | null;
  onChange: (frequency: StandingFrequency, intervalDays: number | null) => void;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm';
  const days = Math.max(1, intervalDays ?? 1);
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
    </div>
  );
}
