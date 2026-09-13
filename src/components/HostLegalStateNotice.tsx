import { hostLegalStateNotice } from '../lib/legalStateNotices';
import type { SmbDocumentType } from '../lib/types';

/** Host-side only. Informational — never changes document text. */
export function HostLegalStateNotice({
  documentType,
  businessRegion,
}: {
  documentType: SmbDocumentType;
  businessRegion?: string | null;
}) {
  const notice = hostLegalStateNotice(documentType, businessRegion);
  if (!notice) return null;
  return (
    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-2.5">
      {notice}
    </p>
  );
}
