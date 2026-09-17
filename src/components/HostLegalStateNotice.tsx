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
    <p className="text-[11px] text-black dark:text-white leading-relaxed">
      {notice}
    </p>
  );
}
