import type { Subscription } from './types';
import {
  pickBestSubscription as pickBestPlanRow,
  type PlanTier,
  type ProfilePlanRow,
  type SubscriptionPlanRow,
  effectivePlan,
  hostRowIsActive,
  isActivePlan,
  isComplimentaryPro,
} from '@shared/planAccess';

export type { PlanTier, ProfilePlanRow, SubscriptionPlanRow };

export {
  effectivePlan,
  hostRowIsActive,
  isActivePlan,
  isComplimentaryPro,
};

/** Same ranking as the shared helper, typed to the app Subscription row. */
export function pickBestSubscription(rows: Subscription[] | null | undefined): Subscription | null {
  return pickBestPlanRow(rows) as Subscription | null;
}
