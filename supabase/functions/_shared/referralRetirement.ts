/**
 * The live Referral Program clause says the program can be modified or
 * discontinued with 30 days' notice to existing participants.
 * This notice is not given until pinonit.com publishes it.
 * Rewards stay on through the effective date below.
 * If the publish date moves, change both dates together before deploying.
 */
export const REFERRAL_NOTICE_CLAUSE =
  "We reserve the right to modify or discontinue the referral program at any time with 30 days' notice to existing participants.";

/** Prepared publication date for the in-product notice. Not live until Bolt Publish. */
export const REFERRAL_NOTICE_DATE = '2026-10-15';

/** Last civil day the $1 credit can be earned. 30 days after REFERRAL_NOTICE_DATE. */
export const REFERRAL_PROGRAM_ENDS_ON = '2026-11-14';

export const REFERRAL_PROGRAM_ENDS_ON_LABEL = 'November 14, 2026';

/**
 * End of November 14, 2026 in US Eastern (EST, UTC-5).
 * A credit path at or before this instant still runs. After it, no new credits.
 */
export const REFERRAL_PROGRAM_ENDS_AT = '2026-11-15T04:59:59.999Z';

export function referralRewardsOpen(now: Date = new Date()): boolean {
  return now.getTime() <= Date.parse(REFERRAL_PROGRAM_ENDS_AT);
}
