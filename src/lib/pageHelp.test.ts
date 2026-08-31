import { describe, expect, it } from 'vitest';
import { getPageHelp } from './pageHelp';

describe('getPageHelp', () => {
  it('explains reminders on the reminders settings tab', () => {
    const g = getPageHelp('/dashboard/reminders');
    expect(g.title).toMatch(/reminder/i);
    expect(g.steps.length).toBeGreaterThan(1);
  });

  it('explains Doc Center on the quotes and documents routes', () => {
    expect(getPageHelp('/dashboard/quotes').title).toMatch(/doc center/i);
    expect(getPageHelp('/dashboard/documents').title).toMatch(/doc center/i);
    expect(getPageHelp('/dashboard/documents/new').purpose).toMatch(/challenged/i);
  });
});
