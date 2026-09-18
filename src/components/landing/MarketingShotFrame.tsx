import type { ReactNode } from 'react';

/** Rounded square behind a product shot — light gray mixed with blue lights. */
export function MarketingShotFrame({
  children,
  className = '',
  padding = 'p-5 sm:p-7',
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`relative rounded-[2.25rem] overflow-hidden bg-gradient-to-br from-slate-100 via-slate-200 to-brand-200 ${padding} shadow-xl shadow-slate-400/30 ${className}`}
    >
      <div className="pointer-events-none absolute -top-10 -left-8 h-44 w-44 rounded-full bg-brand-300/55 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute top-1/3 -right-10 h-40 w-40 rounded-full bg-brand-400/40 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-12 left-1/4 h-36 w-36 rounded-full bg-brand-200/70 blur-3xl" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0 18px, rgba(88,101,198,0.35) 18px 19px)',
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
