import { Plus, Trash2 } from 'lucide-react';
import {
  MAX_WAIVER_PARTICIPANTS,
  newWaiverParticipant,
  type WaiverParticipant,
} from '../lib/waiverParticipants';

type Props = {
  participants: WaiverParticipant[];
  onChange: (rows: WaiverParticipant[]) => void;
  disabled?: boolean;
  title?: string;
  hint?: string;
  /** When true, the last row can be removed so the list can be empty. */
  allowEmpty?: boolean;
};

/** Shared child rows — signing page now, venue Waiver-by-Text later. */
export function WaiverParticipantsFields({
  participants,
  onChange,
  disabled,
  title = 'People on this waiver',
  hint = `Add each person, up to ${MAX_WAIVER_PARTICIPANTS}. One signature covers everyone listed.`,
  allowEmpty = false,
}: Props) {
  const update = (id: string, patch: Partial<WaiverParticipant>) => {
    onChange(participants.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      {participants.map((row, index) => (
        <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-2 items-end">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Person {index + 1} full name</span>
            <input
              type="text"
              autoComplete="off"
              value={row.fullName}
              disabled={disabled}
              onChange={(e) => update(row.id, { fullName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Date of birth</span>
            <input
              type="date"
              value={row.dateOfBirth}
              disabled={disabled}
              onChange={(e) => update(row.id, { dateOfBirth: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              required
            />
          </label>
          {participants.length > 1 || allowEmpty ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(participants.filter((p) => p.id !== row.id))}
              className="min-h-11 px-3 rounded-xl border border-slate-200 text-slate-500 inline-flex items-center justify-center"
              aria-label={`Remove person ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
        </div>
      ))}
      {participants.length < MAX_WAIVER_PARTICIPANTS ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...participants, newWaiverParticipant()])}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600"
        >
          <Plus className="h-4 w-4" /> Add a person
        </button>
      ) : (
        <p className="text-xs text-slate-500">Maximum of {MAX_WAIVER_PARTICIPANTS} people on one signature.</p>
      )}
    </div>
  );
}
