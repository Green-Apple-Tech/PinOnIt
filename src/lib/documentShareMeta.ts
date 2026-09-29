export type DocumentShareInput = {
  document_type?: string | null;
  document_type_custom?: string | null;
  topic?: string | null;
  sender_business_name?: string | null;
};

function shareKind(type?: string | null, custom?: string | null) {
  switch (type) {
    case 'boat_waiver':
      return 'boat waiver';
    case 'parental_consent_waiver':
      return 'family waiver';
    case 'waiver':
      return 'waiver';
    case 'nda':
      return 'NDA';
    case 'quote':
      return 'quote';
    case 'invoice':
      return 'invoice';
    case 'contract':
      return 'contract';
    case 'other':
      return custom?.trim() || 'document';
    default:
      return 'document';
  }
}

/** Link-preview title. A customized topic wins over the generic product card. */
export function documentShareTitle(doc: DocumentShareInput) {
  const topic = doc.topic?.trim();
  if (topic) return topic;
  const kind = shareKind(doc.document_type, doc.document_type_custom);
  if (doc.document_type === 'quote') return 'Review this quote';
  if (doc.document_type === 'invoice') return 'Review this invoice';
  return `Sign this ${kind}`;
}

export function documentShareDescription(doc: DocumentShareInput) {
  const biz = doc.sender_business_name?.trim();
  const action = doc.document_type === 'quote' || doc.document_type === 'invoice'
    ? 'Tap to review.'
    : 'Tap to read and sign.';
  return biz ? `${action} From ${biz}.` : action;
}
