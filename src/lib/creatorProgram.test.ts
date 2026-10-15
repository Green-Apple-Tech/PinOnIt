import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CreatorsPage } from '../pages/Creators';
import { readFileSync } from 'node:fs';
import {
  PROPOSED_CREATOR_SETTINGS,
  applyConcurrentReserves,
  applyCreatorLedger,
  canReadCreatorRecord,
  commissionCents,
  creatorBalances,
  creatorClaimDecision,
  creatorCommissionGate,
  creatorPayoutCsv,
  decideOutbound,
  matureCreatorEntries,
  nextCreatorTouch,
  recordManualPayout,
} from './creatorProgram';
import { STRIPE_PRO_PRICE_ID, PRO_PRICE_CENTS } from './pricing';

const active = { status: 'active' as const, commissionBps: 4000, holdDays: 30 };
const at = '2026-10-14T12:00:00.000Z';

describe('creator program pricing stays on the current Pro price', () => {
  it('does not introduce a new Price ID', () => {
    expect(STRIPE_PRO_PRICE_ID).toBe('price_1UBerwIVv38UYFOXg43WzEWL');
    expect(PRO_PRICE_CENTS).toBe(999);
    expect(PROPOSED_CREATOR_SETTINGS.status).toBe('draft');
  });
});

describe('creator commission ledger', () => {
  it('pays 40% of collected pre-tax cents, half-up, and ignores a free trial', () => {
    expect(commissionCents(999, 4000)).toBe(400);
    expect(commissionCents(0, 4000)).toBe(0);
    const trial = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_trial', invoiceId: 'in_trial', amountPaidCents: 0, taxCents: 0, at,
    }, active);
    expect(trial.outcome).toBe('skipped');
  });

  it('records a paid invoice, ignores a duplicate webhook and a second earn for the same invoice', () => {
    const first = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 1099, taxCents: 100, at,
    }, active);
    expect(first.outcome).toBe('recorded');
    expect(first.entries[0].basisCents).toBe(999);
    expect(first.entries[0].amountCents).toBe(400);
    expect(first.entries[0].status).toBe('pending');
    const dup = applyCreatorLedger(first.entries, {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 1099, taxCents: 100, at,
    }, active);
    expect(dup.outcome).toBe('duplicate');
    const again = applyCreatorLedger(first.entries, {
      type: 'invoice_paid', eventId: 'evt_1b', invoiceId: 'in_1', amountPaidCents: 1099, taxCents: 100, at,
    }, active);
    expect(again.reason).toBe('invoice_earn');
  });

  it('records a renewal on a new invoice and keeps the original rate when the rate later changes', () => {
    const first = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 999, taxCents: 0, at,
    }, active);
    const renewal = applyCreatorLedger(first.entries, {
      type: 'renewal', eventId: 'evt_2', invoiceId: 'in_2', amountPaidCents: 999, taxCents: 0, at: '2026-11-14T12:00:00.000Z',
    }, { ...active, commissionBps: 3000 });
    expect(renewal.entries).toHaveLength(2);
    expect(renewal.entries[0].rateBps).toBe(4000);
    expect(renewal.entries[0].amountCents).toBe(400);
    expect(renewal.entries[1].rateBps).toBe(3000);
    expect(renewal.entries[1].amountCents).toBe(300);
  });

  it('holds earnings for 30 days, then claws back a partial refund and a dispute without double counting', () => {
    const earned = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 999, taxCents: 0, at,
    }, active);
    const matured = matureCreatorEntries(earned.entries, '2026-11-13T11:59:59.000Z');
    expect(matured[0].status).toBe('pending');
    const payable = matureCreatorEntries(earned.entries, '2026-11-13T12:00:00.000Z');
    expect(creatorBalances(payable).payableCents).toBe(400);

    const refund = applyCreatorLedger(payable, {
      type: 'refund', eventId: 'evt_r', invoiceId: 'in_1', refundId: 're_1', refundCents: 200, chargeCents: 999, at: '2026-11-20T12:00:00.000Z',
    }, active);
    expect(refund.outcome).toBe('recorded');
    expect(refund.entries[1].amountCents).toBe(-commissionCents(200, 4000));
    const refundAgain = applyCreatorLedger(refund.entries, {
      type: 'refund', eventId: 'evt_r2', invoiceId: 'in_1', refundId: 're_1', refundCents: 200, chargeCents: 999, at: '2026-11-20T12:00:00.000Z',
    }, active);
    expect(refundAgain.outcome).toBe('duplicate');

    const dispute = applyCreatorLedger(refund.entries, {
      type: 'dispute', eventId: 'evt_d', invoiceId: 'in_1', at: '2026-11-21T12:00:00.000Z',
    }, active);
    expect(dispute.entries[dispute.entries.length - 1]?.amountCents).toBe(-(400 - 80));
    const disputeAgain = applyCreatorLedger(dispute.entries, {
      type: 'dispute', eventId: 'evt_d2', invoiceId: 'in_1', at: '2026-11-22T12:00:00.000Z',
    }, active);
    expect(disputeAgain.outcome).toBe('duplicate');
    expect(creatorBalances(matureCreatorEntries(dispute.entries, '2026-11-22T12:00:00.000Z')).payableCents).toBe(0);
  });

  it('keeps a payout and records a recoverable balance when a refund or dispute arrives after it', () => {
    const earned = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 999, taxCents: 0, at,
    }, active);
    const payable = matureCreatorEntries(earned.entries, '2026-11-13T12:00:00.000Z');
    const paid = recordManualPayout(payable, [], {
      paidOn: '2026-11-14', amountCents: 400, reference: 'ach-1001', entryIds: ['evt_1'],
    });
    expect(paid.outcome).toBe('recorded');
    expect(paid.payouts[0]).toMatchObject({ paidOn: '2026-11-14', amountCents: 400, reference: 'ach-1001', entryIds: ['evt_1'] });

    const refund = applyCreatorLedger(paid.entries, {
      type: 'refund', eventId: 'evt_r', invoiceId: 'in_1', refundId: 're_1', refundCents: 200, chargeCents: 999, at: '2026-11-20T12:00:00.000Z',
    }, active);
    const clawback = refund.entries[refund.entries.length - 1];
    expect(clawback?.amountCents).toBe(-80);
    expect(clawback?.status).toBe('payable');
    expect(clawback?.reason).toBe('recoverable_after_payout');
    expect(refund.entries[0].status).toBe('paid');
    expect(refund.entries[0].amountCents).toBe(400);
    expect(paid.payouts[0].amountCents).toBe(400);
    expect(paid.payouts[0].entryIds).toEqual(['evt_1']);
    expect(creatorBalances(refund.entries).payableCents).toBe(-80);
    expect(creatorBalances(refund.entries).recoverableCents).toBe(80);

    const dispute = applyCreatorLedger(paid.entries, {
      type: 'dispute', eventId: 'evt_d', invoiceId: 'in_1', at: '2026-11-21T12:00:00.000Z',
    }, active);
    expect(dispute.entries[dispute.entries.length - 1]?.amountCents).toBe(-400);
    expect(dispute.entries[dispute.entries.length - 1]?.reason).toBe('recoverable_after_payout');
    expect(paid.payouts).toHaveLength(1);
  });

  it('records a manual payout once and leaves a CSV export unpaid', () => {
    const earned = matureCreatorEntries(applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 999, taxCents: 0, at,
    }, active).entries, '2026-11-13T12:00:00.000Z');
    const snapshot = JSON.stringify(earned);
    expect(creatorPayoutCsv([{ code: 'ada12', email: 'ada@example.com', payableCents: 400 }])).toContain('ada12');
    expect(JSON.stringify(earned)).toBe(snapshot);
    expect(earned[0].status).toBe('payable');

    const paid = recordManualPayout(earned, [], {
      paidOn: '2026-11-14', amountCents: 400, reference: 'check-9', entryIds: ['evt_1'],
    });
    const again = recordManualPayout(paid.entries, paid.payouts, {
      paidOn: '2026-11-15', amountCents: 400, reference: 'check-10', entryIds: ['evt_1'],
    });
    expect(again.outcome).toBe('rejected');
    expect(again.reason).toBe('already_paid');
    expect(again.payouts).toHaveLength(1);
    expect(recordManualPayout(earned, [], {
      paidOn: '2026-11-14', amountCents: 100, reference: 'check-9', entryIds: ['evt_1'],
    }).reason).toBe('amount_mismatch');
  });

  it('does not activate commissions until the published terms are accepted', () => {
    expect(creatorCommissionGate({ programStatus: 'draft', publishedVersion: null, acceptedVersion: null }).reason).toBe('program_draft');
    expect(creatorCommissionGate({ programStatus: 'active', publishedVersion: null, acceptedVersion: 1 }).reason).toBe('terms_not_published');
    expect(creatorCommissionGate({ programStatus: 'active', publishedVersion: 1, acceptedVersion: null }).reason).toBe('terms_not_accepted');
    const blocked = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 999, taxCents: 0, at,
    }, { ...active, publishedVersion: 1, acceptedVersion: null });
    expect(blocked.reason).toBe('terms_not_accepted');
    const allowed = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 999, taxCents: 0, at,
    }, { ...active, publishedVersion: 1, acceptedVersion: 1 });
    expect(allowed.outcome).toBe('recorded');
  });

  it('does not claw back a cancellation and does not write while the program is draft', () => {
    const earned = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 999, taxCents: 0, at,
    }, active);
    const canceled = applyCreatorLedger(earned.entries, {
      type: 'cancel', eventId: 'evt_c', invoiceId: 'in_1', at,
    }, active);
    expect(canceled.outcome).toBe('skipped');
    expect(canceled.entries).toHaveLength(1);
    const draft = applyCreatorLedger([], {
      type: 'invoice_paid', eventId: 'evt_1', invoiceId: 'in_1', amountPaidCents: 999, taxCents: 0, at,
    }, { ...active, status: 'draft' });
    expect(draft.reason).toBe('program_draft');
  });
});

describe('creator attribution and grants', () => {
  it('keeps the first creator code for 30 days and rejects self-referrals', () => {
    const now = new Date('2026-10-14T12:00:00.000Z');
    const first = nextCreatorTouch(null, 'Ada12', now, 30);
    const second = nextCreatorTouch(first, 'other99', new Date('2026-10-20T12:00:00.000Z'), 30);
    expect(second?.code).toBe('ada12');
    const later = nextCreatorTouch(first, 'other99', new Date('2026-11-14T12:00:00.000Z'), 30);
    expect(later?.code).toBe('other99');

    expect(creatorClaimDecision({
      creatorCode: 'ada12',
      customerReferralCode: 'friend',
      applicantEmail: 'guest@example.com',
      creatorEmail: 'ada@example.com',
    }).reason).toBe('claimed');
    expect(creatorClaimDecision({
      creatorCode: 'ada12',
      customerReferralCode: null,
      applicantEmail: 'ada@example.com',
      creatorEmail: 'Ada@example.com',
    }).reason).toBe('self_referral');
  });

  it('limits only creator grants and blocks sends after expiry or the cap', () => {
    const now = '2026-10-14T12:00:00.000Z';
    expect(decideOutbound({ kind: 'complimentary', expiresAt: '2020-01-01T00:00:00.000Z', limit: 1, used: 5 }, now).allow).toBe(true);
    expect(decideOutbound({ kind: 'creator', expiresAt: '2026-10-01T00:00:00.000Z', limit: 200, used: 0 }, now).reason).toBe('creator_grant_expired');
    expect(decideOutbound({ kind: 'creator', expiresAt: null, limit: 2, used: 2 }, now).reason).toBe('creator_message_limit');
    expect(decideOutbound({ kind: 'creator', expiresAt: null, limit: 2, used: 1 }, now).used).toBe(2);
    expect(applyConcurrentReserves(199, 200, 5)).toBe(200);
    expect(applyConcurrentReserves(0, 200, 201)).toBe(200);
  });

  it('lets a creator read only their own rows unless the viewer is staff', () => {
    expect(canReadCreatorRecord({ userId: 'creator', staff: false }, 'creator')).toBe(true);
    expect(canReadCreatorRecord({ userId: 'other', staff: false }, 'creator')).toBe(false);
    expect(canReadCreatorRecord({ userId: null, staff: false }, 'creator')).toBe(false);
    expect(canReadCreatorRecord({ userId: 'staff', staff: true }, 'creator')).toBe(true);
  });

  it('builds a manual payout report and does not revive the $1 customer credit', () => {
    expect(creatorPayoutCsv([{ code: 'ada12', email: 'ada@example.com', payableCents: 400 }])).toContain('ada12,ada@example.com,400');
    const webhook = readFileSync(new URL('../../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');
    const referral = readFileSync(new URL('../../supabase/functions/referral-signup/index.ts', import.meta.url), 'utf8');
    expect(webhook).not.toContain('amount_cents: 100');
    expect(webhook).not.toContain('createBalanceTransaction');
    expect(referral).toContain('program_retired');
    expect(referral).not.toContain('commissionBps');
  });

  it('shows the draft creator application and does not publish the terms as live', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(CreatorsPage)));
    expect(html).toContain('Teach small-business owners a simpler way to quote, book, invoice, and get documents signed by text.');
    expect(html).toContain('Draft — not a published offer');
    expect(html).toContain('Not in effect');
    expect(html).toContain('Business email');
    expect(html).toContain('Primary profile URL');
    expect(html).toContain('Main topics');
    expect(html).toContain('Audience description');
  });

  it('counts every host SMS path and keeps payout, refund, and terms gates in the draft migration', () => {
    const root = new URL('../../supabase/', import.meta.url);
    const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
    const migration = read('migrations/20261014190000_creator_program_draft.sql');
    const admin = readFileSync(new URL('../pages/CreatorAdmin.tsx', import.meta.url), 'utf8');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("kind = 'creator'");
    expect(migration).toContain('recoverable_after_payout');
    expect(migration).toContain('record_creator_payout');
    expect(migration).toContain('terms_not_accepted');
    expect(migration).toContain('terms_not_published');
    expect(migration).toContain("DEFAULT 'draft'");
    expect(admin).toContain('does not mark earnings paid');
    expect(admin).not.toContain("status: 'paid'");
    expect(admin).not.toContain('record_creator_payout');

    for (const path of [
      'functions/send-reminder/index.ts',
      'functions/coordinate-sms/index.ts',
      'functions/critical-alert/index.ts',
      'functions/generate-document-certificate/index.ts',
      'functions/send-document-otp/index.ts',
      'functions/complete-reschedule/index.ts',
      'functions/sms-inbound/index.ts',
      'functions/send-document-sms/index.ts',
      'functions/send-quote/index.ts',
      'functions/send-on-my-way/index.ts',
      'functions/dispatch-quote-reminders/index.ts',
    ]) {
      const source = read(path);
      expect(source).toMatch(/reserveCreatorOutbound|hostId/);
    }
    expect(read('functions/health-monitor/index.ts')).not.toContain('reserveCreatorOutbound');
    const webhook = read('functions/stripe-webhook/index.ts');
    expect(webhook).toContain('charge.refunded');
    expect(webhook).toContain('charge.dispute.created');
    expect(webhook).not.toContain('amount_cents: 100');
  });
});
