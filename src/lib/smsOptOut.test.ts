import { describe, expect, it } from 'vitest';
import {
  SMS_OPT_OUT_FOOTER,
  SMS_REPLY_FOOTER,
  appendSmsGuestFooters,
  appendSmsOptOut,
  appendSmsReplyFooter,
} from './smsOptOut';

describe('sms opt-out helpers', () => {
  it('appends STOP on document-style messages', () => {
    const body = appendSmsOptOut('Hi Jane, you have a nda regarding Roofing to review: https://pinonit.com/d/abc');
    expect(body).toContain('Hi Jane');
    expect(body).toContain(SMS_OPT_OUT_FOOTER);
  });

  it('does not duplicate STOP', () => {
    const once = appendSmsOptOut('Hello. Reply STOP to opt out.');
    expect(once.match(/Reply STOP to opt out/gi)?.length).toBe(1);
  });

  it('stacks cancel/reschedule then STOP for guest reminders', () => {
    const body = appendSmsGuestFooters('Your appointment is tomorrow at 3pm');
    expect(body).toContain(SMS_REPLY_FOOTER);
    expect(body).toContain(SMS_OPT_OUT_FOOTER);
    expect(appendSmsReplyFooter('x')).toContain(SMS_REPLY_FOOTER);
  });
});
