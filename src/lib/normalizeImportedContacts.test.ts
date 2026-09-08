import { describe, expect, it } from 'vitest';
import {
  expandImportedContact,
  isValidEmail,
  isValidSingleName,
  normalizeImportedContacts,
  splitContactDelimiters,
} from './normalizeImportedContacts';

describe('isValidEmail', () => {
  it('accepts a single address', () => {
    expect(isValidEmail('andy@sunshieldawnings.com')).toBe(true);
  });

  it('rejects concatenated addresses', () => {
    expect(isValidEmail('a@x.com;b@y.com')).toBe(false);
    expect(isValidEmail('a@x.com, b@y.com')).toBe(false);
  });
});

describe('isValidSingleName', () => {
  it('accepts a normal person name and Last, First', () => {
    expect(isValidSingleName('Cristina Couto')).toBe(true);
    expect(isValidSingleName('Smith, Jane')).toBe(true);
  });

  it('rejects two people jammed into one field', () => {
    expect(isValidSingleName('cristina couto, peter stebbins')).toBe(false);
    expect(isValidSingleName('cristina couto;peter stebbins')).toBe(false);
  });
});

describe('splitContactDelimiters', () => {
  it('splits Outlook semicolon blobs', () => {
    expect(splitContactDelimiters('cristina couto;peter stebbins;andy@sunshieldawnings.com')).toEqual([
      'cristina couto',
      'peter stebbins',
      'andy@sunshieldawnings.com',
    ]);
  });

  it('keeps Last, First together', () => {
    expect(splitContactDelimiters('Smith, Jane')).toEqual(['Smith, Jane']);
  });
});

describe('expandImportedContact', () => {
  it('splits a concatenated Outlook row and drops unpaired names', () => {
    const rows = expandImportedContact({
      host_id: 'h1',
      email: 'andy@sunshieldawnings.com',
      full_name: 'cristina couto;peter stebbins;andy@sunshieldawnings.com',
      phone: null,
      company: null,
      source: 'outlook',
    });
    expect(rows).toEqual([
      expect.objectContaining({
        email: 'andy@sunshieldawnings.com',
        full_name: null,
      }),
    ]);
  });

  it('pairs one name with one email', () => {
    const rows = expandImportedContact({
      email: 'jane@example.com',
      full_name: 'Jane Smith',
      phone: '3055551212',
      company: 'Acme',
      source: 'outlook',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe('Jane Smith');
    expect(rows[0].email).toBe('jane@example.com');
  });

  it('zips matching name/email lists', () => {
    const rows = expandImportedContact({
      email: 'a@x.com;b@y.com',
      full_name: 'Ann;Bob',
      phone: '1',
      company: null,
      source: 'outlook',
    });
    expect(rows).toEqual([
      expect.objectContaining({ email: 'a@x.com', full_name: 'Ann', phone: '1' }),
      expect.objectContaining({ email: 'b@y.com', full_name: 'Bob', phone: null }),
    ]);
  });

  it('drops rows with no valid email', () => {
    expect(expandImportedContact({
      email: 'not-an-email',
      full_name: 'Someone',
      phone: null,
      company: null,
      source: 'outlook',
    })).toEqual([]);
  });
});

describe('normalizeImportedContacts', () => {
  it('dedupes by email after expand', () => {
    const rows = normalizeImportedContacts([
      {
        email: 'jane@example.com',
        full_name: 'Jane',
        phone: null,
        company: null,
        source: 'outlook',
      },
      {
        email: 'jane@example.com',
        full_name: null,
        phone: '3055551212',
        company: 'Acme',
        source: 'outlook',
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe('Jane');
    expect(rows[0].phone).toBe('3055551212');
    expect(rows[0].company).toBe('Acme');
  });
});
