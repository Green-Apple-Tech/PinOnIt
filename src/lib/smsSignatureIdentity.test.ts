import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SMS_SIGNATURE_IDENTITY_NOTICE_TEXT,
  SMS_SIGNATURE_IDENTITY_NOTICE_VERSION,
  identityContinueEnabled,
  smsSignatureSendNeedsIdentityAck,
} from './smsSignatureIdentity';

const migration = readFileSync('supabase/migrations/20261012180000_sms_signature_identity_ack.sql', 'utf8');
const sender = readFileSync('supabase/functions/send-document-sms/index.ts', 'utf8');
const terms = readFileSync('src/pages/Terms.tsx', 'utf8');
const modal = readFileSync('src/components/SmsSignatureIdentityModal.tsx', 'utf8');
const createDoc = readFileSync('src/pages/CreateDocument.tsx', 'utf8');
const signNow = readFileSync('src/pages/SignNowSend.tsx', 'utf8');

describe('SMS signature identity notice', () => {
  it('starts at notice version 1', () => {
    expect(SMS_SIGNATURE_IDENTITY_NOTICE_VERSION).toBe(1);
    expect(migration).toContain('v_required integer := 1');
    expect(sender).toContain('Number(ack.notice_version) < 1');
  });

  it('stores the same notice text the modal shows', () => {
    expect(migration).toContain(SMS_SIGNATURE_IDENTITY_NOTICE_TEXT);
    expect(modal).toContain('SMS_SIGNATURE_IDENTITY_NOTICE_TITLE');
    expect(modal).toContain('Continue & Send');
    expect(modal).toContain('Cancel');
  });

  it('keeps Continue disabled until the box is checked', () => {
    expect(identityContinueEnabled(false, false)).toBe(false);
    expect(identityContinueEnabled(false, true)).toBe(false);
    expect(identityContinueEnabled(true, true)).toBe(false);
    expect(identityContinueEnabled(true, false)).toBe(true);
    expect(modal).toContain('disabled={!canContinue}');
  });

  it('only requires the notice for an SMS signature send', () => {
    expect(smsSignatureSendNeedsIdentityAck(true, true)).toBe(true);
    expect(smsSignatureSendNeedsIdentityAck(true, false)).toBe(false);
    expect(smsSignatureSendNeedsIdentityAck(false, true)).toBe(false);
  });

  it('blocks the send API until the account has acknowledged', () => {
    const ackAt = sender.indexOf('sms_signature_identity_acks');
    const sendAt = sender.indexOf('await sendTwilioSmsGuarded');
    expect(ackAt).toBeGreaterThan(0);
    expect(ackAt).toBeLessThan(sendAt);
    expect(sender).toContain("purpose !== 'receipt'");
    expect(sender).toContain("purpose !== 'payment_reminder'");
    expect(sender).toContain("doc.document_type !== 'receipt'");
    expect(sender).toContain('claim_document_sms_signature_send');
  });

  it('does not save the acknowledgment on cancel', () => {
    expect(createDoc).toContain('if (!identityBusy) setIdentityOpen(false)');
    expect(signNow).toContain('if (!identityBusy) setIdentityOpen(false)');
    expect(createDoc).toContain('acknowledgeSmsSignatureIdentity');
    expect(signNow).toContain('acknowledgeSmsSignatureIdentity');
  });

  it('adds the identity section to Terms without dropping existing sections', () => {
    expect(terms).toContain('Electronic Signature Identity Verification and Sender Responsibility');
    expect(terms).toContain('does not conclusively establish the legal identity');
    expect(terms).toContain('Nothing in this section excludes liability that cannot legally be limited.');
    expect(terms).not.toContain('data-attorney-review');
    expect(terms).toContain('Acceptance of Terms');
    expect(terms).toContain('Limitation of Liability');
    expect(terms).toContain('Doc Center — Waivers, NDAs, Contracts & Invoices');
  });
});
