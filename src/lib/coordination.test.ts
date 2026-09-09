import { describe, expect, it } from 'vitest';
import {
  buildCoordinationIcs,
  coordinationContextLabel,
  coordinationPageUrl,
  formatCoordinationSlot,
} from './coordination';

describe('coordination helpers', () => {
  it('labels context types for display copy', () => {
    expect(coordinationContextLabel('showing')).toBe('Showing');
    expect(coordinationContextLabel('consultation')).toBe('Consultation');
    expect(coordinationContextLabel('meeting')).toBe('Meeting');
    expect(coordinationContextLabel(null)).toBe('Meeting');
  });

  it('builds a public /c/:token URL', () => {
    expect(coordinationPageUrl('abc', 'https://pinonit.com')).toBe('https://pinonit.com/c/abc');
  });

  it('numbers flattened host slots from 0', async () => {
    const { flattenSelectedSlotsToProposed } = await import('./coordination');
    const rows = flattenSelectedSlotsToProposed(
      { '2026-09-15': ['09:00', '14:00'], '2026-09-16': ['10:00'] },
      60,
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].sort_order).toBe(0);
    expect(rows[2].sort_order).toBe(2);
    expect(new Date(rows[0].end_time).getTime() - new Date(rows[0].start_time).getTime()).toBe(60 * 60_000);
  });

  it('formats a slot for SMS and the guest page', () => {
    const label = formatCoordinationSlot('2026-09-15T15:00:00.000Z', '2026-09-15T16:00:00.000Z');
    expect(label).toMatch(/Sep/);
    expect(label).toMatch(/–/);
  });

  it('emits a VCALENDAR body', () => {
    const ics = buildCoordinationIcs({
      uid: 'coord-1@pinonit.com',
      title: 'Vendor Consultation',
      location: '123 Main St',
      startIso: '2026-09-15T15:00:00.000Z',
      endIso: '2026-09-15T16:00:00.000Z',
    });
    expect(ics).toMatch(/BEGIN:VCALENDAR/);
    expect(ics).toMatch(/SUMMARY:Vendor Consultation/);
    expect(ics).toMatch(/LOCATION:123 Main St/);
  });
});
