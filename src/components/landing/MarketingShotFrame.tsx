import type { ReactNode } from 'react';

/** Rounded square behind a product shot — pale gray mixed with pale blue lights. */
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
      className={`relative rounded-[2.25rem] overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-brand-50 ${padding} shadow-lg shadow-slate-300/40 ${className}`}
    >
      <div className="pointer-events-none absolute -top-10 -left-8 h-44 w-44 rounded-full bg-brand-200/35 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute top-1/3 -right-10 h-40 w-40 rounded-full bg-brand-100/50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-12 left-1/4 h-36 w-36 rounded-full bg-slate-100/80 blur-3xl" aria-hidden="true" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
