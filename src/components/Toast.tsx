import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

let _addToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function registerToastHandler(fn: (toast: Omit<Toast, 'id'>) => void) {
  _addToast = fn;
}

export const toast = {
  show: (message: string, type: ToastType = 'info', duration = 4000) => {
    _addToast?.({ message, type, duration });
  },
  success: (message: string) => toast.show(message, 'success'),
  error: (message: string) => toast.show(message, 'error', 6000),
  warning: (message: string) => toast.show(message, 'warning', 5000),
  info: (message: string) => toast.show(message, 'info'),
};

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastType, string> = {
  success: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  error: 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  warning: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  info: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
};

const iconStyles: Record<ToastType, string> = {
  success: 'text-emerald-600',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const Icon = icons[t.type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(t.id), 300);
    }, t.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full transition-all duration-300 ${styles[t.type]} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconStyles[t.type]}`} />
      <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onRemove(t.id), 300); }}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  useEffect(() => {
    registerToastHandler(addToast);
    return () => { _addToast = null; };
  }, [addToast]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}
