import type { BoatBlankKey, BoatWaiverAnswers } from '../lib/boatWaiver';

type Props = {
  value: BoatWaiverAnswers;
  onChange: (next: BoatWaiverAnswers) => void;
  disabled?: boolean;
  /** Blanks still open. Omitted fields were already filled in by the host. */
  ask?: BoatBlankKey[];
};

const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm';

export function BoatWaiverFields({ value, onChange, disabled, ask }: Props) {
  const set = (patch: Partial<BoatWaiverAnswers>) => onChange({ ...value, ...patch });
  const show = (key: BoatBlankKey) => !ask || ask.includes(key);
  const onlyName = ask && ask.every((key) => key === 'participant' || key === 'emergencyContact' || key === 'emergencyPhone');

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-semibold text-slate-900">{onlyName ? 'Your details' : 'Fill in the blanks'}</p>
      <p className="text-xs text-slate-500">
        {onlyName
          ? 'The boat details are already on this waiver. Enter your name. Your signature below is the participant signature.'
          : 'These answers are written into the waiver. Your signature below is the participant signature.'}
      </p>
      {show('vessel') && (
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
      )}
      {show('owner') && (
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
      )}
      {show('outingDate') && (
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
      )}
      {show('participant') && (
      <label className="block rounded-2xl border-2 border-red-500 bg-red-50 p-4">
        <span className="text-base font-bold text-red-700">Your full name</span>
        <input
          type="text"
          value={value.participant}
          disabled={disabled}
          onChange={(e) => set({ participant: e.target.value })}
          placeholder="Type your full name"
          className="mt-2 w-full rounded-xl border-2 border-red-400 bg-white px-4 py-4 text-lg font-medium text-slate-900 placeholder:text-red-300"
          autoComplete="name"
          required
        />
      </label>
      )}
      {show('emergencyContact') && (
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
      )}
      {show('emergencyPhone') && (
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
      )}
    </div>
  );
}
