import { describe, expect, it } from 'vitest';
import { WIZARD_STEPS, wizardStartIndex } from './wizardSteps';

describe('wizardStartIndex', () => {
  it('starts a new host at Welcome', () => {
    expect(wizardStartIndex({
      onboardingCompleted: false,
      hasServices: false,
      hasSlug: false,
    })).toBe(WIZARD_STEPS.indexOf('welcome'));
  });

  it('starts an already-setup account on industry, not Welcome', () => {
    expect(wizardStartIndex({
      onboardingCompleted: true,
      hasServices: true,
      hasSlug: true,
    })).toBe(WIZARD_STEPS.indexOf('business_type'));
  });
});
