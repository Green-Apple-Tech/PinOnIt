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

/** Edge-function JSON error, including raw Twilio blobs. */
export function formatFunctionError(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const err = (json as { error?: unknown }).error;
  if (typeof err === 'string' && err.trim()) {
    try {
      const parsed = JSON.parse(err) as { message?: unknown; code?: unknown };
      if (typeof parsed.message === 'string' && parsed.message) {
        return typeof parsed.code === 'number' ? `${parsed.message} (${parsed.code})` : parsed.message;
      }
    } catch {
      return err;
    }
    return err;
  }
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; code?: unknown };
    if (typeof o.message === 'string' && o.message) {
      return typeof o.code === 'number' ? `${o.message} (${o.code})` : o.message;
    }
  }
  return fallback;
}
