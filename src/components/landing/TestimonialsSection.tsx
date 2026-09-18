import { LANDING_TESTIMONIALS } from '../../lib/marketingLanding';

export function TestimonialsSection() {
  if (LANDING_TESTIMONIALS.length === 0) return null;

  return (
    <section className="py-16 md:py-20 px-4 sm:px-6 bg-white dark:bg-slate-950">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">
          From the field
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LANDING_TESTIMONIALS.map((item) => (
            <article
              key={`${item.name}-${item.business}`}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6"
            >
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{item.metric}</p>
              <blockquote className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">
                “{item.quote}”
              </blockquote>
              <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                {item.name}
                {item.business ? `, ${item.business}` : ''}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
