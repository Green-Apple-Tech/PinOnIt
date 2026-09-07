/** Turn a pasted pay link into an https URL, or null if empty. */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export function documentShowsPayLink(type: string): boolean {
  return (
    type === 'quote'
    || type === 'invoice'
    || type === 'work_order'
    || type === 'change_order'
    || type === 'completion_sign_off'
    || type === 'repair_confirmation'
  );
}
