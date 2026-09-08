import { describe, expect, it } from 'vitest';
import {
  splitContactName,
  toContactPickerSelection,
  contactSourceLabel,
  contactFillPreview,
  expandPickerContact,
  rankPickerContacts,
  filterPickerContacts,
} from './contactPicker';

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

describe('contactSourceLabel', () => {
  it('labels known sources', () => {
    expect(contactSourceLabel('gmail')).toBe('Gmail');
    expect(contactSourceLabel('outlook')).toBe('Outlook');
    expect(contactSourceLabel('booking')).toBe('Booked');
    expect(contactSourceLabel('manual')).toBe('Saved');
    expect(contactSourceLabel('device')).toBe('Phone');
  });
});

describe('contactFillPreview', () => {
  it('lists name, phone, and email when present', () => {
    expect(contactFillPreview({
      id: '1',
      email: 'jane@example.com',
      full_name: 'Jane Smith',
      phone: '3055551212',
      company: null,
      source: 'manual',
    })).toEqual(['name', 'phone', 'email']);
  });
});

describe('expandPickerContact', () => {
  it('splits concatenated Outlook rows for search', () => {
    const rows = expandPickerContact({
      id: 'blob',
      email: 'andy@sunshieldawnings.com',
      full_name: 'cristina couto;peter stebbins;andy@sunshieldawnings.com',
      phone: null,
      company: null,
      source: 'outlook',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('andy@sunshieldawnings.com');
    expect(rows[0].full_name).toBeNull();
  });
});

describe('rankPickerContacts', () => {
  it('puts contacts with a phone first', () => {
    const ranked = rankPickerContacts([
      { id: '1', email: 'a@x.com', full_name: 'Ann', phone: null, company: null, source: 'outlook' },
      { id: '2', email: 'b@x.com', full_name: 'Bob', phone: '3055551212', company: null, source: 'outlook' },
    ]);
    expect(ranked[0].full_name).toBe('Bob');
  });
});

describe('filterPickerContacts', () => {
  const rows = [
    { id: '1', email: 'jane@example.com', full_name: 'Jane Smith', phone: '(305) 555-1212', company: 'Acme', source: 'manual' },
    { id: '2', email: 'bob@x.com', full_name: 'Bob', phone: null, company: null, source: 'gmail' },
  ];

  it('matches name, email, and phone digits', () => {
    expect(filterPickerContacts(rows, 'jane')).toHaveLength(1);
    expect(filterPickerContacts(rows, '5551212')[0].full_name).toBe('Jane Smith');
    expect(filterPickerContacts(rows, 'bob@x')).toHaveLength(1);
  });
});
