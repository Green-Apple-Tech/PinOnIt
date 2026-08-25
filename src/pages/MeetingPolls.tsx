import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { revealTool } from '../lib/progressiveDisclosure';
import { supabase } from '../lib/supabase';
import type { MeetingPoll, MeetingPollSlot, AvailabilitySlot } from '../lib/types';
import {
  Plus, X, Check, Loader2, ExternalLink, Trash2,
  ChevronDown, ChevronUp, Users, Clock, CalendarDays, Link2,
  BarChart2, CheckCircle2, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const BRAND = '#5864C6';
const TIME_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2,'0')}${suffix}`;
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Returns all YYYY-MM-DD strings in [start, end] inclusive */
function datesInRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  cur.setHours(0,0,0,0);
  const endMs = new Date(end).setHours(0,0,0,0);
  while (cur.getTime() <= endMs) {
    out.push(toYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_ABBR = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1|2|3 }) {
  const steps = [
    { n: 1, label: 'Name & dates' },
    { n: 2, label: 'Choose times' },
    { n: 3, label: 'Review & share' },
  ];
  return (
    <div className="flex items-center gap-0 px-6 pt-5 pb-4">
      {steps.map(({ n, label }, i) => {
        const isCompleted = n < step;
        const isActive = n === step;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2"
                style={
                  isCompleted
                    ? { backgroundColor: '#fff', borderColor: BRAND, color: BRAND }
                    : isActive
                    ? { backgroundColor: BRAND, borderColor: BRAND, color: '#fff' }
                    : { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#94a3b8' }
                }
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span
                className="text-[10px] font-medium whitespace-nowrap transition-colors"
                style={{ color: isActive ? BRAND : isCompleted ? BRAND : '#94a3b8' }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="h-px w-10 mx-1 mb-3 transition-all" style={{ backgroundColor: step > n ? BRAND : '#e2e8f0' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 1: Date range calendar picker
// ─────────────────────────────────────────────────────────────
function DateRangePicker({
  rangeStart, rangeEnd,
  onRangeStart, onRangeEnd,
}: {
  rangeStart: Date | null; rangeEnd: Date | null;
  onRangeStart: (d: Date) => void; onRangeEnd: (d: Date | null) => void;
}) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hovered, setHovered] = useState<Date | null>(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const effectiveEnd = hovered && rangeStart && !rangeEnd ? hovered : rangeEnd;

  const isInRange = (d: Date) => {
    if (!rangeStart) return false;
    const end = effectiveEnd;
    if (!end) return false;
    const [lo, hi] = rangeStart <= end ? [rangeStart, end] : [end, rangeStart];
    return d > lo && d < hi;
  };
  const isStart = (d: Date) => rangeStart ? d.getTime() === rangeStart.getTime() : false;
  const isEnd = (d: Date) => effectiveEnd ? d.getTime() === effectiveEnd.getTime() : false;
  const isPast = (d: Date) => d < today;

  const handleDayClick = (d: Date) => {
    if (isPast(d)) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      onRangeStart(d);
      onRangeEnd(null);
    } else {
      if (d < rangeStart) {
        onRangeStart(d);
      } else {
        onRangeEnd(d);
      }
    }
  };

  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];

  const selectedDates = rangeStart && rangeEnd ? datesInRange(rangeStart, rangeEnd) : [];

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between px-1 mb-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_ABBR.map(d => (
          <div key={d} className="h-7 flex items-center justify-center text-[10px] font-semibold text-slate-400">{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const past = isPast(d);
          const start = isStart(d);
          const end = isEnd(d);
          const inRange = isInRange(d);
          const selected = start || end;
          return (
            <div
              key={d.toISOString()}
              className="relative flex items-center justify-center h-8"
              onMouseEnter={() => { if (rangeStart && !rangeEnd) setHovered(d); }}
              onMouseLeave={() => setHovered(null)}
            >
              {/* range background bar */}
              {(inRange || (start && effectiveEnd && !end) || (end && rangeStart && !start)) && (
                <div
                  className="absolute inset-y-0.5"
                  style={{
                    left: (inRange || end) ? 0 : '50%',
                    right: (inRange || start) ? 0 : '50%',
                    backgroundColor: `${BRAND}20`,
                  }}
                />
              )}
              <button
                onClick={() => handleDayClick(d)}
                disabled={past}
                className={`relative z-10 h-7 w-7 rounded-full text-xs font-semibold transition-all flex items-center justify-center
                  ${past ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : selected ? 'text-white' : inRange ? 'text-slate-700 dark:text-slate-200' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                style={selected ? { backgroundColor: BRAND } : {}}
              >
                {d.getDate()}
              </button>
            </div>
          );
        })}
      </div>
      {/* Summary */}
      {rangeStart && (
        <div className="mt-3 px-1 text-xs text-slate-500 dark:text-slate-400">
          {rangeEnd ? (
            <span><span className="font-semibold" style={{ color: BRAND }}>{selectedDates.length} days</span> selected — {rangeStart.toLocaleDateString('en-US', { month:'short', day:'numeric' })} to {rangeEnd.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>
          ) : (
            <span>Now click an end date to complete your range</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2: Visual time grid
// ─────────────────────────────────────────────────────────────
interface TimeGridProps {
  dates: string[]; // YYYY-MM-DD[]
  selected: Set<string>; // "YYYY-MM-DD|HH:MM"
  onToggle: (key: string) => void;
  availableSlots: AvailabilitySlot[];
}

function TimeGrid({ dates, selected, onToggle, availableSlots }: TimeGridProps) {
  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const draggedRef = useRef<Set<string>>(new Set());

  const isAvailable = useCallback((date: string, time: string) => {
    if (availableSlots.length === 0) return true;
    const dow = parseYMD(date).getDay();
    return availableSlots.some(s =>
      s.is_active && s.day_of_week === dow &&
      s.start_time <= time && s.end_time > time
    );
  }, [availableSlots]);

  const handleCellDown = (key: string) => {
    if (!isAvailable(key.split('|')[0], key.split('|')[1])) return;
    const mode = selected.has(key) ? 'deselect' : 'select';
    setDragMode(mode);
    setDragging(true);
    draggedRef.current = new Set([key]);
    onToggle(key);
  };

  const handleCellEnter = (key: string) => {
    if (!dragging) return;
    if (draggedRef.current.has(key)) return;
    if (!isAvailable(key.split('|')[0], key.split('|')[1])) return;
    draggedRef.current.add(key);
    const isSelected = selected.has(key);
    if (dragMode === 'select' && !isSelected) onToggle(key);
    if (dragMode === 'deselect' && isSelected) onToggle(key);
  };

  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const visibleDates = dates.slice(0, 7);
  const selectedCount = selected.size;

  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Click or drag to toggle slots. <span className="font-medium" style={{ color: BRAND }}>{selectedCount} slot{selectedCount !== 1 ? 's' : ''} selected.</span>
        {availableSlots.length > 0 && <span className="ml-1 text-slate-400">(Grayed = outside your availability)</span>}
      </p>
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="inline-grid gap-px bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
          style={{ gridTemplateColumns: `52px repeat(${visibleDates.length}, minmax(52px, 1fr))` }}
          onMouseLeave={() => setDragging(false)}
        >
          {/* Header row */}
          <div className="bg-white dark:bg-slate-800/50 px-1 py-2" />
          {visibleDates.map(ymd => {
            const d = parseYMD(ymd);
            return (
              <div key={ymd} className="bg-white dark:bg-slate-800/50 px-1 py-2 text-center">
                <p className="text-[9px] font-semibold text-slate-400 uppercase">{d.toLocaleDateString('en-US', { weekday:'short' })}</p>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{d.getDate()}</p>
              </div>
            );
          })}

          {/* Time rows */}
          {TIME_SLOTS.map(time => (
            <>
              {/* Time label */}
              <div key={`lbl-${time}`} className="bg-white dark:bg-slate-800/50 flex items-center justify-end pr-2 py-0">
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatTime(time)}</span>
              </div>
              {visibleDates.map(ymd => {
                const key = `${ymd}|${time}`;
                const sel = selected.has(key);
                const avail = isAvailable(ymd, time);
                return (
                  <div
                    key={key}
                    className={`h-8 cursor-pointer transition-all duration-75
                      ${!avail ? 'bg-slate-50 dark:bg-slate-900/40 cursor-not-allowed' :
                        sel ? '' : 'bg-white dark:bg-slate-800/50 hover:opacity-80'}`}
                    style={sel ? { backgroundColor: BRAND } : {}}
                    onMouseDown={() => handleCellDown(key)}
                    onMouseEnter={() => handleCellEnter(key)}
                  >
                    {sel && (
                      <div className="h-full w-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white opacity-70" />
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
      {visibleDates.length < dates.length && (
        <p className="text-xs text-slate-400 mt-2 text-center">
          Showing first 7 days. {dates.length - 7} more day{dates.length - 7 !== 1 ? 's' : ''} will also be included.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Full CreatePollModal (3 steps)
// ─────────────────────────────────────────────────────────────
interface CreatePollModalProps {
  onClose: () => void;
  onCreated: (poll: MeetingPoll) => void;
}

export function CreatePollModal({ onClose, onCreated }: CreatePollModalProps) {
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<1|2|3>(1);

  // Step 1 — title lives here now
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [titleShake, setTitleShake] = useState(false);
  const [titleLabelFlash, setTitleLabelFlash] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  // Step 2
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);

  // Step 3
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [locationType, setLocationType] = useState<MeetingPoll['location_type']>('video');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const allDates = rangeStart && rangeEnd ? datesInRange(rangeStart, rangeEnd) : (rangeStart ? [toYMD(rangeStart)] : []);

  // Load availability slots when entering step 2
  useEffect(() => {
    if (step !== 2 || !profile) return;
    supabase
      .from('availability_slots')
      .select('*')
      .eq('host_id', profile.id)
      .eq('is_active', true)
      .then(({ data }) => setAvailabilitySlots(data ?? []));
  }, [step, profile]);

  // Pre-populate grid from availability when we enter step 2
  const didPrePopulate = useRef(false);
  useEffect(() => {
    if (step !== 2 || availabilitySlots.length === 0 || didPrePopulate.current) return;
    didPrePopulate.current = true;
    const init = new Set<string>();
    for (const ymd of allDates) {
      const dow = parseYMD(ymd).getDay();
      const matching = availabilitySlots.filter(s => s.is_active && s.day_of_week === dow);
      for (const time of TIME_SLOTS) {
        if (matching.some(s => s.start_time <= time && s.end_time > time)) {
          init.add(`${ymd}|${time}`);
        }
      }
    }
    if (init.size > 0) setSelectedCells(init);
  }, [availabilitySlots, step, allDates]);

  const toggleCell = useCallback((key: string) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const goToStep2 = () => {
    if (!title.trim()) {
      setTitleError(true);
      setTitleShake(true);
      setTitleLabelFlash(true);
      setTimeout(() => setTitleShake(false), 520);
      setTimeout(() => setTitleLabelFlash(false), 950);
      titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      titleRef.current?.focus();
      return;
    }
    if (!rangeStart) { setError('Please select a start date.'); return; }
    if (!rangeEnd) {
      setRangeEnd(rangeStart);
    }
    setError('');
    didPrePopulate.current = false;
    setStep(2);
  };

  const goToStep3 = () => {
    if (selectedCells.size === 0) { setError('Please select at least one time slot.'); return; }
    setError('');
    setStep(3);
  };

  const handleCreate = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');

    const { data: poll, error: pollErr } = await supabase
      .from('meeting_polls')
      .insert({
        host_id: profile.id,
        title: title.trim(),
        description: description.trim(),
        duration_minutes: duration,
        location: location.trim(),
        location_type: locationType,
      })
      .select()
      .maybeSingle();

    if (pollErr || !poll) { setError(pollErr?.message ?? 'Failed to create poll.'); setSaving(false); return; }

    await revealTool(profile.id, 'group-scheduling', profile.revealed_tools);
    await refreshProfile();

    const slots: Array<{ poll_id: string; start_time: string; end_time: string }> = [];
    for (const key of Array.from(selectedCells).sort()) {
      const [ymd, hhmm] = key.split('|');
      const start = new Date(`${ymd}T${hhmm}:00`);
      const end = new Date(start.getTime() + duration * 60000);
      slots.push({ poll_id: poll.id, start_time: start.toISOString(), end_time: end.toISOString() });
    }
    await supabase.from('meeting_poll_slots').insert(slots);

    onCreated(poll as MeetingPoll);
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-0 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Create a meeting poll</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Let your guests vote on the best time.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <StepIndicator step={step} />

        <div className="border-t border-slate-100 dark:border-slate-800 shrink-0" />

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* ── Step 1 ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Title field — top of step 1 */}
              <div>
                <label
                  className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide mb-1.5 transition-colors ${titleLabelFlash ? 'animate-label-flash' : ''}`}
                  style={{ color: titleError && !title.trim() ? '#ef4444' : '#64748b' }}
                >
                  Poll title <span className="text-red-500">*</span>
                </label>
                <div className={titleShake ? 'animate-field-shake' : ''}>
                  <input
                    ref={titleRef}
                    type="text"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(false); }}
                    placeholder="e.g. Q2 Planning Call"
                    className={`w-full px-3 py-2.5 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition text-sm border ${titleError && !title.trim() ? 'border-red-400 focus:ring-red-300' : 'border-slate-200 dark:border-slate-700'}`}
                    style={titleError && !title.trim() ? {} : { '--tw-ring-color': BRAND } as React.CSSProperties}
                  />
                  {titleError && !title.trim() && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Please add a title before creating your poll
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Select your available dates</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Click a start date, then click the end date to highlight a range.</p>
                <DateRangePicker
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  onRangeStart={setRangeStart}
                  onRangeEnd={setRangeEnd}
                />
              </div>

              {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
            </div>
          )}

          {/* ── Step 2 ─────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Choose your available times</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Click or drag cells to toggle time slots. Pre-filled from your availability settings.</p>
              <TimeGrid
                dates={allDates}
                selected={selectedCells}
                onToggle={toggleCell}
                availableSlots={availabilitySlots}
              />
              {error && <p className="mt-3 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
            </div>
          )}

          {/* ── Step 3 ─────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Review & share</p>
                {/* Summary pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ borderColor: `${BRAND}40`, backgroundColor: `${BRAND}10`, color: BRAND }}>
                    <CalendarDays className="h-3.5 w-3.5" />{allDates.length} day{allDates.length !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ borderColor: `${BRAND}40`, backgroundColor: `${BRAND}10`, color: BRAND }}>
                    <Clock className="h-3.5 w-3.5" />{selectedCells.size} time slot{selectedCells.size !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Poll title: <span className="font-semibold text-slate-700 dark:text-slate-300">{title}</span></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Description <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Add context for your guests…" className={inputCls + ' resize-none'} style={{ '--tw-ring-color': BRAND } as React.CSSProperties} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Duration</label>
                  <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls}>
                    {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Meeting type</label>
                  <select value={locationType} onChange={(e) => setLocationType(e.target.value as MeetingPoll['location_type'])} className={inputCls}>
                    <option value="video">Video call</option>
                    <option value="phone">Phone</option>
                    <option value="in_person">In person</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Location / link <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="https://zoom.us/j/… or address" className={inputCls} />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center gap-3 shrink-0">
          {step > 1 && (
            <button
              onClick={() => setStep(s => (s - 1) as 1|2|3)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          <button
            onClick={step === 1 ? goToStep2 : step === 2 ? goToStep3 : handleCreate}
            disabled={saving}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === 1 ? <><span>Choose times</span><ChevronRight className="h-4 w-4" /></> :
             step === 2 ? <><span>Review</span><ChevronRight className="h-4 w-4" /></> :
             saving ? 'Creating…' : <><Plus className="h-4 w-4" /><span>Create poll & get link</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Host heatmap view (in expanded PollCard)
// ─────────────────────────────────────────────────────────────
function HeatmapGrid({ poll, onConfirm }: { poll: PollWithStats; onConfirm: (slotId: string) => void }) {
  if (poll.slots.length === 0) return <p className="text-sm text-slate-400 py-4 text-center">No time slots yet.</p>;

  const maxVotes = Math.max(...poll.slots.map(s => s.yesCount), 1);

  // Group by date
  const byDate: Record<string, typeof poll.slots> = {};
  for (const s of poll.slots) {
    const key = toYMD(new Date(s.start_time));
    (byDate[key] ??= []).push(s);
  }
  const dates = Object.keys(byDate).sort();

  // Collect all unique times
  const allTimes = Array.from(new Set(poll.slots.map(s => {
    const d = new Date(s.start_time);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }))).sort();

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Darker = more votes. Click <span className="font-semibold text-slate-700 dark:text-slate-300">Confirm</span> to lock in a time.</p>
      <div
        className="inline-grid gap-px bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-xs"
        style={{ gridTemplateColumns: `56px repeat(${dates.length}, minmax(72px, 1fr))` }}
      >
        {/* Header */}
        <div className="bg-white dark:bg-slate-800/50 py-2" />
        {dates.map(ymd => {
          const d = new Date(ymd + 'T00:00:00');
          return (
            <div key={ymd} className="bg-white dark:bg-slate-800/50 px-1 py-2 text-center">
              <p className="text-[9px] font-semibold text-slate-400 uppercase">{d.toLocaleDateString('en-US', { weekday:'short' })}</p>
              <p className="text-xs font-bold text-slate-800 dark:text-white">{d.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</p>
            </div>
          );
        })}

        {/* Rows */}
        {allTimes.map(time => (
          <>
            <div key={`lbl-${time}`} className="bg-white dark:bg-slate-800/50 flex items-center justify-end pr-2 py-0">
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatTime(time)}</span>
            </div>
            {dates.map(ymd => {
              const slot = byDate[ymd]?.find(s => {
                const d = new Date(s.start_time);
                const t = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                return t === time;
              });
              if (!slot) {
                return <div key={`${ymd}-${time}`} className="bg-slate-50 dark:bg-slate-900/40 h-9" />;
              }
              const ratio = slot.yesCount / maxVotes;
              const bgAlpha = Math.round(ratio * 255).toString(16).padStart(2,'0');
              const isBest = slot.yesCount === maxVotes && slot.yesCount > 0;
              return (
                <div
                  key={`${ymd}-${time}`}
                  className={`relative h-9 flex items-center justify-center group transition-all ${poll.status === 'open' ? 'cursor-pointer' : ''}`}
                  style={{ backgroundColor: slot.yesCount > 0 ? `${BRAND}${bgAlpha}` : '#f8fafc' }}
                >
                  {slot.yesCount > 0 && (
                    <span className="text-[10px] font-bold" style={{ color: ratio > 0.5 ? '#fff' : BRAND }}>
                      {slot.yesCount}✓
                    </span>
                  )}
                  {isBest && poll.status === 'open' && (
                    <button
                      onClick={() => onConfirm(slot.id)}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-white rounded"
                      style={{ backgroundColor: BRAND }}
                    >
                      Confirm
                    </button>
                  )}
                  {!isBest && poll.status === 'open' && slot.yesCount > 0 && (
                    <button
                      onClick={() => onConfirm(slot.id)}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-white rounded"
                      style={{ backgroundColor: BRAND }}
                    >
                      Confirm
                    </button>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>

      {/* Best slot callout */}
      {poll.status === 'open' && poll.slots.some(s => s.yesCount > 0) && (() => {
        const best = poll.slots.reduce((b, s) => s.yesCount > b.yesCount ? s : b);
        return (
          <div className="mt-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border" style={{ borderColor: `${BRAND}40`, backgroundColor: `${BRAND}10` }}>
            <div className="flex items-center gap-2 min-w-0">
              <BarChart2 className="h-3.5 w-3.5 shrink-0" style={{ color: BRAND }} />
              <span className="text-xs font-semibold truncate" style={{ color: BRAND }}>
                Best: {formatSlotTime(best.start_time)} — {best.yesCount} yes{best.yesCount !== 1 ? '' : ''}
              </span>
            </div>
            <button
              onClick={() => onConfirm(best.id)}
              className="shrink-0 px-3 py-1.5 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all"
              style={{ backgroundColor: BRAND }}
            >
              Confirm this time
            </button>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Poll Card
// ─────────────────────────────────────────────────────────────
export interface PollWithStats extends MeetingPoll {
  slots: (MeetingPollSlot & { yesCount: number; maybeCount: number })[];
  totalResponses: number;
}

interface PollCardProps {
  poll: PollWithStats;
  onDelete: (id: string) => void;
  onClose: (id: string) => void;
  onConfirm: (pollId: string, slotId: string) => void;
}

export function PollCard({ poll, onDelete, onClose, onConfirm }: PollCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollUrl = `${window.location.origin}/poll/${poll.id}`;

  const copy = () => {
    navigator.clipboard.writeText(pollUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColors: Record<string, string> = {
    open: 'text-white',
    closed: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    confirmed: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  };

  const statusStyle = poll.status === 'open' ? { backgroundColor: BRAND } : {};

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{poll.title}</h3>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${statusColors[poll.status]}`} style={statusStyle}>
                {poll.status.charAt(0).toUpperCase() + poll.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{poll.duration_minutes} min</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{poll.totalResponses} response{poll.totalResponses !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{poll.slots.length} slot{poll.slots.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {poll.status === 'open' && (
              <button onClick={copy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${copied ? 'text-white border-transparent' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                style={copied ? { backgroundColor: BRAND, borderColor: BRAND } : {}}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Share'}
              </button>
            )}
            <a href={pollUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
            <button onClick={() => setExpanded(v => !v)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {poll.status === 'confirmed' && poll.confirmed_slot_start && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Confirmed: <span className="font-semibold">{formatSlotTime(poll.confirmed_slot_start)}</span>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Vote heatmap</p>
          <HeatmapGrid poll={poll} onConfirm={(slotId) => onConfirm(poll.id, slotId)} />
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
            {poll.status === 'open' && (
              <button onClick={() => onClose(poll.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg transition-colors">
                <RefreshCw className="h-3.5 w-3.5" /> Close poll
              </button>
            )}
            <button onClick={() => onDelete(poll.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 dark:border-red-500/30 rounded-lg transition-colors ml-auto">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
const HUB_PATH = '/dashboard/group-scheduling';

export function MeetingPollsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCreateRoute = searchParams.get('new') === '1';

  if (isCreateRoute) {
    return (
      <main className="flex-1 p-6 md:p-8 max-w-3xl w-full">
        <button
          onClick={() => navigate(HUB_PATH)}
          className="min-h-[44px] flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors mb-6 -ml-1 px-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Group Scheduling
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Create a Meeting Poll</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Propose times, share the link, and let everyone vote.
        </p>
        <CreatePollModal
          onClose={() => navigate(HUB_PATH)}
          onCreated={() => navigate(HUB_PATH)}
        />
      </main>
    );
  }

  return <Navigate to={HUB_PATH} replace />;
}
