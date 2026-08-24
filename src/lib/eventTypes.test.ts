import { describe, expect, it } from 'vitest';
import {
  defaultSelectedServiceIds,
  isPinOnItDemoFeedback,
  isThirtyMinIncludedByDefault,
} from './eventTypes';

describe('isPinOnItDemoFeedback', () => {
  it('matches Pin On It / Piin On It Feedback names', () => {
    expect(isPinOnItDemoFeedback('Pin On It Feedback')).toBe(true);
    expect(isPinOnItDemoFeedback('Piin On It Feedback')).toBe(true);
    expect(isPinOnItDemoFeedback('PinOnIt Feedback')).toBe(true);
  });

  it('does not match real customer event types', () => {
    expect(isPinOnItDemoFeedback('30 Min Consultation')).toBe(false);
    expect(isPinOnItDemoFeedback('Client Feedback Call')).toBe(false);
  });
});

describe('defaultSelectedServiceIds', () => {
  const types = [
    { id: '15', name: '15 Min Quick Call', duration_minutes: 15 },
    { id: '30', name: '30 Min Consultation', duration_minutes: 30 },
    { id: '60', name: 'Consultation (60 min $50)', duration_minutes: 60 },
    { id: 'fb1', name: 'Piin On It Feedback', duration_minutes: 15 },
    { id: 'fb2', name: 'Pin On It Feedback', duration_minutes: 30 },
  ];

  it('checks only the 30 min consultation', () => {
    expect([...defaultSelectedServiceIds(types)]).toEqual(['30']);
  });

  it('falls back to a non-feedback 30-minute type', () => {
    const ids = defaultSelectedServiceIds([
      { id: '15', name: '15 Min Quick Call', duration_minutes: 15 },
      { id: 'meet', name: '30 Minute Meeting', duration_minutes: 30 },
      { id: 'fb', name: 'Pin On It Feedback', duration_minutes: 30 },
    ]);
    expect([...ids]).toEqual(['meet']);
  });

  it('leaves all unchecked when nothing 30-minute matches', () => {
    expect(defaultSelectedServiceIds([
      { id: '15', name: '15 Min Quick Call', duration_minutes: 15 },
      { id: '60', name: 'Consultation (60 min $50)', duration_minutes: 60 },
    ]).size).toBe(0);
  });
});

describe('isThirtyMinIncludedByDefault', () => {
  it('does not select PinOnIt feedback even at 30 minutes', () => {
    expect(isThirtyMinIncludedByDefault({ name: 'Pin On It Feedback', duration_minutes: 30 })).toBe(false);
  });
});
