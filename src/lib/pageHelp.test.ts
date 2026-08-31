import { describe, expect, it } from 'vitest';
import { getPageHelp } from './pageHelp';

describe('getPageHelp', () => {
  it('explains reminders on the reminders settings tab', () => {
    const g = getPageHelp('/dashboard/reminders');
    expect(g.title).toMatch(/reminder/i);
    expect(g.steps.length).toBeGreaterThan(1);
  });

  it('explains quotes on the quotes page', () => {
    expect(getPageHelp('/dashboard/quotes').title).toMatch(/quote/i);
  });

  it('explains documents on the documents page', () => {
    expect(getPageHelp('/dashboard/documents').title).toMatch(/document/i);
    expect(getPageHelp('/dashboard/documents/new').purpose).toMatch(/challenged/i);
  });
});
