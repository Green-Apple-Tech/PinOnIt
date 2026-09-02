import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Lock, PenLine, RotateCcw } from 'lucide-react';
import {
  CONTRACT_HOST_HINT,
  LEGAL_DISCLAIMER,
  defaultVerificationRequired,
  documentNeedsRecipientAction,
  documentFilePublicUrl,
  fetchClientIp,
  fillDocumentPlaceholders,
  getDocumentByToken,
  isMoneyDocumentType,
  documentTypeLabel,
  recordDocumentEvent,
  sendDocumentOtp,
  topicCoverLine,
  verifyDocumentOtp,
} from '../lib/documents';
import { quoteTotals } from '../lib/quoteMath';
import type { HostQuoteLineItem, PublicSmbDocument } from '../lib/types';

function money(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
}

function verificationOn(doc: PublicSmbDocument) {
  if (typeof doc.verification_required === 'boolean') return doc.verification_required;
  return defaultVerificationRequired(doc.document_type);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

export function DocumentConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<PublicSmbDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpNotice, setOtpNotice] = useState('');
  const [otpError, setOtpError] = useState('');
  const [fullTextOpen, setFullTextOpen] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [hasMarked, setHasMarked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!token) {
      setMissing(true);
      setLoading(false);
      return;
    }
    const consentToken = token;

    void (async () => {
      const { data, error: err } = await getDocumentByToken(consentToken);
      if (err || !data) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setDoc(data);
      setOtpVerified(Boolean(data.otp_verified));
      if (data.status === 'signed') {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      if (data.status === 'pending') {
        const ip = await fetchClientIp();
        await recordDocumentEvent({
          token: consentToken,
          action: 'viewed',
          ip,
          userAgent: navigator.userAgent,
        });
      }

      if (verificationOn(data) && !data.otp_verified) {
        const otp = await sendDocumentOtp(consentToken);
        if (otp.data?.already_verified) {
          setOtpVerified(true);
        } else if (otp.error || !otp.data?.ok) {
          setOtpError(otp.error?.message ?? otp.data?.error ?? 'Could not send a verification code');
        } else if (otp.data.sent) {
          setOtpNotice('We texted a 6-digit code to the phone number on this document.');
        } else {
          setOtpNotice('Enter the 6-digit code we texted you. It expires in 10 minutes.');
        }
      } else if (!verificationOn(data)) {
        setOtpVerified(true);
      }
      setLoading(false);
    })();
  }, [token]);

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    last.current = p;
    setHasMarked(true);
  }

  function endDraw() {
    drawing.current = false;
    last.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasMarked(false);
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!token || otpBusy) return;
    setOtpError('');
    setOtpBusy(true);
    const { data, error: err } = await verifyDocumentOtp(token, otpCode);
    if (err || !data?.ok) {
      setOtpError(err?.message ?? data?.error ?? 'Could not verify that code');
      setOtpBusy(false);
      return;
    }
    setOtpVerified(true);
    setOtpNotice('Phone verified.');
    setOtpBusy(false);
  }

  async function handleResend() {
    if (!token || otpBusy) return;
    setOtpError('');
    setOtpBusy(true);
    const otp = await sendDocumentOtp(token, true);
    if (otp.data?.already_verified) {
      setOtpVerified(true);
    } else if (otp.error || !otp.data?.ok) {
      setOtpError(otp.error?.message ?? otp.data?.error ?? 'Could not resend the code');
    } else {
      setOtpNotice('A new code is on the way. It expires in 10 minutes.');
    }
    setOtpBusy(false);
  }

  async function handleConfirm() {
    if (!token || !doc || !otpVerified) return;
    const verified = verificationOn(doc);
    const needsMark = verified && doc.confirmation_type !== 'confirm_receipt';
    if (needsMark && !hasMarked) return;
    if (verified && !agreed) return;
    setError('');
    setSubmitting(true);
    const ip = await fetchClientIp();
    const signatureData =
      needsMark && canvasRef.current ? canvasRef.current.toDataURL('image/png') : 'confirmed';
    const { data, error: err } = await recordDocumentEvent({
      token,
      action: 'signed',
      signatureData,
      ip,
      userAgent: navigator.userAgent,
    });
    if (err || !data?.ok) {
      setError(err?.message ?? data?.error ?? 'Could not submit');
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (missing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-500 text-sm">This document could not be found.</p>
      </div>
    );
  }

  if (submitted && doc) {
    const typeLabel = documentTypeLabel(doc.document_type, doc.document_type_custom);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Confirmed</h1>
          <p className="mt-2 text-sm text-slate-500">
            You have confirmed this {typeLabel}.
            {doc.signed_at && <span className="block mt-1">{formatDate(doc.signed_at)}</span>}
          </p>
        </div>
      </div>
    );
  }

  const verifiedFlow = doc ? verificationOn(doc) : true;
  const viewOnly = doc ? !documentNeedsRecipientAction(doc.document_type) && !verifiedFlow : false;
  const confirmLabel = !verifiedFlow
    ? doc?.document_type === 'invoice'
      ? 'Approve'
      : doc?.document_type === 'receipt'
      ? 'Confirm receipt'
      : 'Confirm'
    : doc?.confirmation_type === 'confirm_receipt'
      ? 'Confirm receipt'
      : doc?.confirmation_type === 'approve'
      ? 'Approve with initials'
      : 'Sign & submit';

  const needsCanvas = verifiedFlow && doc?.confirmation_type !== 'confirm_receipt';
  const canvasHint = doc?.confirmation_type === 'approve' ? 'Draw your initials' : 'Draw your signature';
  const lineItems: HostQuoteLineItem[] = Array.isArray(doc?.line_items) ? doc.line_items : [];
  const taxPercent = Number(doc?.tax_percent) || 0;
  const moneyTotals = quoteTotals(lineItems, taxPercent);
  const showMoney = Boolean(doc && (isMoneyDocumentType(doc.document_type) || lineItems.length > 0));
  const fullBody = doc
    ? fillDocumentPlaceholders(doc.full_text, {
        topic: doc.topic,
        recipientName: doc.recipient_name,
        activityDescription: doc.topic,
      })
    : '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-10">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold tracking-tight">PinOnIt</span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Lock className="h-3 w-3" /> Secure
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-widest text-slate-400">Document type</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {doc ? documentTypeLabel(doc.document_type, doc.document_type_custom) : 'Document'}
          </p>
          <h1 className="mt-3 text-lg font-bold">For {doc?.recipient_name}</h1>
          {doc?.file_path && (
            <div className="mt-4 space-y-2">
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                <iframe
                  title={doc.file_name || 'Document PDF'}
                  src={`${documentFilePublicUrl(doc.file_path) ?? ''}#view=FitH`}
                  className="w-full h-[28rem] bg-white"
                />
              </div>
              <a
                href={documentFilePublicUrl(doc.file_path) ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm font-medium text-indigo-600"
              >
                Open PDF{doc.file_name ? ` (${doc.file_name})` : ''}
              </a>
              {doc.topic ? (
                <p className="text-sm text-slate-600">{doc.topic}</p>
              ) : null}
            </div>
          )}
          {doc && !doc.file_path && doc.document_type === 'waiver' ? (
            <p className="mt-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {doc.topic ? `This waiver covers: ${doc.topic}\n\n` : ''}
              {fullBody}
            </p>
          ) : !doc?.file_path ? (
            <>
              {doc && (
                <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">
                  {doc.document_type === 'nda' && topicCoverLine(doc.topic) ? `${topicCoverLine(doc.topic)}\n\n` : ''}
                  {doc.topic && doc.document_type !== 'nda' && doc.document_type !== 'waiver' ? `${doc.topic}\n\n` : ''}
                  {doc.summary_text}
                </p>
              )}
              {doc?.document_type === 'contract' && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 leading-relaxed">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Warning</p>
                  <p className="mt-1">{CONTRACT_HOST_HINT}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setFullTextOpen((v) => !v)}
                className="mt-3 text-sm font-medium text-indigo-600"
              >
                {fullTextOpen ? 'Hide full text' : 'Read full text'}
              </button>
              {fullTextOpen && doc && (
                <div className="mt-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 rounded-xl p-4">
                  {fullBody}
                </div>
              )}
            </>
          ) : null}
          {showMoney && (
            <table className="w-full mt-6 text-sm">
              <tbody>
                {lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-3 pr-4">{item.description || 'Item'}</td>
                    <td className="py-3 text-right whitespace-nowrap">{money(item.amount, doc?.currency)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-4">Subtotal</td>
                  <td className="pt-4 text-right">{money(moneyTotals.subtotal, doc?.currency)}</td>
                </tr>
                {taxPercent > 0 && (
                  <tr>
                    <td className="pt-2">Tax ({taxPercent}%)</td>
                    <td className="pt-2 text-right">{money(moneyTotals.taxAmount, doc?.currency)}</td>
                  </tr>
                )}
                <tr>
                  <td className="pt-4 font-semibold">Total</td>
                  <td className="pt-4 text-right font-semibold">{money(moneyTotals.total, doc?.currency)}</td>
                </tr>
              </tbody>
            </table>
          )}
          {doc?.notes && (
            <p className="mt-4 text-sm text-slate-600 whitespace-pre-wrap">{doc.notes}</p>
          )}
          {doc?.pay_elsewhere_url && (
            <a
              href={doc.pay_elsewhere_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3"
            >
              Pay {doc.pay_elsewhere_label || 'now'}
            </a>
          )}
        </div>

        {viewOnly && (
          <p className="text-sm text-slate-500 text-center px-2">
            This quote is for your review. No signature or confirmation is required.
          </p>
        )}

        {verifiedFlow && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold">Verify your phone</h2>
          {otpVerified ? (
            <p className="mt-2 text-sm text-emerald-700">Phone verified. You can continue below.</p>
          ) : (
            <form onSubmit={(e) => void handleVerifyOtp(e)} className="mt-3 space-y-3">
              <p className="text-sm text-slate-500">{otpNotice || 'Enter the 6-digit code we texted you.'}</p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-center tracking-[0.4em] text-lg"
              />
              {otpError && <p className="text-sm text-red-600">{otpError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={otpCode.length !== 6 || otpBusy}
                  className="flex-1 min-h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40"
                >
                  {otpBusy ? 'Checking…' : 'Verify code'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={otpBusy}
                  className="px-3 min-h-11 rounded-xl border border-slate-200 text-sm"
                >
                  Resend
                </button>
              </div>
            </form>
          )}
        </div>
        )}

        {otpVerified && !viewOnly && (
          <>
            {needsCanvas && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-slate-400" />
                    <h2 className="text-sm font-semibold">{canvasHint}</h2>
                  </div>
                  <button type="button" onClick={clearCanvas} className="text-xs text-slate-500 inline-flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> Clear
                  </button>
                </div>
                <div className="relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden touch-none">
                  <canvas
                    ref={canvasRef}
                    width={doc?.confirmation_type === 'approve' ? 400 : 600}
                    height={doc?.confirmation_type === 'approve' ? 120 : 200}
                    className="w-full h-28 cursor-crosshair block"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  {!hasMarked && (
                    <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 pointer-events-none">
                      {canvasHint}
                    </p>
                  )}
                </div>
              </div>
            )}

            {verifiedFlow && (
            <label className="flex items-start gap-3 bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-slate-600">
                I have reviewed this document and I confirm the action above.
              </span>
            </label>
            )}

            {error && (
              <div className="flex gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={submitting || (verifiedFlow && !agreed) || (needsCanvas && !hasMarked)}
              className="w-full min-h-12 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40"
            >
              {submitting ? 'Submitting…' : confirmLabel}
            </button>

            <p className="text-xs text-slate-500 leading-relaxed">{LEGAL_DISCLAIMER}</p>
          </>
        )}
      </main>
    </div>
  );
}
