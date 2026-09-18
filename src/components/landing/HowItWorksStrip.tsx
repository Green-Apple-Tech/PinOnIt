import { useEffect, useState } from 'react';
import { HOW_IT_WORKS_STEPS } from '../../lib/marketingLanding';
import { SmsPhoneMockup } from './SmsPhoneMockup';

const ADVANCE_MS = 3000;
const STEP_COUNT = HOW_IT_WORKS_STEPS.length;

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function HowItWorksStrip() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % STEP_COUNT);
    }, ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const go = (i: number) => setActive(i);

  return (
    <section
      id="how-it-works"
      className="py-16 md:py-20 px-4 sm:px-6 bg-white dark:bg-slate-950 scroll-mt-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-3">
          How it works
        </h2>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
          Book it. Remind it. Send it. Sign it. Pin it.
        </p>

        <div role="tablist" aria-label="How PinOnIt works" className="flex flex-wrap justify-center gap-2 mb-8">
          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const selected = i === active;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                id={`how-tab-${step.id}`}
                aria-selected={selected}
                aria-controls="how-screens"
                tabIndex={selected ? 0 : -1}
                onClick={() => go(i)}
                className={`px-3 py-2 rounded-full text-xs font-bold tracking-widest transition-colors ${
                  selected
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {step.label}
              </button>
            );
          })}
        </div>

        <div id="how-screens" className="overflow-hidden" aria-live="polite">
          <div
            className={`flex ${reduceMotion ? '' : 'transition-transform duration-500 ease-out'}`}
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div
                key={step.id}
                role="tabpanel"
                aria-labelledby={`how-tab-${step.id}`}
                className="min-w-full w-full shrink-0 px-1"
              >
                <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center max-w-5xl mx-auto">
                  <p className="text-2xl md:text-3xl lg:text-4xl font-semibold text-slate-800 dark:text-slate-100 leading-snug text-center md:text-left">
                    {step.scene}
                  </p>
                  <SmsPhoneMockup
                    messages={step.messages}
                    caption="A real text. Nothing to install on their phone."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
