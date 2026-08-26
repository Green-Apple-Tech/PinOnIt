import { useEffect, useState } from 'react';
import { Share, PlusSquare, MoreVertical, X, Download, Smartphone } from 'lucide-react';

const STORAGE_KEY = 'pinonit_a2hs_prompt_v1';

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return true;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const ios = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function isPhoneLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const webkit = /WebKit/i.test(ua);
  const chromeOrCriOS = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome/i.test(ua);
  return ios && webkit && !chromeOrCriOS;
}

/**
 * One-time prompt for hosts on phone browsers to add PinOnIt to the home screen.
 * Android Chrome: uses beforeinstallprompt when available.
 * iOS Safari: short Share → Add to Home Screen steps (no install API).
 */
export function AddToHomeScreenPrompt() {
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneDisplay() || !isPhoneLike()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    const t = window.setTimeout(() => setOpen(true), 1200);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
    setIosHelp(false);
  };

  const installAndroid = async () => {
    if (!deferred) {
      setIosHelp(true);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!open) return null;

  const ios = isIosSafari() || (!deferred && /iPhone|iPad|iPod/i.test(navigator.userAgent));

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-labelledby="a2hs-title"
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-[#5864C6]/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-[#5864C6]" />
            </div>
            <div className="min-w-0">
              <h2 id="a2hs-title" className="text-base font-bold text-slate-900 dark:text-white">
                Add PinOnIt to your home screen?
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Open it like an app — one tap, no browser chrome.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {ios || iosHelp ? (
          <div className="px-5 pb-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
              On iPhone / iPad
            </p>
            <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
              <li className="flex gap-2.5 items-start">
                <span className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-xs font-bold">1</span>
                <span className="pt-0.5">
                  Tap <Share className="inline h-3.5 w-3.5 mx-0.5 text-[#5864C6]" /> <strong>Share</strong> in Safari (bottom or top bar).
                </span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-xs font-bold">2</span>
                <span className="pt-0.5">
                  Scroll and tap <PlusSquare className="inline h-3.5 w-3.5 mx-0.5 text-[#5864C6]" /> <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-xs font-bold">3</span>
                <span className="pt-0.5">Tap <strong>Add</strong>. Done — launch PinOnIt from your home screen.</span>
              </li>
            </ol>
            {!ios && (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                <MoreVertical className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                On Android, use the browser menu → <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </p>
            )}
          </div>
        ) : (
          <div className="px-5 pb-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Install PinOnIt for faster access to Calendar, Smart Reminders, and your booking link.
            </p>
          </div>
        )}

        <div className="px-5 pb-5 pt-2 flex flex-col gap-2">
          {!ios && !iosHelp && deferred ? (
            <button
              type="button"
              onClick={() => void installAndroid()}
              className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5864C6] text-white text-sm font-semibold hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Add to home screen
            </button>
          ) : null}
          {(ios || iosHelp) && (
            <button
              type="button"
              onClick={dismiss}
              className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5864C6] text-white text-sm font-semibold hover:opacity-90"
            >
              Got it
            </button>
          )}
          {!ios && !iosHelp && !deferred && (
            <button
              type="button"
              onClick={() => setIosHelp(true)}
              className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5864C6] text-white text-sm font-semibold hover:opacity-90"
            >
              Show me how
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="w-full min-h-10 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
