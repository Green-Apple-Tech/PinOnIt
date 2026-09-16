import { storageGet, storageSet } from './safeStorage';

export const QUESTION_LEAD_MAX_VISITS = 5;
const REMOUNT_DEBOUNCE_MS = 1500;

export type QuestionLeadStore = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

const localStore: QuestionLeadStore = {
  get: storageGet,
  set: storageSet,
};

export function questionLeadKeys(id: string) {
  return {
    dismissed: `pinonit_qlead_${id}_dismissed`,
    visits: `pinonit_qlead_${id}_visits`,
    lastTick: `pinonit_qlead_${id}_last`,
  };
}

export function shouldShowQuestionLead(visits: number, dismissed: boolean, maxVisits = QUESTION_LEAD_MAX_VISITS) {
  return !dismissed && visits < maxVisits;
}

export function readQuestionLeadState(id: string, store: QuestionLeadStore = localStore) {
  const keys = questionLeadKeys(id);
  const dismissed = store.get(keys.dismissed) === '1';
  const parsed = parseInt(store.get(keys.visits) || '0', 10);
  const visits = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  return { dismissed, visits };
}

/** Count one page visit. Debounces remounts so one open is not two. */
export function recordQuestionLeadVisit(
  id: string,
  now = Date.now(),
  store: QuestionLeadStore = localStore,
  maxVisits = QUESTION_LEAD_MAX_VISITS,
): number {
  const keys = questionLeadKeys(id);
  const { visits } = readQuestionLeadState(id, store);
  const last = Number(store.get(keys.lastTick) || '0') || 0;
  if (last > 0 && now - last < REMOUNT_DEBOUNCE_MS) return visits;
  const next = Math.min(visits + 1, maxVisits);
  store.set(keys.visits, String(next));
  store.set(keys.lastTick, String(now));
  return next;
}

export function dismissQuestionLead(id: string, store: QuestionLeadStore = localStore) {
  store.set(questionLeadKeys(id).dismissed, '1');
}
