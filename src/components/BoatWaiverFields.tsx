import type { BoatWaiverAnswers } from '../lib/boatWaiver';

type Props = {
  value: BoatWaiverAnswers;
  onChange: (next: BoatWaiverAnswers) => void;
  disabled?: boolean;
};

const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm';

export function BoatWaiverFields({ value, onChange, disabled }: Props) {
  const set = (patch: Partial<BoatWaiverAnswers>) => onChange({ ...value, ...patch });

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-semibold text-slate-900">Fill in the blanks</p>
      <p className="text-xs text-slate-500">
        These answers are written into the waiver. Your signature below is the participant signature.
      </p>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Vessel</span>
        <input
          type="text"
          value={value.vessel}
          disabled={disabled}
          onChange={(e) => set({ vessel: e.target.value })}
          className={inputCls}
          autoComplete="off"
          required
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Vessel owner/operator</span>
        <input
          type="text"
          value={value.owner}
          disabled={disabled}
          onChange={(e) => set({ owner: e.target.value })}
          className={inputCls}
          autoComplete="organization"
          required
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Date of outing</span>
        <input
          type="date"
          value={value.outingDate}
          disabled={disabled}
          onChange={(e) => set({ outingDate: e.target.value })}
          className={inputCls}
          required
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Your full name</span>
        <input
          type="text"
          value={value.participant}
          disabled={disabled}
          onChange={(e) => set({ participant: e.target.value })}
          className={inputCls}
          autoComplete="name"
          required
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Emergency contact</span>
        <input
          type="text"
          value={value.emergencyContact}
          disabled={disabled}
          onChange={(e) => set({ emergencyContact: e.target.value })}
          className={inputCls}
          autoComplete="off"
          required
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Emergency contact phone</span>
        <input
          type="tel"
          value={value.emergencyPhone}
          disabled={disabled}
          onChange={(e) => set({ emergencyPhone: e.target.value })}
          className={inputCls}
          autoComplete="tel"
          required
        />
      </label>
    </div>
  );
}
