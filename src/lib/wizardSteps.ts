export const WIZARD_STEPS = [
  'welcome',
  'business_type',
  'username',
  'phone',
  'timezone',
  'calendar',
  'calendar_purpose',
  'contacts',
  'booking_link',
  'video',
  'done',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Re-running Wizard Setup on an account that already has a booking page starts at industry, not Welcome/trial. */
export function wizardStartIndex(opts: {
  onboardingCompleted?: boolean | null;
  hasServices: boolean;
  hasSlug: boolean;
}): number {
  const established = opts.onboardingCompleted === true || (opts.hasServices && opts.hasSlug);
  return established ? WIZARD_STEPS.indexOf('business_type') : WIZARD_STEPS.indexOf('welcome');
}
