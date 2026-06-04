/** Human-readable message from Supabase/PostgREST or generic thrown values. */
export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; error_description?: unknown; details?: unknown };
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.error_description === 'string' && o.error_description) return o.error_description;
    if (typeof o.details === 'string' && o.details) return o.details;
  }
  if (typeof err === 'string') return err;
  return 'Something went wrong. Please try again.';
}
