import { useEffect, useState } from 'react';
import { getDocumentWaiverParticipants } from '../lib/documents';
import { ageFromDob } from '../lib/waiverParticipants';

export function HostWaiverParticipants({ documentId, status }: { documentId: string; status: string }) {
  const [rows, setRows] = useState<Array<{ full_name: string; date_of_birth: string }>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || status !== 'signed') return;
    void getDocumentWaiverParticipants(documentId).then(({ data }) => {
      setRows(data);
    });
  }, [documentId, open, status]);

  if (status !== 'signed') return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-brand-600"
      >
        {open ? 'Hide children' : 'View children on this waiver'}
      </button>
      {open && (
        <ul className="mt-1 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
          {rows.length === 0 ? (
            <li>No participant rows (they may have been removed by your retention setting).</li>
          ) : (
            rows.map((row) => {
              const age = ageFromDob(row.date_of_birth);
              return (
                <li key={`${row.full_name}-${row.date_of_birth}`}>
                  {row.full_name}
                  {row.date_of_birth ? ` · born ${row.date_of_birth}` : ''}
                  {age != null ? ` · ${age}` : ''}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
