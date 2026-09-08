import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('quote / receipt SMS server gates', () => {
  const sms = readFileSync('supabase/functions/send-document-sms/index.ts', 'utf8');

  it('blocks inactive hosts via hostPlanIsActive before send', () => {
    expect(sms).toMatch(/hostPlanIsActive/);
    expect(sms).toMatch(/Reactivate Pro to send documents/);
  });

  it('sends through sendTwilioSmsGuarded (STOP / sms_is_opted_out)', () => {
    expect(sms).toMatch(/sendTwilioSmsGuarded/);
    expect(sms).toMatch(/opted_out/);
  });

  it('uses quote and receipt copy helpers', () => {
    expect(sms).toMatch(/quoteLinkSms/);
    expect(sms).toMatch(/receiptLinkSms/);
    expect(sms).toMatch(/purpose === 'quote'/);
    expect(sms).toMatch(/purpose === 'receipt'/);
  });
});
