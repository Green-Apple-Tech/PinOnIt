import { useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../lib/stripe';
import { BookingPaymentForm } from './BookingPaymentForm';

interface StripeBookingCheckoutProps {
  clientSecret: string;
  amountLabel: string;
  accentColor: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

/** Isolated Stripe Elements tree — mount once per clientSecret, never update options in place. */
export function StripeBookingCheckout({
  clientSecret,
  amountLabel,
  accentColor,
  onSuccess,
  onError,
}: StripeBookingCheckoutProps) {
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: { theme: 'stripe' as const },
    }),
    [clientSecret],
  );

  if (!stripePromise) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Card payments are not configured. Choose another payment method or Skip.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <BookingPaymentForm
        amountLabel={amountLabel}
        accentColor={accentColor}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}
