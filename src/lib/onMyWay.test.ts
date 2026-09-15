import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ON_MY_WAY_TEMPLATE,
  ON_MY_WAY_SMS_ENABLED,
  bumpOnMyWayEtaUsage,
  onMyWaySmsBody,
  pickDefaultOnMyWayEta,
  renderOnMyWayMessage,
  SMS_ON_MY_WAY_A2P_SAMPLE,
  SMS_ON_MY_WAY_EXAMPLE,
} from './onMyWay';
import { SMS_EXAMPLES } from '../pages/smsExamples';

describe('on my way', () => {
  it('keeps SMS gated until A2P samples are approved', () => {
    expect(ON_MY_WAY_SMS_ENABLED).toBe(false);
  });

  it('renders eta as a merge field and appends STOP only', () => {
    const body = renderOnMyWayMessage({
      template: DEFAULT_ON_MY_WAY_TEMPLATE,
      businessName: 'Acme Lawn Care',
      hostFirstName: 'Alex',
      eta: 20,
    });
    expect(body).toBe('Acme Lawn Care: Alex is on the way — about 20 minutes out.');
    expect(onMyWaySmsBody(body)).toBe(SMS_ON_MY_WAY_A2P_SAMPLE);
    expect(onMyWaySmsBody(body)).not.toMatch(/Reply 1/);
  });

  it('defaults to the most-used ETA', () => {
    expect(pickDefaultOnMyWayEta({ '10': 1, '20': 4, '30': 2 }, 30)).toBe(20);
    expect(pickDefaultOnMyWayEta({}, 45)).toBe(45);
    expect(pickDefaultOnMyWayEta(null, null)).toBe(20);
    expect(bumpOnMyWayEtaUsage({ '20': 1 }, 10)).toEqual({ '20': 1, '10': 1 });
  });

  it('lists the en-route example on /sms-consent', () => {
    expect(SMS_EXAMPLES).toContain(SMS_ON_MY_WAY_EXAMPLE);
  });
});
