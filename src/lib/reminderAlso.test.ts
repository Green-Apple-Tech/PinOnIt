import { describe, expect, it } from 'vitest';
import { newAlsoPerson, resolveAlsoPeople } from './reminderAlso';

describe('resolveAlsoPeople', () => {
  const roster = [
    { ...newAlsoPerson(), id: 'a', name: 'Alex', scope: 'manual' as const },
    { ...newAlsoPerson(), id: 'b', name: 'Bob', scope: 'all' as const },
    {
      ...newAlsoPerson(),
      id: 'c',
      name: 'Carol',
      scope: 'services' as const,
      service_ids: ['svc-1'],
    },
  ];

  it('includes all-scope and service-scope plus manual picks', () => {
    const out = resolveAlsoPeople(roster, { serviceId: 'svc-1', bookingAlsoIds: ['a'] });
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('excludes manual-only unless picked on booking', () => {
    const out = resolveAlsoPeople(roster, { serviceId: 'svc-2', bookingAlsoIds: [] });
    expect(out.map((p) => p.id)).toEqual(['b']);
  });
});
