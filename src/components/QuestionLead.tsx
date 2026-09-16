import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  dismissQuestionLead,
  readQuestionLeadState,
  recordQuestionLeadVisit,
  shouldShowQuestionLead,
} from '../lib/questionLeadVisibility';

/** Mini-headline question + body, with optional demoted mechanics copy. */
export function QuestionLead({
  lead,
  body,
  secondary,
  introId,
  keepSecondary = false,
}: {
  lead: string;
  body: string;
  secondary?: ReactNode;
  /** When set, show only the first 5 visits (or until they dismiss). */
  introId?: string;
  /** Keep the secondary line after the explainer hides (legal / always-on copy). */
  keepSecondary?: boolean;
}) {
  const [showLead, setShowLead] = useState(() => {
    if (!introId) return true;
    const state = readQuestionLeadState(introId);
    return shouldShowQuestionLead(state.visits, state.dismissed);
  });

  useEffect(() => {
    if (!introId || !showLead) return;
    recordQuestionLeadVisit(introId);
  }, [introId, showLead]);

  const hideLead = () => {
    if (!introId) return;
    dismissQuestionLead(introId);
    setShowLead(false);
  };

  if (!showLead) {
    if (keepSecondary && secondary) {
      return <div className="max-w-2xl text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{secondary}</div>;
    }
    return null;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-snug">{lead}</p>
        {introId ? (
          <button
            type="button"
            onClick={hideLead}
            className="shrink-0 p-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Don't show this again"
            aria-label="Don't show this again"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
      {secondary ? (
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{secondary}</div>
      ) : null}
      {introId ? (
        <button
          type="button"
          onClick={hideLead}
          className="mt-2 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline-offset-2 hover:underline"
        >
          Don't show this again
        </button>
      ) : null}
    </div>
  );
}
