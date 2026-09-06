/** Marketing / UI claim about Sign-by-Text — capability only, no legal outcome. */
export const HOLD_UP_COPY =
  'Meets federal ESIGN Act requirements for electronic signatures. Every signature includes a complete audit record.';

/** Short footer under the signer actions. */
export const LEGAL_DISCLAIMER =
  'PinOnIt does not provide legal advice. Whether a document fits your situation depends on applicable law and the document content — consult an attorney when needed.';

/** Factual audit-record bullets (use everywhere we describe the record). */
export const AUDIT_RECORD_ITEMS = [
  "Signer's mobile number, verified by one-time SMS code (2FA)",
  "Signer's full name as entered",
  'Exact timestamp of each event: opened, verified, consented, signed (with timezone)',
  'IP address and user agent at signing',
  'SHA-256 hash of the signed document',
  'Snapshot of the exact document text and version signed',
  'The signature image itself',
  'The consent statement shown, captured verbatim',
  'Unique document ID',
] as const;

/**
 * Separate from the document’s own agreement checkbox.
 * Captured verbatim in the audit record when the signer checks it.
 */
export const ESIGN_CONSENT_STATEMENT =
  'I consent to do business electronically with the sender of this document, and I consent to receive related records electronically through PinOnIt.';

export const WAIVER_HOST_HINT =
  'This is a standard starting waiver. Rules vary by state, so have an attorney review it before you rely on it.';

export const CONTRACT_HOST_HINT =
  'This is a general-purpose starting template, not legal advice. Contract terms vary by state and by industry. Consult an attorney before relying on this for your situation.';

/** Short always-on scope line for Sign-by-Text / Doc Center. */
export const SIGN_BY_TEXT_SCOPE_SUMMARY =
  'Sign-by-Text is for single-signature business documents (waivers, NDAs, addendums, estimates, job sign-offs). It is not intended for document types excluded from the federal ESIGN Act — including wills, codicils, testamentary trusts, and certain family-law and court documents — nor for powers of attorney (POA), deeds, notarized instruments, multi-signer closings, or anything illegal/fraudulent.';

export const DOCUMENT_UPLOAD_READABILITY_HINT =
  'Use a clear, complete PDF — blurry scans, missing pages, or cut-off text may not help if there is a dispute.';

/** Full scope + upload limits. Pass maxLabel from DOCUMENT_UPLOAD_MAX_BYTES (e.g. "5MB"). */
export function signByTextScopeDetail(maxLabel = '5MB') {
  return `${SIGN_BY_TEXT_SCOPE_SUMMARY} Upload clear, complete PDFs only, up to ${maxLabel}. Every signature includes a complete audit record. PinOnIt does not provide legal advice.`;
}

/** Always-required checkbox label. */
export function signByTextAckLabel(maxLabel = '5MB') {
  return `I understand Sign-by-Text / Send Docs is only for lawful single-signature business documents. I will not use it for wills, codicils, testamentary trusts, certain family-law or court documents, powers of attorney (POA), deeds, notarized instruments, multi-signer closings, or illegal/fraudulent content. Uploaded PDFs must be clear and complete (PDF, up to ${maxLabel}). PinOnIt does not provide legal advice.`;
}

/**
 * Full scope checkbox — once per account (durable on profile).
 * After `sign_by_text_scope_accepted_at` is set, do not show the paragraph again.
 */
export function requiresSignByTextScopeCheckbox(opts: {
  isUpload: boolean;
  scopeAlreadyAccepted: boolean;
}): boolean {
  void opts.isUpload;
  return !opts.scopeAlreadyAccepted;
}
