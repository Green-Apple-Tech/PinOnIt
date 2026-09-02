import { Check, X } from 'lucide-react';
import { LANDING_COMP_ROWS, type LandingCompRow } from '../../lib/landingComparisonData';

function CompCell({ val }: { val: boolean | string | undefined }) {
  return (
    <div className="p-3.5 text-center flex items-center justify-center">
      {val === true
        ? <Check className="h-4 w-4 text-indigo-600" />
        : val === false
          ? <X className="h-4 w-4 text-slate-300 dark:text-slate-600" />
          : <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-500 leading-tight">{val}</span>}
    </div>
  );
}

export function LandingComparisonTable({ rows = LANDING_COMP_ROWS }: { rows?: LandingCompRow[] }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-2xl shadow-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden min-w-[560px]">
        <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Feature</div>
          <div className="p-4 text-center">
            <span className="font-bold text-indigo-600 dark:text-indigo-500 text-sm">PinOnIt</span>
            <div className="text-indigo-600 text-xs font-semibold mt-0.5">from $8.99/mo</div>
          </div>
          <div className="p-4 text-center">
            <span className="font-semibold text-slate-500 dark:text-slate-400 text-sm">Calendly</span>
            <div className="text-red-400 text-xs font-semibold mt-0.5">from $16/mo</div>
          </div>
          <div className="p-4 text-center">
            <span className="font-semibold text-slate-500 dark:text-slate-400 text-sm">Acuity</span>
            <div className="text-red-400 text-xs font-semibold mt-0.5">from $20/mo</div>
          </div>
        </div>

        {rows.map((row, i) => {
          if (row.section) {
            return (
              <div key={row.section} className="grid grid-cols-4 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                <div className="col-span-4 px-4 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {row.section}
                </div>
              </div>
            );
          }
          const isLast = i === rows.length - 1;
          const wins = row.pinonit !== false && (row.calendly === false || row.acuity === false);
          return (
            <div
              key={row.feature}
              className={`grid grid-cols-4 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors ${
                !isLast ? 'border-b border-slate-100 dark:border-slate-800/50' : ''
              }`}
            >
              <div className="p-3.5 pl-4 text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                {wins && <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />}
                {row.feature}
              </div>
              <CompCell val={row.pinonit} />
              <CompCell val={row.calendly} />
              <CompCell val={row.acuity} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
