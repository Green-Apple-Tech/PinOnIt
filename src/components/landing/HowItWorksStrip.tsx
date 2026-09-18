import { useEffect, useState } from 'react';
import { HOW_IT_WORKS_STEPS } from '../../lib/marketingLanding';
import { SmsPhoneMockup } from './SmsPhoneMockup';

const ADVANCE_MS = 5000;

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export function HowItWorksStrip() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % HOW_IT_WORKS_STEPS.length);
    }, ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <section
      id="how-it-works"
      className="py-16 md:py-20 px-4 sm:px-6 bg-white dark:bg-slate-950 scroll-mt-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-3">
          How it works
        </h2>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
          Book it. Remind it. Send it. Sign it. Pin it.
        </p>

        <div className="md:hidden space-y-3">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <article
              key={step.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4"
            >
              <h3 className="text-xs font-bold tracking-widest text-brand-600 dark:text-brand-400">
                {step.label}
              </h3>
              <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-200">{step.scene}</p>
            </article>
          ))}
        </div>

        <div className="hidden md:grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div role="tablist" aria-label="How PinOnIt works" className="flex flex-wrap gap-2 mb-6">
              {HOW_IT_WORKS_STEPS.map((step, i) => {
                const selected = i === active;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    id={`how-tab-${step.id}`}
                    aria-selected={selected}
                    aria-controls={`how-panel-${step.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(i)}
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
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div
                key={step.id}
                role="tabpanel"
                id={`how-panel-${step.id}`}
                aria-labelledby={`how-tab-${step.id}`}
                hidden={i !== active}
                className={i === active ? 'block' : 'hidden'}
              >
                <p className="text-lg font-medium text-slate-800 dark:text-slate-100 leading-snug">
                  {step.scene}
                </p>
              </div>
            ))}
          </div>
          <div>
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div key={step.id} className={i === active ? 'block' : 'hidden'} aria-hidden={i !== active}>
                <SmsPhoneMockup
                  messages={step.messages}
                  caption={i === active ? 'A real text. Nothing to install on their phone.' : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
