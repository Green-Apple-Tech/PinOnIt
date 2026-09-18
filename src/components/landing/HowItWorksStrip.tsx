import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { HOW_IT_WORKS_STEPS, type HowItWorksCalendar, type HowItWorksMessage, type HowItWorksStep } from '../../lib/marketingLanding';
import { MarketingShotFrame } from './MarketingShotFrame';
import './HowItWorksStrip.css';

const PHONE_CAPTION = 'A real text. Nothing to install on their phone.';

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function supportsScrollDriven() {
  try {
    return CSS.supports('animation-timeline: view()') && CSS.supports('timeline-scope: none');
  } catch {
    return false;
  }
}

function isDesktopMq() {
  try {
    return window.matchMedia('(min-width: 768px)').matches;
  } catch {
    return false;
  }
}

function timelineName(id: string) {
  return `--hiw-${id}`;
}

function coverRange(index: number, count: number): string {
  const start0 = 16;
  const span = 62;
  const step = span / Math.max(count, 1);
  const start = start0 + index * step * 0.82;
  const end = Math.min(start + step + 10, 92);
  return `cover ${start.toFixed(1)}% cover ${end.toFixed(1)}%`;
}

function beatStyle(scrollDriven: boolean, timeline: string | undefined, index: number, count: number): CSSProperties | undefined {
  if (!scrollDriven || !timeline) return undefined;
  return { animationTimeline: timeline, animationRange: coverRange(index, count) } as CSSProperties;
}

function CalendarScreen({
  calendar,
  timeline,
  scrollDriven,
}: {
  calendar: HowItWorksCalendar;
  timeline?: string;
  scrollDriven: boolean;
}) {
  const beats = 5;
  return (
    <div className="h-full overflow-y-auto text-slate-800">
      <div className="hiw-msg" style={beatStyle(scrollDriven, timeline, 0, beats)}>
        <p className="text-[11px] font-bold text-slate-900 leading-tight">{calendar.eventName}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{calendar.duration}</p>
      </div>

      <p className="hiw-msg mt-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400" style={beatStyle(scrollDriven, timeline, 1, beats)}>
        Select a date
      </p>
      <div className="hiw-msg mt-1.5 flex gap-1.5" style={beatStyle(scrollDriven, timeline, 1, beats)}>
        {calendar.dates.map((d) => (
          <div
            key={`${d.dow}-${d.day}`}
            className={`flex-1 min-w-0 rounded-xl border px-1 py-1.5 text-center ${
              d.selected
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <p className={`text-[8px] font-semibold uppercase tracking-wide ${d.selected ? 'text-white/80' : 'text-slate-400'}`}>
              {d.dow}
            </p>
            <p className="text-sm font-bold leading-none mt-0.5">{d.day}</p>
            <p className={`text-[8px] mt-0.5 ${d.selected ? 'text-white/80' : 'text-slate-400'}`}>{d.month}</p>
          </div>
        ))}
      </div>

      <p
        className="hiw-msg mt-3 text-[9px] font-bold uppercase tracking-wide text-slate-700"
        style={beatStyle(scrollDriven, timeline, 2, beats)}
      >
        {calendar.heading}
      </p>
      <div className="hiw-msg mt-1.5 grid grid-cols-3 gap-1.5" style={beatStyle(scrollDriven, timeline, 3, beats)}>
        {calendar.times.map((t) => (
          <div
            key={t.label}
            className={`rounded-lg border px-1 py-1.5 text-center text-[10px] font-semibold ${
              t.selected
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {t.label}
          </div>
        ))}
      </div>

      <p className="hiw-msg mt-2 text-[10px] text-slate-500" style={beatStyle(scrollDriven, timeline, 4, beats)}>
        {calendar.timezone}
      </p>
      <p className="hiw-check mt-2 flex justify-end" style={beatStyle(scrollDriven, timeline, 4, beats)}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-bold leading-none">
          ✓
        </span>
      </p>
    </div>
  );
}

function StepScreen({
  step,
  timeline,
  scrollDriven,
}: {
  step: HowItWorksStep;
  timeline?: string;
  scrollDriven: boolean;
}) {
  if (step.screen === 'calendar' && step.calendar) {
    return <CalendarScreen calendar={step.calendar} timeline={timeline} scrollDriven={scrollDriven} />;
  }
  return <ThreadMessages messages={step.messages} timeline={timeline} scrollDriven={scrollDriven} />;
}

function ThreadMessages({
  messages,
  timeline,
  scrollDriven,
}: {
  messages: HowItWorksMessage[];
  timeline?: string;
  scrollDriven: boolean;
}) {
  const beats = messages.length + 1;
  return (
    <>
      {messages.map((msg, i) => {
        const isCustomer = msg.role === 'customer';
        const range = scrollDriven && timeline ? coverRange(i, beats) : undefined;
        const style = (scrollDriven && timeline
          ? { animationTimeline: timeline, animationRange: range }
          : undefined) as CSSProperties | undefined;
        if (msg.role === 'system') {
          return (
            <p key={i} className="hiw-msg text-center text-[10px] text-slate-500 py-1" style={style}>
              {msg.text}
            </p>
          );
        }
        return (
          <div key={i} className={`hiw-msg flex ${isCustomer ? 'justify-end' : 'justify-start'}`} style={style}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-snug ${
                isCustomer ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-slate-200 text-slate-800 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        );
      })}
      <p
        className="hiw-check mt-2 flex justify-end"
        style={
          (scrollDriven && timeline
            ? { animationTimeline: timeline, animationRange: coverRange(messages.length, beats) }
            : undefined) as CSSProperties | undefined
        }
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-bold leading-none">
          ✓
        </span>
      </p>
    </>
  );
}

function PhoneChrome({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div
      className={`rounded-[1.65rem] border-[5px] border-slate-900 bg-slate-50 overflow-hidden shadow-lg ${
        compact ? 'w-full max-w-[16rem]' : 'w-full max-w-[19rem] sm:max-w-[21rem]'
      }`}
    >
      <div className="h-6 bg-slate-900 flex items-center justify-center">
        <div className="h-1 w-16 rounded-full bg-slate-500" />
      </div>
      <div className={`relative px-3.5 py-3 ${compact ? 'min-h-[260px]' : 'min-h-[320px]'}`}>
        {children}
      </div>
    </div>
  );
}

function StepCopy({ step }: { step: HowItWorksStep }) {
  return (
    <>
      <p className="text-xs font-bold tracking-widest text-brand-600 dark:text-brand-400 mb-3">{step.label}</p>
      <h3 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-slate-800 dark:text-slate-100 leading-snug">
        {step.scene}
      </h3>
    </>
  );
}

export function HowItWorksStrip() {
  const headingId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [engine, setEngine] = useState<'io' | 'scroll'>('io');
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeId, setActiveId] = useState(HOW_IT_WORKS_STEPS[0].id);
  const [inViewIds, setInViewIds] = useState<string[]>([]);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    setReduceMotion(reduced);
    setEngine(!reduced && supportsScrollDriven() ? 'scroll' : 'io');
    setIsDesktop(isDesktopMq());

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 768px)');
    const onMotion = () => {
      const next = prefersReducedMotion();
      setReduceMotion(next);
      setEngine(!next && supportsScrollDriven() ? 'scroll' : 'io');
    };
    const onDesktop = () => setIsDesktop(desktop.matches);
    motion.addEventListener('change', onMotion);
    desktop.addEventListener('change', onDesktop);
    return () => {
      motion.removeEventListener('change', onMotion);
      desktop.removeEventListener('change', onDesktop);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observers: IntersectionObserver[] = [];

    if (isDesktop) {
      const steps = root.querySelectorAll<HTMLElement>('[data-hiw-step]');
      const io = new IntersectionObserver(
        (entries) => {
          const hit = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (hit) {
            const id = hit.target.getAttribute('data-hiw-step');
            if (id) setActiveId(id);
          }
        },
        { threshold: [0.25, 0.45, 0.6, 0.8], rootMargin: '-28% 0px -28% 0px' },
      );
      steps.forEach((el) => io.observe(el));
      observers.push(io);
    } else {
      const cards = root.querySelectorAll<HTMLElement>('[data-hiw-card]');
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const id = entry.target.getAttribute('data-hiw-card');
            if (id) {
              setInViewIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.35 },
      );
      cards.forEach((el) => io.observe(el));
      observers.push(io);
    }

    return () => observers.forEach((o) => o.disconnect());
  }, [engine, reduceMotion, isDesktop]);

  const modeClass = reduceMotion ? 'hiw-static' : engine === 'scroll' ? 'hiw-scroll' : 'hiw-io';
  const desktopScope = HOW_IT_WORKS_STEPS.map((s) => timelineName(s.id)).join(', ');
  const scrollDriven = engine === 'scroll' && !reduceMotion;
  const activeStep = HOW_IT_WORKS_STEPS.find((s) => s.id === activeId) ?? HOW_IT_WORKS_STEPS[0];

  return (
    <section
      ref={rootRef}
      id="how-it-works"
      className={`py-16 md:py-20 px-4 sm:px-6 bg-white dark:bg-slate-950 scroll-mt-28 ${modeClass}`}
      aria-labelledby={headingId}
    >
      <div className="max-w-6xl mx-auto">
        <h2 id={headingId} className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-3">
          How it works
        </h2>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-10 md:mb-4 max-w-2xl mx-auto">
          Book it. Remind it. Send it. Sign it. Pin it.
        </p>

        <div
          className="hiw-desktop hidden md:grid md:grid-cols-2 gap-10 lg:gap-14 items-start"
          style={{ timelineScope: desktopScope } as CSSProperties}
        >
          <div>
            {HOW_IT_WORKS_STEPS.map((step) => (
              <article
                key={step.id}
                data-hiw-step={step.id}
                className="min-h-[100svh] flex flex-col justify-center py-10"
                style={{ viewTimelineName: timelineName(step.id) } as CSSProperties}
                aria-current={activeId === step.id ? 'step' : undefined}
              >
                <StepCopy step={step} />
              </article>
            ))}
          </div>

          <div className="relative min-h-full">
            <div className="sticky top-24 h-[calc(100svh-6rem)] flex items-center justify-center">
              <div className="w-full max-w-sm sm:max-w-md mx-auto">
                <MarketingShotFrame padding="p-6 sm:p-8">
                  <div className="flex flex-col items-center gap-4">
                    <PhoneChrome>
                      {HOW_IT_WORKS_STEPS.map((step) => {
                        const tl = timelineName(step.id);
                        return (
                          <div
                            key={step.id}
                            className={`hiw-thread pointer-events-none absolute inset-0 space-y-2 ${
                              activeId === step.id ? 'is-active' : ''
                            }`}
                            style={
                              (scrollDriven
                                ? {
                                    animationTimeline: tl,
                                    animationRange: 'cover 8% cover 92%',
                                  }
                                : undefined) as CSSProperties | undefined
                            }
                            aria-hidden={activeId === step.id ? undefined : true}
                          >
                            <StepScreen step={step} timeline={tl} scrollDriven={scrollDriven} />
                          </div>
                        );
                      })}
                    </PhoneChrome>
                    <p className="text-center text-sm sm:text-base font-medium text-slate-600 leading-snug px-2">
                      {activeStep.caption ?? PHONE_CAPTION}
                    </p>
                  </div>
                </MarketingShotFrame>
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden space-y-8">
          {HOW_IT_WORKS_STEPS.map((step) => {
            const tl = `--hiw-m-${step.id}`;
            const seen = reduceMotion || inViewIds.includes(step.id);
            return (
              <article
                key={step.id}
                data-hiw-card={step.id}
                className={`hiw-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-5 ${
                  seen ? 'is-inview' : ''
                }`}
                style={{ viewTimelineName: tl, timelineScope: tl } as CSSProperties}
              >
                <StepCopy step={step} />
                <div className="mt-5 flex justify-center">
                  <PhoneChrome compact>
                    <div className={`hiw-thread space-y-2 ${seen ? 'is-active' : ''}`}>
                      <StepScreen step={step} timeline={tl} scrollDriven={scrollDriven} />
                    </div>
                  </PhoneChrome>
                </div>
                <p className="mt-3 text-center text-xs font-medium text-slate-500">{step.caption ?? PHONE_CAPTION}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
