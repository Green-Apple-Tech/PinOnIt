import { WORKS_WITH_CAPTION, WORKS_WITH_LABELS } from '../../lib/marketingLanding';

export function WorksWithRow() {
  return (
    <section className="py-10 px-4 sm:px-6 bg-white dark:bg-slate-950">
      <div className="max-w-6xl mx-auto">
        <h2 className="sr-only">Works with</h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          {WORKS_WITH_LABELS.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          {WORKS_WITH_CAPTION}
        </p>
      </div>
    </section>
  );
}
