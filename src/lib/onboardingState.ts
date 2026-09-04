/** Browser-only onboarding flags — must not outlive a DB wipe / fresh account. */

import { storageGet, storageRemove, storageSet } from './safeStorage';

export const ONBOARDING_LS_KEYS = [
  'onboarding_completed',
  'wizard_active',
  'wizard_step',
  'onboarding_checklist_dismissed',
  'pinonit_bot_dismissed',
  'pinonit_bot_completed',
  'pinonit_bot_answers',
] as const;

export function onboardingIsCompletedLocal(): boolean {
  return storageGet('onboarding_completed') === '1';
}

export function wizardIsActiveLocal(): boolean {
  return storageGet('wizard_active') === '1';
}

export function wizardSavedStepLocal(): number {
  return Number(storageGet('wizard_step') ?? '0');
}

export function markOnboardingCompletedLocal(): void {
  storageSet('onboarding_completed', '1');
  storageRemove('wizard_active');
  storageRemove('wizard_step');
}

export function setWizardActiveLocal(stepIndex: number): void {
  storageSet('wizard_active', '1');
  storageSet('wizard_step', String(stepIndex));
}

export function clearWizardLocal(): void {
  storageRemove('wizard_active');
  storageRemove('wizard_step');
}

/** Clear stale client state after DB wipe, sign-out, or fresh login. */
export function clearClientOnboardingState(): void {
  for (const key of ONBOARDING_LS_KEYS) {
    storageRemove(key);
  }
}

/** Keep wizard resume keys when returning from in-wizard OAuth. */
export function clearStaleOnboardingLocalState(): void {
  for (const key of ONBOARDING_LS_KEYS) {
    if (key === 'wizard_active' || key === 'wizard_step') continue;
    storageRemove(key);
  }
}
