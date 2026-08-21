import { Link } from 'react-router-dom';
import { ArrowRight, Check, X, DollarSign, Sun, Moon } from 'lucide-react';
import { Footer } from '../components/Footer';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import { WHY_PINONIT, CALENDLY_EXCLUSIVES, type CompareValue } from '../lib/whyPinonit';

function CellValue({ value, emphasize }: { value: CompareValue; emphasize?: boolean }) {
  if (value === true) {
    return (
      <span className={`inline-flex items-center justify-center ${emphasize ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
        <Check className="h-5 w-5" strokeWidth={2.5} aria-label="Yes" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center text-slate-300 dark:text-slate-600">
        <X className="h-5 w-5" strokeWidth={2.25} aria-label="No" />
      </span>
    );
  }
  const isMoney = /^\$/.test(value);
  return (
    <span className={`inline-flex items-center justify-center gap-0.5 text-sm font-semibold ${emphasize ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
      {isMoney ? <DollarSign className="h-4 w-4 shrink-0" aria-hidden /> : null}
      {isMoney ? value.replace(/^\$/, '') : value}
    </span>
  );
}

export function WhyPinOnItPage() {
  const { theme, toggleTheme } = useTheme();
  usePageMeta({
    title: WHY_PINONIT.seoTitle,
    description: WHY_PINONIT.seoDescription,
    url: WHY_PINONIT.canonical,
    image: WHY_PINONIT.ogImage,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img src="/pinonit_logo.png" alt="PinOnIt" className="h-11 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login" className="hidden sm:inline px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
              Log in
            </Link>
            <Link to="/signup" className="inline-flex items-center gap-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full transition-colors">
              {WHY_PINONIT.trialCta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="px-6 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-4">
            Calendly alternative for small business
          </p>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] max-w-4xl mx-auto">
            {WHY_PINONIT.heroHeadline}
          </h1>
          <p className="mt-5 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {WHY_PINONIT.heroSubhead}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full transition-colors"
            >
              {WHY_PINONIT.trialCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400">{WHY_PINONIT.priceLine}</p>
          </div>
        </section>

        <section className="px-6 pb-16" aria-labelledby="exclusive-heading">
          <div className="max-w-6xl mx-auto">
            <h2 id="exclusive-heading" className="text-2xl font-bold mb-2 text-center">
              {WHY_PINONIT.exclusiveHeadline}
            </h2>
            <p className="text-center text-slate-500 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
              {WHY_PINONIT.exclusiveSubhead}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CALENDLY_EXCLUSIVES.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-2xl" aria-hidden>{item.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5">{item.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-16" aria-labelledby="compare-heading">
          <div className="max-w-4xl mx-auto">
            <h2 id="compare-heading" className="text-2xl font-bold mb-6 text-center">
              PinOnIt vs Calendly
            </h2>

            <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/80">
                    <th scope="col" className="text-left font-semibold px-5 py-3.5 w-[46%]">Feature</th>
                    <th scope="col" className="text-center font-semibold px-4 py-3.5 text-brand-700 dark:text-brand-400">PinOnIt</th>
                    <th scope="col" className="text-center font-semibold px-4 py-3.5 text-slate-500">Calendly</th>
                  </tr>
                </thead>
                <tbody>
                  {WHY_PINONIT.features.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 dark:border-slate-800">
                      <th scope="row" className="text-left font-medium px-5 py-3.5 text-slate-800 dark:text-slate-200">
                        {row.label}
                      </th>
                      <td className="text-center px-4 py-3.5 bg-brand-50/50 dark:bg-brand-500/5">
                        <CellValue value={row.pinonit} emphasize />
                      </td>
                      <td className="text-center px-4 py-3.5">
                        <CellValue value={row.calendly} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden space-y-3">
              {WHY_PINONIT.features.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <p className="font-semibold text-slate-900 dark:text-white mb-3">{row.label}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-brand-50 dark:bg-brand-500/10 px-3 py-2.5 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-1">PinOnIt</p>
                      <CellValue value={row.pinonit} emphasize />
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Calendly</p>
                      <CellValue value={row.calendly} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-6 pb-16" aria-labelledby="scenarios-heading">
          <div className="max-w-5xl mx-auto">
            <h2 id="scenarios-heading" className="text-2xl font-bold mb-6 text-center">
              Built for how you actually work
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {WHY_PINONIT.scenarios.map((s) => (
                <article
                  key={s.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6"
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
                    {s.audience}
                  </p>
                  <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{s.pain}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{s.handle}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-20" aria-labelledby="cta-heading">
          <div className="max-w-4xl mx-auto rounded-3xl bg-brand-600 text-white px-8 py-12 text-center">
            <h2 id="cta-heading" className="text-2xl sm:text-3xl font-black">
              Run the business. Not the reminder chase.
            </h2>
            <p className="mt-3 text-brand-100">{WHY_PINONIT.priceLine}</p>
            <Link
              to="/signup"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-700 hover:bg-brand-50 text-sm font-semibold rounded-full transition-colors"
            >
              {WHY_PINONIT.trialCta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
