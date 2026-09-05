export const HOLD_UP_COPY =
  'Built for a strong legal position: SMS-verified, timestamped, 2FA-confirmed, and signed from their phone.';

export const LEGAL_DISCLAIMER =
  'This does not guarantee legal enforceability or government certification — consult an attorney for legal advice.';

export const WAIVER_HOST_HINT =
  'This is a standard starting waiver. Rules vary by state, so have an attorney review it before you rely on it.';

export const CONTRACT_HOST_HINT =
  'This is a general-purpose starting template, not legal advice. Contract terms vary by state and by industry. Consult an attorney before relying on this for your situation.';

/** Short always-on scope line for Sign-by-Text / Doc Center. */
export const SIGN_BY_TEXT_SCOPE_SUMMARY =
  'Sign-by-Text is for single-signature business documents (waivers, NDAs, addendums, estimates, job sign-offs). Not for wills, trusts, powers of attorney (POA), deeds, court or judge filings/orders, notarized instruments, multi-signer closings, or anything illegal/fraudulent.';

export const DOCUMENT_UPLOAD_READABILITY_HINT =
  'Use a clear, complete PDF — blurry scans, missing pages, or cut-off text may not help if there is a dispute.';

/** Full scope + upload limits. Pass maxLabel from DOCUMENT_UPLOAD_MAX_BYTES (e.g. "5MB"). */
export function signByTextScopeDetail(maxLabel = '5MB') {
  return `${SIGN_BY_TEXT_SCOPE_SUMMARY} Upload clear, complete PDFs only, up to ${maxLabel}. This builds an evidentiary record — it does not guarantee a document is valid for your situation.`;
}

/** Always-required checkbox label. */
export function signByTextAckLabel(maxLabel = '5MB') {
  return `I understand Sign-by-Text / Send Docs is only for lawful single-signature business documents. I will not use it for wills, trusts, powers of attorney (POA), deeds, court or judge filings/orders, notarized instruments, multi-signer closings, or illegal/fraudulent content. Uploaded PDFs must be clear and complete (PDF, up to ${maxLabel}).`;
}

/**
 * Full scope checkbox:
 * - every send for uploaded / library PDFs (host-controlled content)
 * - first send only for built-in templates (durable ack on profile)
 */
export function requiresSignByTextScopeCheckbox(opts: {
  isUpload: boolean;
  scopeAlreadyAccepted: boolean;
}): boolean {
  if (opts.isUpload) return true;
  return !opts.scopeAlreadyAccepted;
}
