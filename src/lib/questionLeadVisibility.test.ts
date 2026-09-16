import { describe, expect, it } from 'vitest';
import {
  dismissQuestionLead,
  questionLeadKeys,
  readQuestionLeadState,
  recordQuestionLeadVisit,
  shouldShowQuestionLead,
  type QuestionLeadStore,
} from './questionLeadVisibility';

function memoryStore(seed: Record<string, string> = {}): QuestionLeadStore & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    get: (key) => data[key] ?? null,
    set: (key, value) => {
      data[key] = value;
    },
  };
}

describe('shouldShowQuestionLead', () => {
  it('shows for the first five visits and hides after', () => {
    expect(shouldShowQuestionLead(0, false)).toBe(true);
    expect(shouldShowQuestionLead(4, false)).toBe(true);
    expect(shouldShowQuestionLead(5, false)).toBe(false);
    expect(shouldShowQuestionLead(2, true)).toBe(false);
  });
});

describe('recordQuestionLeadVisit', () => {
  it('counts one visit and ignores a remount in the same second', () => {
    const store = memoryStore();
    expect(recordQuestionLeadVisit('reminders', 1_000, store)).toBe(1);
    expect(recordQuestionLeadVisit('reminders', 1_200, store)).toBe(1);
    expect(recordQuestionLeadVisit('reminders', 3_000, store)).toBe(2);
    expect(readQuestionLeadState('reminders', store)).toEqual({ dismissed: false, visits: 2 });
  });

  it('stops showing after five counted visits or a dismiss', () => {
    const store = memoryStore();
    let now = 0;
    for (let i = 0; i < 5; i += 1) {
      now += 2_000;
      recordQuestionLeadVisit('documents', now, store);
    }
    const afterFive = readQuestionLeadState('documents', store);
    expect(afterFive.visits).toBe(5);
    expect(shouldShowQuestionLead(afterFive.visits, afterFive.dismissed)).toBe(false);

    const other = memoryStore();
    dismissQuestionLead('documents', other);
    expect(other.get(questionLeadKeys('documents').dismissed)).toBe('1');
    expect(shouldShowQuestionLead(0, true)).toBe(false);
  });
});
