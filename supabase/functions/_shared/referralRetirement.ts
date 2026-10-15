/**
 * The $1 customer referral program ended at the start of October 15, 2026
 * (US Eastern). Old ?ref= links stay ordinary signup links. No new credits.
 */
export const REFERRAL_NOTICE_CLAUSE =
  "We reserve the right to modify or discontinue the referral program at any time with 30 days' notice to existing participants.";

export const REFERRAL_NOTICE_DATE = '2026-10-15';
export const REFERRAL_PROGRAM_ENDS_ON = '2026-10-15';
export const REFERRAL_PROGRAM_ENDS_ON_LABEL = 'October 15, 2026';

/** Start of October 15, 2026 in US Eastern (EDT, UTC-4). Rewards are closed after this. */
export const REFERRAL_PROGRAM_ENDS_AT = '2026-10-15T04:00:00.000Z';

export function referralRewardsOpen(now: Date = new Date()): boolean {
  return now.getTime() <= Date.parse(REFERRAL_PROGRAM_ENDS_AT);
}
