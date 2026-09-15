import type { ReactNode } from 'react';

/** Mini-headline question + body, with optional demoted mechanics copy. */
export function QuestionLead({
  lead,
  body,
  secondary,
}: {
  lead: string;
  body: string;
  secondary?: ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-snug">{lead}</p>
      <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
      {secondary ? (
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{secondary}</div>
      ) : null}
    </div>
  );
}
