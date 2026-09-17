import type { ReactNode } from 'react';
import {
  builtInTemplateScopeLine,
  builtInTemplateStandardLine,
} from '../lib/builtInTemplateNotice';
import type { SmbDocumentType } from '../lib/types';

type Props = {
  type: SmbDocumentType;
  /** Both built-in lines show together or not at all — only unmodified built-ins. */
  show: boolean;
  /** Muted extras after the scope line (state notice, state-specific link). */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Fixed pair around built-in template text: one normal line above, muted stack below.
 * The body scrolls inside so the pair stays on screen together.
 */
export function BuiltInTemplateNoticePair({ type, show, footer, children }: Props) {
  if (!show) {
    return (
      <div className="space-y-2">
        {children}
        {footer}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-900 dark:text-white leading-relaxed">
        {builtInTemplateStandardLine(type)}
      </p>
      <div className="max-h-52 overflow-y-auto overscroll-contain">{children}</div>
      <p className="text-[11px] text-black dark:text-white leading-relaxed">
        {builtInTemplateScopeLine()}
      </p>
      {footer}
    </div>
  );
}
