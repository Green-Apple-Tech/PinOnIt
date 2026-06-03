/** Browser-only onboarding flags — must not outlive a DB wipe / fresh account. */

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
  return localStorage.getItem('onboarding_completed') === '1';
}

export function wizardIsActiveLocal(): boolean {
  return localStorage.getItem('wizard_active') === '1';
}

export function wizardSavedStepLocal(): number {
  return Number(localStorage.getItem('wizard_step') ?? '0');
}

export function markOnboardingCompletedLocal(): void {
  localStorage.setItem('onboarding_completed', '1');
  localStorage.removeItem('wizard_active');
  localStorage.removeItem('wizard_step');
}

export function setWizardActiveLocal(stepIndex: number): void {
  localStorage.setItem('wizard_active', '1');
  localStorage.setItem('wizard_step', String(stepIndex));
}

export function clearWizardLocal(): void {
  localStorage.removeItem('wizard_active');
  localStorage.removeItem('wizard_step');
}

/** Clear stale client state after DB wipe, sign-out, or fresh login. */
export function clearClientOnboardingState(): void {
  for (const key of ONBOARDING_LS_KEYS) {
    localStorage.removeItem(key);
  }
}

/** Keep wizard resume keys when returning from in-wizard OAuth. */
export function clearStaleOnboardingLocalState(): void {
  for (const key of ONBOARDING_LS_KEYS) {
    if (key === 'wizard_active' || key === 'wizard_step') continue;
    localStorage.removeItem(key);
  }
}
