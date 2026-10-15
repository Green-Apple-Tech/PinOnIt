/**
 * Creator partner rules. The commercial settings below are approved, but the
 * program stays draft until creator_program_settings.status is set to active.
 * This is not the $1 customer referral program (/signup?ref=).
 *
 * Rounding: half-up to the nearest cent.
 * commission = floor((basisCents * bps + 5000) / 10000)
 * Example: 40% of 999 cents = 400 cents ($4.00).
 */

export const PROPOSED_CREATOR_SETTINGS = {
  status: 'draft' as const,
  commissionBps: 4000,
  holdDays: 30,
  attributionDays: 30,
  proposedGrantDurationDays: 90,
  proposedOutboundMessageLimit: 200,
  outboundMessageLimitScope: 'total across the grant, every host SMS and WhatsApp message',
  payouts: 'manual',
  rounding: 'half-up to the nearest cent',
};

export type CreatorProgramStatus = 'draft' | 'active';

export function commissionCents(basisCents: number, bps: number): number {
  if (!Number.isInteger(basisCents) || basisCents <= 0) return 0;
  if (!Number.isInteger(bps) || bps <= 0) return 0;
  return Math.floor((basisCents * bps + 5000) / 10000);
}

export function collectedBasisCents(amountPaidCents: number, taxCents: number): number {
  if (!Number.isInteger(amountPaidCents) || amountPaidCents <= 0) return 0;
  const tax = Number.isInteger(taxCents) && taxCents > 0 ? taxCents : 0;
  return Math.max(0, amountPaidCents - tax);
}

export function normalizeCreatorCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  if (!/^[a-z0-9]{4,16}$/.test(code)) return null;
  return code;
}

export type CreatorTouch = { code: string; firstTouchAt: string };

/** First eligible code in the window wins. A later code does not replace it. */
export function nextCreatorTouch(
  existing: CreatorTouch | null,
  incoming: string | null | undefined,
  now: Date,
  windowDays: number,
): CreatorTouch | null {
  const code = normalizeCreatorCode(incoming);
  if (existing) {
    const ageMs = now.getTime() - new Date(existing.firstTouchAt).getTime();
    const expired = !Number.isFinite(ageMs) || ageMs > windowDays * 86_400_000;
    if (!expired) return existing;
  }
  if (!code) return existing && new Date(existing.firstTouchAt).getTime() <= now.getTime() ? null : existing;
  if (existing) {
    const ageMs = now.getTime() - new Date(existing.firstTouchAt).getTime();
    if (ageMs <= windowDays * 86_400_000) return existing;
  }
  return { code, firstTouchAt: now.toISOString() };
}

export function creatorClaimDecision(input: {
  creatorCode: string | null;
  customerReferralCode: string | null;
  applicantEmail: string;
  creatorEmail: string;
  creatorUserId?: string | null;
  applicantUserId?: string | null;
}): { ok: boolean; reason: string } {
  if (!normalizeCreatorCode(input.creatorCode)) return { ok: false, reason: 'invalid_code' };
  if (input.customerReferralCode?.trim()) return { ok: false, reason: 'customer_referral_present' };
  const applicant = input.applicantEmail.trim().toLowerCase();
  const creator = input.creatorEmail.trim().toLowerCase();
  if (applicant && creator && applicant === creator) return { ok: false, reason: 'self_referral' };
  if (input.creatorUserId && input.applicantUserId && input.creatorUserId === input.applicantUserId) {
    return { ok: false, reason: 'self_referral' };
  }
  return { ok: true, reason: 'claimed' };
}

export function canReadCreatorRecord(
  viewer: { userId: string | null; staff: boolean },
  ownerUserId: string,
): boolean {
  if (viewer.staff) return true;
  return Boolean(viewer.userId) && viewer.userId === ownerUserId;
}

export type GrantKind = 'complimentary' | 'creator';

export type OutboundGrant = {
  kind: GrantKind;
  expiresAt: string | null;
  limit: number | null;
  used: number;
};

/** Complimentary grants ignore creator expiry and message caps. */
export function decideOutbound(
  grant: OutboundGrant | null,
  nowIso: string,
): { allow: boolean; reason: string; used: number } {
  if (!grant || grant.kind !== 'creator') {
    return { allow: true, reason: grant ? 'complimentary_grant' : 'no_creator_grant', used: grant?.used ?? 0 };
  }
  if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= new Date(nowIso).getTime()) {
    return { allow: false, reason: 'creator_grant_expired', used: grant.used };
  }
  if (grant.limit == null) return { allow: true, reason: 'creator_unlimited', used: grant.used };
  if (grant.used >= grant.limit) return { allow: false, reason: 'creator_message_limit', used: grant.used };
  return { allow: true, reason: 'reserved', used: grant.used + 1 };
}

export type LedgerEntry = {
  eventId: string;
  invoiceId: string;
  refundId: string | null;
  kind: 'earn' | 'refund' | 'dispute';
  basisCents: number;
  amountCents: number;
  rateBps: number;
  status: 'pending' | 'payable' | 'paid';
  availableAt: string;
  reason?: string;
};

export type CreatorPayout = {
  id: string;
  paidOn: string;
  amountCents: number;
  reference: string;
  entryIds: string[];
};

export type CreatorMoneyEvent =
  | { type: 'invoice_paid' | 'renewal'; eventId: string; invoiceId: string; amountPaidCents: number; taxCents: number; at: string }
  | { type: 'refund'; eventId: string; invoiceId: string; refundId: string; refundCents: number; chargeCents: number; at: string }
  | { type: 'dispute'; eventId: string; invoiceId: string; at: string }
  | { type: 'cancel'; eventId: string; invoiceId: string; at: string };

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

function invoiceNet(entries: LedgerEntry[], invoiceId: string) {
  const earn = entries.find((entry) => entry.kind === 'earn' && entry.invoiceId === invoiceId);
  const reversed = entries
    .filter((entry) => entry.invoiceId === invoiceId && entry.kind !== 'earn')
    .reduce((sum, entry) => sum + Math.abs(entry.amountCents), 0);
  const reversedBasis = entries
    .filter((entry) => entry.invoiceId === invoiceId && entry.kind !== 'earn')
    .reduce((sum, entry) => sum + entry.basisCents, 0);
  return {
    earn,
    remainingCommission: earn ? Math.max(0, earn.amountCents - reversed) : 0,
    remainingBasis: earn ? Math.max(0, earn.basisCents - reversedBasis) : 0,
  };
}

export function creatorCommissionGate(input: {
  programStatus: CreatorProgramStatus;
  publishedVersion: number | null;
  acceptedVersion: number | null;
}): { ok: boolean; reason: string } {
  if (input.programStatus !== 'active') return { ok: false, reason: 'program_draft' };
  if (input.publishedVersion == null) return { ok: false, reason: 'terms_not_published' };
  if (input.acceptedVersion !== input.publishedVersion) return { ok: false, reason: 'terms_not_accepted' };
  return { ok: true, reason: 'terms_accepted' };
}

function reversalOf(earn: LedgerEntry): { status: LedgerEntry['status']; reason?: string } {
  if (earn.status === 'paid') return { status: 'payable', reason: 'recoverable_after_payout' };
  return { status: earn.status === 'pending' ? 'pending' : 'payable' };
}

export function applyCreatorLedger(
  entries: LedgerEntry[],
  event: CreatorMoneyEvent,
  settings: {
    status: CreatorProgramStatus;
    commissionBps: number;
    holdDays: number;
    publishedVersion?: number | null;
    acceptedVersion?: number | null;
  },
): { entries: LedgerEntry[]; outcome: 'recorded' | 'duplicate' | 'skipped'; reason: string } {
  if (settings.status !== 'active') return { entries, outcome: 'skipped', reason: 'program_draft' };
  if (settings.publishedVersion !== undefined || settings.acceptedVersion !== undefined) {
    const gate = creatorCommissionGate({
      programStatus: settings.status,
      publishedVersion: settings.publishedVersion ?? null,
      acceptedVersion: settings.acceptedVersion ?? null,
    });
    if (!gate.ok) return { entries, outcome: 'skipped', reason: gate.reason };
  }
  if (entries.some((entry) => entry.eventId === event.eventId)) {
    return { entries, outcome: 'duplicate', reason: 'event_id' };
  }
  if (event.type === 'cancel') {
    return { entries, outcome: 'skipped', reason: 'cancellation_keeps_collected_commission' };
  }

  if (event.type === 'invoice_paid' || event.type === 'renewal') {
    if (entries.some((entry) => entry.kind === 'earn' && entry.invoiceId === event.invoiceId)) {
      return { entries, outcome: 'duplicate', reason: 'invoice_earn' };
    }
    const basis = collectedBasisCents(event.amountPaidCents, event.taxCents);
    const amount = commissionCents(basis, settings.commissionBps);
    if (amount <= 0) return { entries, outcome: 'skipped', reason: 'nothing_collected' };
    const row: LedgerEntry = {
      eventId: event.eventId,
      invoiceId: event.invoiceId,
      refundId: null,
      kind: 'earn',
      basisCents: basis,
      amountCents: amount,
      rateBps: settings.commissionBps,
      status: 'pending',
      availableAt: addDays(event.at, settings.holdDays),
    };
    return { entries: [...entries, row], outcome: 'recorded', reason: 'earn' };
  }

  if (event.type === 'refund') {
    if (entries.some((entry) => entry.refundId === event.refundId)) {
      return { entries, outcome: 'duplicate', reason: 'refund_id' };
    }
    const net = invoiceNet(entries, event.invoiceId);
    if (!net.earn || net.remainingCommission <= 0) {
      return { entries, outcome: 'skipped', reason: 'nothing_to_reverse' };
    }
    const charge = event.chargeCents > 0 ? event.chargeCents : net.earn.basisCents;
    const scaled = charge > 0 ? Math.floor((event.refundCents * net.earn.basisCents + Math.floor(charge / 2)) / charge) : 0;
    const basis = Math.min(net.remainingBasis, Math.max(0, scaled));
    const claw = Math.min(net.remainingCommission, commissionCents(basis, net.earn.rateBps));
    if (claw <= 0) return { entries, outcome: 'skipped', reason: 'nothing_to_reverse' };
    const reversal = reversalOf(net.earn);
    const row: LedgerEntry = {
      eventId: event.eventId,
      invoiceId: event.invoiceId,
      refundId: event.refundId,
      kind: 'refund',
      basisCents: basis,
      amountCents: -claw,
      rateBps: net.earn.rateBps,
      status: reversal.status,
      availableAt: event.at,
      reason: reversal.reason,
    };
    return { entries: [...entries, row], outcome: 'recorded', reason: reversal.reason ?? 'refund' };
  }

  if (entries.some((entry) => entry.kind === 'dispute' && entry.invoiceId === event.invoiceId)) {
    return { entries, outcome: 'duplicate', reason: 'dispute' };
  }
  const net = invoiceNet(entries, event.invoiceId);
  if (!net.earn || net.remainingCommission <= 0) {
    return { entries, outcome: 'skipped', reason: 'nothing_to_reverse' };
  }
  const reversal = reversalOf(net.earn);
  const row: LedgerEntry = {
    eventId: event.eventId,
    invoiceId: event.invoiceId,
    refundId: null,
    kind: 'dispute',
    basisCents: net.remainingBasis,
    amountCents: -net.remainingCommission,
    rateBps: net.earn.rateBps,
    status: reversal.status === 'pending' ? 'payable' : reversal.status,
    availableAt: event.at,
    reason: reversal.reason,
  };
  return { entries: [...entries, row], outcome: 'recorded', reason: reversal.reason ?? 'dispute' };
}

export function matureCreatorEntries(entries: LedgerEntry[], nowIso: string): LedgerEntry[] {
  const now = new Date(nowIso).getTime();
  return entries.map((entry) => (
    entry.status === 'pending' && new Date(entry.availableAt).getTime() <= now
      ? { ...entry, status: 'payable' }
      : entry
  ));
}

export function creatorBalances(entries: LedgerEntry[]): {
  pendingCents: number;
  payableCents: number;
  recoverableCents: number;
} {
  const payable = entries.filter((entry) => entry.status === 'payable');
  return {
    pendingCents: entries.filter((entry) => entry.status === 'pending').reduce((sum, entry) => sum + entry.amountCents, 0),
    payableCents: payable.reduce((sum, entry) => sum + entry.amountCents, 0),
    recoverableCents: payable.filter((entry) => entry.amountCents < 0).reduce((sum, entry) => sum + Math.abs(entry.amountCents), 0),
  };
}

/** One slot at a time. A creator grant cannot go past its total, even if several sends race. */
export function applyConcurrentReserves(used: number, limit: number, attempts: number): number {
  let current = Math.max(0, used);
  const cap = Math.max(0, limit);
  for (let i = 0; i < attempts; i += 1) {
    if (current < cap) current += 1;
  }
  return current;
}

export function recordManualPayout(
  entries: LedgerEntry[],
  payouts: CreatorPayout[],
  input: { paidOn: string; amountCents: number; reference: string; entryIds: string[] },
): { entries: LedgerEntry[]; payouts: CreatorPayout[]; outcome: 'recorded' | 'rejected'; reason: string } {
  const reference = input.reference.trim();
  if (!reference) return { entries, payouts, outcome: 'rejected', reason: 'reference_required' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) {
    return { entries, payouts, outcome: 'rejected', reason: 'paid_on_required' };
  }
  if (input.entryIds.length === 0 || new Set(input.entryIds).size !== input.entryIds.length) {
    return { entries, payouts, outcome: 'rejected', reason: 'entry_ids' };
  }
  const covered = input.entryIds.map((id) => entries.find((entry) => entry.eventId === id));
  if (covered.some((entry) => !entry)) return { entries, payouts, outcome: 'rejected', reason: 'missing_entry' };
  const already = new Set(payouts.flatMap((payout) => payout.entryIds));
  if (input.entryIds.some((id) => already.has(id))) {
    return { entries, payouts, outcome: 'rejected', reason: 'already_paid' };
  }
  if (covered.some((entry) => entry!.kind !== 'earn' || entry!.status !== 'payable' || entry!.amountCents <= 0)) {
    return { entries, payouts, outcome: 'rejected', reason: 'not_payable_earning' };
  }
  const sum = covered.reduce((total, entry) => total + entry!.amountCents, 0);
  if (sum !== input.amountCents) return { entries, payouts, outcome: 'rejected', reason: 'amount_mismatch' };
  const payout: CreatorPayout = {
    id: `po_${payouts.length + 1}`,
    paidOn: input.paidOn,
    amountCents: input.amountCents,
    reference,
    entryIds: [...input.entryIds],
  };
  const next = entries.map((entry) => (
    input.entryIds.includes(entry.eventId) ? { ...entry, status: 'paid' as const } : entry
  ));
  return { entries: next, payouts: [...payouts, payout], outcome: 'recorded', reason: 'recorded' };
}

export function creatorPayoutCsv(rows: { code: string; email: string; payableCents: number }[]): string {
  const lines = ['code,email,payable_cents'];
  for (const row of rows) {
    lines.push(`${row.code},${row.email},${row.payableCents}`);
  }
  return lines.join('\n');
}

export const CREATOR_TERMS_DRAFT = {
  title: 'PinOnIt creator partner terms (draft)',
  status: 'Not in effect. Do not publish.',
  paragraphs: [
    'These terms are a draft for review. They are not a published offer and do not create a commission agreement.',
    'A creator partner may receive 40% of subscription revenue PinOnIt actually collects from a customer that partner referred, after discounts and excluding taxes, refunds, and chargebacks, before payment-processing fees.',
    'No commission is owed on free trials, complimentary accounts, unpaid invoices, or revenue that is later refunded or charged back.',
    'Commission is calculated in whole cents, half-up. Each earning stays pending for 30 days before it can be paid.',
    'The first eligible creator link within 30 days is the one that counts. A later link does not replace it. This browser storage does not follow a person to another device.',
    'A signup that uses the existing customer referral program ($1 credit, /signup?ref=) does not also earn a creator commission.',
    'Payouts are manual only. A spreadsheet export does not mark earnings paid. These draft terms do not authorize a transfer, and no commission starts until the creator accepts the published version of these terms.',
    'Creators must disclose their partnership when the program is published. A lawyer should review this draft before it is shown as the live agreement.',
  ],
};
