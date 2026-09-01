import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { CONTRACT_HOST_HINT } from './documentCopy';
import { CONTRACT_STARTER_TEXT, fillDocumentPlaceholders } from './documents';

describe('contract starter vs host hint', () => {
  it('keeps the disclaimer out of the contract body', () => {
    expect(CONTRACT_STARTER_TEXT).not.toContain(CONTRACT_HOST_HINT);
    expect(CONTRACT_STARTER_TEXT).not.toMatch(/not legal advice/);
  });

  it('fills Topic and Recipient Name without touching the host hint', () => {
    const filled = fillDocumentPlaceholders(CONTRACT_STARTER_TEXT, {
      topic: 'Website rebuild',
      recipientName: 'Jane Smith',
    });
    expect(filled).toContain('Website rebuild');
    expect(filled).toContain('Jane Smith');
    expect(filled).not.toContain('[Topic]');
    expect(filled).not.toContain('[Recipient Name]');
    expect(filled).not.toContain(CONTRACT_HOST_HINT);
    expect(CONTRACT_HOST_HINT).toMatch(/not legal advice/);
  });
});
