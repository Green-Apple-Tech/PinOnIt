import type { ReactNode } from 'react';

/** Rounded square behind a product shot — light blue fading to gray. */
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
      className={`relative rounded-[2.25rem] overflow-hidden bg-gradient-to-br from-brand-300 to-slate-200 ${padding} shadow-lg shadow-brand-300/30 ${className}`}
    >
      <div className="pointer-events-none absolute -top-8 -left-6 h-40 w-40 rounded-full bg-brand-200/50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-10 -right-8 h-40 w-40 rounded-full bg-slate-100/80 blur-3xl" aria-hidden="true" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
