import { useEffect, useState } from 'react';
import {
  SMS_SIGNATURE_IDENTITY_NOTICE_BODY,
  SMS_SIGNATURE_IDENTITY_NOTICE_CHECKBOX,
  SMS_SIGNATURE_IDENTITY_NOTICE_TITLE,
  identityContinueEnabled,
} from '../lib/smsSignatureIdentity';

/** One-time sender warning. Not shown to the person signing. */
export function SmsSignatureIdentityModal({
  open,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) setChecked(false);
  }, [open]);

  if (!open) return null;

  const canContinue = identityContinueEnabled(checked, busy);

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sms-signature-identity-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cancel"
        onClick={() => { if (!busy) onCancel(); }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-5 sm:p-6">
        <h2 id="sms-signature-identity-title" className="text-base font-bold text-slate-900 dark:text-white">
          {SMS_SIGNATURE_IDENTITY_NOTICE_TITLE}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {SMS_SIGNATURE_IDENTITY_NOTICE_BODY}
        </p>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>{SMS_SIGNATURE_IDENTITY_NOTICE_CHECKBOX}</span>
        </label>
        {error ? <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{error}</p> : null}
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 px-4 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onConfirm}
            className="min-h-11 px-4 rounded-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-500 text-white text-sm font-semibold"
          >
            {busy ? 'Sending…' : 'Continue & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
