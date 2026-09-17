import { Check, Loader2, Mail, MessageSquare, PhoneCall, Smartphone } from 'lucide-react';

export type ReminderChannelKey = 'email' | 'sms' | 'whatsapp' | 'voice';

export const REMINDER_GRID_SLOTS = [
  { key: 'confirmation', label: 'Booking Confirmation', sublabel: 'Sent immediately when someone books', offset: 0 },
  { key: 'reminder_15m', label: '15 Min Reminder', sublabel: '15 minutes before the event', offset: -15 },
  { key: 'reminder_30m', label: '30 Min Reminder', sublabel: '30 minutes before the event', offset: -30 },
  { key: 'reminder_60m', label: '1 Hour Reminder', sublabel: '60 minutes before the event', offset: -60 },
  { key: 'reminder_24h', label: '24 Hour Reminder', sublabel: '1 day before the event', offset: -1440 },
  { key: 'reminder_48h', label: '48 Hour Reminder', sublabel: '2 days before the event', offset: -2880 },
] as const;

export const REMINDER_GRID_CHANNELS: { key: ReminderChannelKey; label: string; color: string }[] = [
  { key: 'email', label: 'Email', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'sms', label: 'SMS', color: 'text-amber-600 dark:text-amber-400' },
  { key: 'whatsapp', label: 'WhatsApp', color: 'text-[#5864C6] dark:text-[#8891e8]' },
  { key: 'voice', label: 'Voice Call', color: 'text-violet-600 dark:text-violet-400' },
];

const MATRIX_GRID = 'grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(2.75rem,4.5rem))] gap-x-2 sm:gap-x-4';

function ChannelGlyph({ channel, className }: { channel: ReminderChannelKey; className?: string }) {
  const cls = className ?? 'h-5 w-5';
  if (channel === 'sms') return <Smartphone className={cls} />;
  if (channel === 'whatsapp') return <MessageSquare className={cls} />;
  if (channel === 'voice') return <PhoneCall className={cls} />;
  return <Mail className={cls} />;
}

function slotLabel(offset: number): string {
  return REMINDER_GRID_SLOTS.find((s) => s.offset === offset)?.label
    ?? `${Math.abs(offset)} min before`;
}

export function reminderGridLabel(offset: number): string {
  return slotLabel(offset);
}

type Props = {
  isChecked: (offset: number, channel: ReminderChannelKey) => boolean;
  onToggle: (offset: number, channel: ReminderChannelKey) => void;
  savingKey?: string | null;
  locked?: (offset: number, channel: ReminderChannelKey) => boolean;
};

export function ReminderChannelGrid({ isChecked, onToggle, savingKey, locked }: Props) {
  const cell = (offset: number, channel: ReminderChannelKey) => `${offset}:${channel}`;

  const box = (offset: number, ch: (typeof REMINDER_GRID_CHANNELS)[number], slotLabelText: string) => {
    const saving = savingKey === cell(offset, ch.key);
    const checked = isChecked(offset, ch.key);
    const isLocked = locked?.(offset, ch.key) ?? false;
    return (
      <div key={ch.key} className="flex justify-center">
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#5864C6' }} />
        ) : (
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onToggle(offset, ch.key)}
            aria-label={`${slotLabelText} — ${ch.label}${isLocked ? ' (always on)' : ''}`}
            className={`h-10 w-10 rounded-lg flex items-center justify-center border-2 transition-all ${
              checked
                ? 'border-transparent'
                : 'border-slate-300 dark:border-slate-600 hover:border-[#5864C6]/50'
            } disabled:cursor-default`}
            style={checked ? { backgroundColor: '#5864C6', borderColor: '#5864C6' } : {}}
          >
            {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="md:hidden space-y-2.5">
        {REMINDER_GRID_SLOTS.map((slot) => {
          const anyActive = REMINDER_GRID_CHANNELS.some((ch) => isChecked(slot.offset, ch.key));
          return (
            <div
              key={slot.key}
              className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3.5 ${anyActive ? '' : 'opacity-70'}`}
            >
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">{slot.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{slot.sublabel}</p>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {REMINDER_GRID_CHANNELS.map((ch) => (
                  <div key={ch.key} className="flex flex-col items-center gap-1">
                    {box(slot.offset, ch, slot.label)}
                    <span className={`text-[9px] font-semibold uppercase tracking-wide text-center leading-tight ${ch.color}`}>
                      {ch.key === 'whatsapp' ? 'WA' : ch.label.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className={`${MATRIX_GRID} items-center px-4 lg:px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800`}>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">When</span>
            {REMINDER_GRID_CHANNELS.map((ch) => (
              <div key={ch.key} className={`flex flex-col items-center justify-center gap-1 text-center ${ch.color}`}>
                <ChannelGlyph channel={ch.key} className={`h-5 w-5 shrink-0 ${ch.color}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wide leading-tight">{ch.label}</span>
              </div>
            ))}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {REMINDER_GRID_SLOTS.map((slot) => {
              const anyActive = REMINDER_GRID_CHANNELS.some((ch) => isChecked(slot.offset, ch.key));
              return (
                <div
                  key={slot.key}
                  className={`${MATRIX_GRID} items-center px-4 lg:px-5 py-3.5 ${anyActive ? '' : 'opacity-60'}`}
                >
                  <div className="min-w-0 pr-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{slot.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{slot.sublabel}</p>
                  </div>
                  {REMINDER_GRID_CHANNELS.map((ch) => box(slot.offset, ch, slot.label))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
