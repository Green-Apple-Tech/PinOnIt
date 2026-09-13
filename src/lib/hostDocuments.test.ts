import { describe, expect, it } from 'vitest';
import { activeHostDocumentFiles, templateNameFromFile, type HostDocumentFile } from './hostDocuments';

function file(partial: Partial<HostDocumentFile>): HostDocumentFile {
  return {
    id: '1',
    host_id: 'h',
    name: 'Waiver',
    file_path: 'h/library/a.pdf',
    file_name: 'waiver.pdf',
    file_size_bytes: 100,
    archived_at: null,
    ...partial,
  };
}

describe('hostDocuments library helpers', () => {
  it('hides archived PDFs from the send picker', () => {
    const rows = [
      file({ id: 'a', archived_at: null }),
      file({ id: 'b', archived_at: '2026-09-13T00:00:00Z' }),
    ];
    expect(activeHostDocumentFiles(rows).map((f) => f.id)).toEqual(['a']);
  });

  it('names a template from the file name', () => {
    expect(templateNameFromFile(new File([], 'Standard zip-line waiver.PDF'))).toBe(
      'Standard zip-line waiver',
    );
  });
});
