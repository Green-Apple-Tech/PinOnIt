import type { ReactNode } from 'react';
import {
  builtInTemplateScopeLine,
  builtInTemplateStandardLine,
} from '../lib/builtInTemplateNotice';
import type { SmbDocumentType } from '../lib/types';

type Props = {
  type: SmbDocumentType;
  /** Both lines show together or not at all — only unmodified built-ins. */
  show: boolean;
  children: ReactNode;
};

/**
 * Fixed pair around built-in template text: normal line above, muted line below.
 * The body scrolls inside so both lines stay on screen together.
 */
export function BuiltInTemplateNoticePair({ type, show, children }: Props) {
  if (!show) return <>{children}</>;

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-900 dark:text-white leading-relaxed">
        {builtInTemplateStandardLine(type)}
      </p>
      <div className="max-h-52 overflow-y-auto overscroll-contain">{children}</div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
        {builtInTemplateScopeLine()}
      </p>
    </div>
  );
}
