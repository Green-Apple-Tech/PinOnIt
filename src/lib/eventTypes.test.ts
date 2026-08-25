import { describe, expect, it } from 'vitest';
import {
  defaultSelectedServiceIds,
  eventTypeSlug,
  isPinOnItDemoFeedback,
  serviceMatchesTypeToken,
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

  it('checks every real event type and skips PinOnIt demo feedback', () => {
    expect([...defaultSelectedServiceIds(types)].sort()).toEqual(['15', '30', '60']);
  });

  it('still skips feedback when it is the only 30-minute type', () => {
    const ids = defaultSelectedServiceIds([
      { id: '15', name: '15 Min Quick Call', duration_minutes: 15 },
      { id: 'meet', name: '30 Minute Meeting', duration_minutes: 30 },
      { id: 'fb', name: 'Pin On It Feedback', duration_minutes: 30 },
    ]);
    expect([...ids].sort()).toEqual(['15', 'meet']);
  });
});

describe('eventTypeSlug', () => {
  it('turns a 15-minute consultation into 15_min_consult', () => {
    expect(eventTypeSlug({ name: '15 Min Consultation', duration_minutes: 15 })).toBe('15_min_consult');
  });

  it('turns a paid 60-minute consultation into 60_min_paid', () => {
    expect(eventTypeSlug({
      name: 'Consultation (60 min $50)',
      duration_minutes: 60,
      price_cents: 5000,
    })).toBe('60_min_paid');
  });

  it('keeps a distinctive name', () => {
    expect(eventTypeSlug({ name: '15 Min Quick Call', duration_minutes: 15 })).toBe('15_min_quick_call');
  });
});

describe('serviceMatchesTypeToken', () => {
  const svc = { id: 'e80024ee-a65d-487d-95b7-b61aaca6f877', name: '15 Min Consultation', duration_minutes: 15 };

  it('matches the readable slug', () => {
    expect(serviceMatchesTypeToken(svc, '15_min_consult')).toBe(true);
  });

  it('still matches old UUID links', () => {
    expect(serviceMatchesTypeToken(svc, svc.id)).toBe(true);
  });
});
