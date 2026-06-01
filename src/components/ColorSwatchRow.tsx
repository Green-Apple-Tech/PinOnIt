import { useRef } from 'react';
import { Plus } from 'lucide-react';

export const BRAND_SWATCHES = [
  { hex: '#5864C6', label: 'Brand' },
  { hex: '#0A2463', label: 'Dark navy' },
  { hex: '#4A4A4A', label: 'Dark gray' },
  { hex: '#29ABE2', label: 'Sky blue' },
  { hex: '#F5A623', label: 'Amber' },
  { hex: '#E84040', label: 'Red' },
  { hex: '#9B59B6', label: 'Purple' },
  { hex: '#F06292', label: 'Pink' },
  { hex: '#10B981', label: 'Green' },
  { hex: '#F97316', label: 'Orange' },
];

interface ColorSwatchRowProps {
  value: string;
  onChange: (hex: string) => void;
  size?: 'sm' | 'md';
}

export function ColorSwatchRow({ value, onChange, size = 'md' }: ColorSwatchRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const norm = value?.toLowerCase();

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {BRAND_SWATCHES.map(({ hex, label }) => {
        const selected = norm === hex.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            title={label}
            className={`${dim} rounded-full transition-all shrink-0 ${
              selected
                ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-110'
                : 'hover:scale-110'
            }`}
            style={{ backgroundColor: hex }}
          />
        );
      })}

      {/* Custom picker */}
      <label
        className={`${dim} rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors shrink-0 ${
          !BRAND_SWATCHES.some((s) => s.hex.toLowerCase() === norm)
            ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900'
            : ''
        }`}
        title="Custom color"
        style={
          !BRAND_SWATCHES.some((s) => s.hex.toLowerCase() === norm)
            ? { backgroundColor: value }
            : {}
        }
      >
        <input
          ref={inputRef}
          type="color"
          value={value || '#5864C6'}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
        {BRAND_SWATCHES.some((s) => s.hex.toLowerCase() === norm) && (
          <Plus className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        )}
      </label>
    </div>
  );
}
