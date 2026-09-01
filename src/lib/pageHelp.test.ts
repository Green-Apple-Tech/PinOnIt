import { describe, expect, it } from 'vitest';
import { getPageHelp } from './pageHelp';

describe('getPageHelp', () => {
  it('explains reminders on the reminders settings tab', () => {
    const g = getPageHelp('/dashboard/reminders');
    expect(g.title).toMatch(/reminder/i);
    expect(g.steps.length).toBeGreaterThan(1);
  });

  it('explains event types and contacts on the settings tabs', () => {
    expect(getPageHelp('/dashboard/settings', '?tab=event-types').title).toMatch(/event type/i);
    expect(getPageHelp('/dashboard/settings', '?tab=contacts').title).toMatch(/contact/i);
  });

  it('explains the Docs settings tab', () => {
    expect(getPageHelp('/dashboard/settings', '?tab=docs').title).toMatch(/docs/i);
    expect(getPageHelp('/dashboard/settings', '?tab=docs').purpose).toMatch(/waiver/i);
  });

  it('explains Doc Center on the quotes and documents routes', () => {
    expect(getPageHelp('/dashboard/quotes').title).toMatch(/doc center/i);
    expect(getPageHelp('/dashboard/documents').title).toMatch(/doc center/i);
    expect(getPageHelp('/dashboard/documents/new').purpose).toMatch(/strong legal position/i);
  });
});
