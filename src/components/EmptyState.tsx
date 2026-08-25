import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionTo,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionTo?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const buttonClass =
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-full transition-all';
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-10 text-center">
      <div className="h-14 w-14 bg-brand-50 dark:bg-brand-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon className="h-7 w-7 text-brand-600 dark:text-brand-400" />
      </div>
      <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">{description}</p>
      {actionTo && actionLabel ? (
        <Link to={actionTo} className={buttonClass}>
          {actionLabel}
        </Link>
      ) : onAction && actionLabel ? (
        <button type="button" onClick={onAction} className={buttonClass}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
