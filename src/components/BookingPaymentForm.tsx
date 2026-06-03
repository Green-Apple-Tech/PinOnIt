import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';

interface BookingPaymentFormProps {
  amountLabel: string;
  accentColor?: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (err: string) => void;
}

export function BookingPaymentForm({
  amountLabel,
  accentColor = '#5864C6',
  onSuccess,
  onError,
}: BookingPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements || !elementReady || processing || loadError) return;

    setProcessing(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        onError(submitError.message ?? 'Payment failed');
        return;
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message ?? 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else {
        onError('Payment was not completed. Please try again.');
      }
    } catch {
      onError('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loadError) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400 mt-3">
        {loadError}
      </p>
    );
  }

  if (!stripe || !elements) {
    return (
      <div className="mt-3 flex items-center justify-center py-6 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        <span className="text-sm text-gray-500 dark:text-slate-400">Loading payment form...</span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      {!elementReady && (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-slate-400">Preparing card fields...</span>
        </div>
      )}
      <PaymentElement
        options={{
          wallets: { applePay: 'never', googlePay: 'never' },
        }}
        onReady={() => setElementReady(true)}
        onLoadError={(event) => {
          const message = event.error?.message ?? 'Unable to load card payment form.';
          setLoadError(message);
          onError(message);
        }}
      />
      {elementReady && (
        <button
          type="button"
          onClick={handlePay}
          disabled={processing}
          className="w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          {processing && <Loader2 className="h-4 w-4 animate-spin" />}
          {processing ? 'Processing...' : `Pay ${amountLabel}`}
        </button>
      )}
    </div>
  );
}
