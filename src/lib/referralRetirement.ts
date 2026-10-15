import {
  referralRewardsOpen,
} from '../../supabase/functions/_shared/referralRetirement.ts';

export {
  REFERRAL_NOTICE_CLAUSE,
  REFERRAL_NOTICE_DATE,
  REFERRAL_PROGRAM_ENDS_AT,
  REFERRAL_PROGRAM_ENDS_ON,
  REFERRAL_PROGRAM_ENDS_ON_LABEL,
  referralRewardsOpen,
} from '../../supabase/functions/_shared/referralRetirement.ts';

const PENDING_REFERRAL_KEY = 'pinonit_pending_referral_code';

export function rememberPendingReferral(code: string | null | undefined) {
  const trimmed = code?.trim();
  if (!trimmed || typeof localStorage === 'undefined') return;
  localStorage.setItem(PENDING_REFERRAL_KEY, trimmed.slice(0, 200));
}

export function readPendingReferral(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem(PENDING_REFERRAL_KEY)?.trim();
  return value || null;
}

export function clearPendingReferral() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(PENDING_REFERRAL_KEY);
}

/** Records a customer referral only while the program is still open. Requires the new user's access token. */
export async function recordCustomerReferral(accessToken: string, referralCode: string): Promise<boolean> {
  if (!referralRewardsOpen()) return false;
  const code = referralCode.trim();
  if (!accessToken || !code) return false;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/referral-signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ referral_code: code }),
  });
  return res.ok;
}
