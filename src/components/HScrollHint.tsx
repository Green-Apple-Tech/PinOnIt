import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Horizontal chip row with arrows and edge fades so extra dates are obvious. */
export function HScrollHint({
  children,
  alwaysShowArrows = false,
}: {
  children: ReactNode;
  alwaysShowArrows?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [can, setCan] = useState({ left: false, right: alwaysShowArrows });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCan({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const id = window.requestAnimationFrame(update);
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      window.cancelAnimationFrame(id);
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [update, children]);

  const overflow = alwaysShowArrows || can.left || can.right;
  const scroll = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {can.left && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 z-[1] bg-gradient-to-r from-white dark:from-slate-900 to-transparent" />
      )}
      {can.right && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 z-[1] bg-gradient-to-l from-white dark:from-slate-900 to-transparent" />
      )}
      {overflow && (
        <button
          type="button"
          aria-label="Earlier dates"
          disabled={!can.left}
          onClick={() => scroll(-1)}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center ${
            can.left ? 'text-slate-700 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600'
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div
        ref={ref}
        className={`overflow-x-auto scroll-smooth pb-1 ${overflow ? 'px-9' : 'px-1'}`}
      >
        {children}
      </div>
      {overflow && (
        <button
          type="button"
          aria-label="Later dates"
          disabled={!can.right}
          onClick={() => scroll(1)}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center ${
            can.right ? 'text-slate-700 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600'
          }`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
