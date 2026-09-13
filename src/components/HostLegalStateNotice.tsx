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
    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
      {notice}
    </p>
  );
}
