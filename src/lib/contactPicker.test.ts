import { describe, expect, it } from 'vitest';
import { splitContactName, toContactPickerSelection } from './contactPicker';

describe('splitContactName', () => {
  it('splits first and last', () => {
    expect(splitContactName('Jane Smith')).toEqual({ firstName: 'Jane', lastName: 'Smith' });
  });

  it('keeps multi-word last names together', () => {
    expect(splitContactName('Mary Ann van der Berg')).toEqual({
      firstName: 'Mary',
      lastName: 'Ann van der Berg',
    });
  });

  it('handles single token and empty', () => {
    expect(splitContactName('Madonna')).toEqual({ firstName: 'Madonna', lastName: '' });
    expect(splitContactName('')).toEqual({ firstName: '', lastName: '' });
    expect(splitContactName(null)).toEqual({ firstName: '', lastName: '' });
  });
});

describe('toContactPickerSelection', () => {
  it('maps contact fields', () => {
    const sel = toContactPickerSelection({
      id: '1',
      email: 'jane@example.com',
      full_name: 'Jane Smith',
      phone: '3056611234',
      company: 'Acme',
      source: 'gmail',
    });
    expect(sel.firstName).toBe('Jane');
    expect(sel.lastName).toBe('Smith');
    expect(sel.email).toBe('jane@example.com');
    expect(sel.phone).toContain('305');
    expect(sel.source).toBe('gmail');
  });
});
