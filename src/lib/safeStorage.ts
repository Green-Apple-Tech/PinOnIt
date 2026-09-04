/** localStorage/sessionStorage throw in Bolt's sandboxed preview iframe. */

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / blocked iframe */
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
