import { nextCreatorTouch, normalizeCreatorCode, type CreatorTouch } from './creatorProgram';
import { PROPOSED_CREATOR_SETTINGS } from './creatorProgram';

const STORAGE_KEY = 'pinonit_creator_touch';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readCreatorTouch(): CreatorTouch | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreatorTouch;
    if (!parsed || !normalizeCreatorCode(parsed.code) || !parsed.firstTouchAt) return null;
    return { code: normalizeCreatorCode(parsed.code)!, firstTouchAt: parsed.firstTouchAt };
  } catch {
    return null;
  }
}

/** Stores the first ?creator= code in this browser. Does not touch ?ref=. */
export function captureCreatorParam(search: string, now = new Date()): CreatorTouch | null {
  const incoming = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('creator');
  const next = nextCreatorTouch(readCreatorTouch(), incoming, now, PROPOSED_CREATOR_SETTINGS.attributionDays);
  const store = storage();
  if (!store) return next;
  if (!next) store.removeItem(STORAGE_KEY);
  else store.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
