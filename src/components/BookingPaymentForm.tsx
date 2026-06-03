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
  const [ready, setReady] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements || !ready) return;
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

  return (
    <div className="mt-3">
      {!ready && (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-slate-400">Loading payment form...</span>
        </div>
      )}
      <PaymentElement onReady={() => setReady(true)} />
      {ready && (
        <button
          type="button"
          onClick={handlePay}
          disabled={processing || !stripe || !elements}
          className="w-full mt-4 py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          {processing && <Loader2 className="h-4 w-4 animate-spin" />}
          {processing ? 'Processing...' : `Pay ${amountLabel}`}
        </button>
      )}
    </div>
  );
}
