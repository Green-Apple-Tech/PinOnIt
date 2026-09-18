import type { ReactNode } from 'react';

/** Darker rounded square behind a product shot — marketing pages only. */
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
      className={`relative rounded-[2.25rem] overflow-hidden bg-gradient-to-br from-brand-400 via-brand-600 to-brand-900 ${padding} shadow-2xl shadow-brand-900/25 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,0.35) 18px 19px)',
        }}
      />
      <div className="pointer-events-none absolute -top-16 -left-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
