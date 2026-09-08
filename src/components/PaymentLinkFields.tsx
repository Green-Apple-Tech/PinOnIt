const fieldClass =
  'mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base';

export function PaymentLinkFields({
  url,
  label,
  onUrlChange,
  onLabelChange,
}: {
  url: string;
  label: string;
  onUrlChange: (value: string) => void;
  onLabelChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 md:p-5">
      <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Payment link</p>
      <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
        How they send you money — Zelle, Cash App, Venmo, PayPal, or any pay page you already have. Shows as Pay Now after they approve. PinOnIt never handles the money.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
        <label className="block">
          <span className="text-xs font-medium text-emerald-900 dark:text-emerald-300">Link</span>
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className={fieldClass}
            placeholder="https://paypal.me/yourname"
            inputMode="url"
            autoComplete="url"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-emerald-900 dark:text-emerald-300">Button label</span>
          <input
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            className={fieldClass}
            placeholder="Pay"
          />
        </label>
      </div>
    </div>
  );
}
