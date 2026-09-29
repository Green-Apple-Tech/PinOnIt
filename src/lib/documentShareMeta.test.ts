import { describe, expect, it } from 'vitest';
import { documentShareDescription, documentShareTitle } from './documentShareMeta';

describe('document share preview', () => {
  it('uses the customized topic instead of the marketing card', () => {
    expect(documentShareTitle({
      document_type: 'boat_waiver',
      topic: 'Miami Expeditions Standard Boat Waiver',
    })).toBe('Miami Expeditions Standard Boat Waiver');
    expect(documentShareDescription({
      document_type: 'boat_waiver',
      sender_business_name: 'Miami Expeditions LLC',
    })).toBe('Tap to read and sign. From Miami Expeditions LLC.');
  });

  it('falls back to sign this document when there is no topic', () => {
    expect(documentShareTitle({ document_type: 'nda' })).toBe('Sign this NDA');
    expect(documentShareTitle({})).toBe('Sign this document');
  });
});
