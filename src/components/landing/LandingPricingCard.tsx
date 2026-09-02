import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { LANDING_PRICING_BULLETS_TEXT_FIRST } from '../../lib/landingComparisonData';

type Props = {
  variant: 'legacy' | 'text-first';
};

const LEGACY_BULLETS = [
  'WhatsApp + two-way SMS (text 2 to reschedule)',
  'Critical alerts + voice reminders',
  'Personal “remind me…” with calendar write-back',
  'Bookings sync to Google / Outlook',
  'Doc Center: NDAs, waivers, invoices, quotes',
  'Paid Booking storefront',
  'Calendly import + referral credits',
];

export function LandingPricingCard({ variant }: Props) {
  const bullets = variant === 'text-first' ? LANDING_PRICING_BULLETS_TEXT_FIRST : LEGACY_BULLETS;

  if (variant === 'text-first') {
    return (
      <div className="relative rounded-2xl border-2 border-brand-500 bg-brand-500 shadow-xl shadow-brand-200/50 dark:shadow-none p-8 flex flex-col">
        <div className="mb-6 text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-5xl font-extrabold text-white">$6</span>
            <span className="text-brand-200 text-sm">/mo</span>
          </div>
          <p className="mt-3 text-sm text-brand-50 font-medium">
            Everything on this page. One plan. No per-signature fees, no add-ons.
          </p>
        </div>
        <ul className="space-y-2.5 flex-1 mb-8">
          {bullets.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <div className="h-4 w-4 rounded-full bg-white/25 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
              <span className="text-sm text-brand-50">{f}</span>
            </li>
          ))}
        </ul>
        <Link
          to="/signup"
          className="w-full py-3.5 rounded-full text-sm font-bold flex items-center justify-center bg-white text-brand-600 hover:bg-brand-50 transition-all"
        >
          Start free
        </Link>
        <p className="mt-4 text-center text-xs text-brand-100">Free trial, cancel anytime.</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border-2 border-brand-500 bg-brand-500 shadow-xl shadow-brand-200/50 dark:shadow-none p-8 flex flex-col">
      <div className="mb-6">
        <h3 className="text-2xl font-extrabold text-white">PinOnIt Pro</h3>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-5xl font-extrabold text-white">$6</span>
          <span className="line-through text-brand-200 text-sm">$16</span>
          <span className="text-brand-200 text-sm">/month after trial</span>
        </div>
        <p className="mt-2 text-sm text-brand-100">14-day trial included · cancel anytime</p>
      </div>
      <ul className="space-y-2.5 flex-1 mb-8">
        {bullets.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <div className="h-4 w-4 rounded-full bg-white/25 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="text-sm text-brand-50">{f}</span>
          </li>
        ))}
      </ul>
      <Link to="/signup" className="w-full py-3.5 rounded-full text-sm font-bold flex items-center justify-center bg-white text-brand-600 hover:bg-brand-50 transition-all">
        Start 14-day trial
      </Link>
    </div>
  );
}
