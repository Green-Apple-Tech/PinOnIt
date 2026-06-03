import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BOT_DISMISS_KEY = 'pinonit_bot_dismissed';
const BOT_COMPLETED_KEY = 'pinonit_bot_completed';
const BOT_ANSWERS_KEY = 'pinonit_bot_answers';
const DISMISS_MS = 24 * 60 * 60 * 1000;

type Question = {
  id: string;
  message: string;
  options?: string[];
  type?: 'email_input';
  placeholder?: string;
};

const QUESTIONS: Question[] = [
  {
    id: 'paying',
    message: "Hi! 👋 Are you currently paying for a scheduling tool like Calendly?",
    options: ['Yes, Calendly', 'Yes, another tool', 'No, using nothing', 'Just browsing'],
  },
  {
    id: 'pain',
    message: "What's your biggest frustration with your current setup?",
    options: ['Too expensive', 'Missing features', 'Too complicated', 'Clients complain', 'Nothing — just looking'],
  },
  {
    id: 'calendar',
    message: 'What calendar do you use?',
    options: ['Google Calendar', 'Outlook / Microsoft', 'Apple Calendar', 'None yet'],
  },
  {
    id: 'appointments',
    message: 'What kind of appointments do you book?',
    options: ['Client calls', 'Consultations', 'Classes / coaching', 'Team meetings', 'Other'],
  },
  {
    id: 'volume',
    message: 'How many bookings do you take per week?',
    options: ['1–5', '6–20', '20+', 'Just starting out'],
  },
  {
    id: 'email',
    message: 'Last step! Where should I send your free personalized setup guide?',
    type: 'email_input',
    placeholder: 'your@email.com',
  },
  {
    id: 'done',
    message: "You're all set! 🎉 PinOnIt is free to start — want to create your booking page now?",
    options: ["Yes, let's go!", 'Maybe later'],
  },
];

const PROGRESS_IDS = QUESTIONS.filter((q) => q.id !== 'done').map((q) => q.id);

function isDismissed(): boolean {
  const raw = localStorage.getItem(BOT_DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  return !Number.isNaN(ts) && Date.now() - ts < DISMISS_MS;
}

function isCompleted(): boolean {
  return localStorage.getItem(BOT_COMPLETED_KEY) === '1';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function OnboardingBot() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [animating, setAnimating] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);

  const question = QUESTIONS[currentQ];
  const progressIndex = PROGRESS_IDS.indexOf(question?.id ?? '');

  const saveLead = useCallback(async (leadEmail: string, leadAnswers: Record<string, string>) => {
    try {
      await supabase.functions.invoke('save-bot-lead', {
        body: { email: leadEmail, answers: leadAnswers, source: 'onboarding_bot' },
      });
    } catch (e) {
      console.error('Failed to save lead', e);
    }
  }, []);

  const dismissBot = useCallback(() => {
    localStorage.setItem(BOT_DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setMinimized(true);
  }, []);

  const openPanel = useCallback(() => {
    if (isDismissed() || isCompleted()) return;
    setVisible(true);
    setMinimized(false);
    requestAnimationFrame(() => setEntered(true));
  }, []);

  const closeToBubble = useCallback(() => {
    setVisible(false);
    setMinimized(false);
    setEntered(false);
  }, []);

  useEffect(() => {
    if (isDismissed() || isCompleted()) return;

    const onScroll = () => {
      if (triggered.current) return;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0 && scrollTop / docHeight >= 0.3) {
        triggered.current = true;
        openPanel();
      }
    };

    const timer = window.setTimeout(() => {
      if (!triggered.current) {
        triggered.current = true;
        openPanel();
      }
    }, 8000);

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [openPanel]);

  useEffect(() => {
    setCompleted(isCompleted());
  }, []);

  const goNext = useCallback(() => {
    setAnimating(true);
    window.setTimeout(() => {
      setCurrentQ((q) => Math.min(q + 1, QUESTIONS.length - 1));
      setAnimating(false);
    }, 150);
  }, []);

  const handleOption = (option: string) => {
    if (!question || question.type === 'email_input') return;
    const nextAnswers = { ...answers, [question.id]: option };
    setAnswers(nextAnswers);

    if (question.id === 'done') {
      const leadEmail = email || nextAnswers.email || '';
      localStorage.setItem(BOT_ANSWERS_KEY, JSON.stringify(nextAnswers));

      if (option === "Yes, let's go!") {
        localStorage.setItem(BOT_COMPLETED_KEY, '1');
        setCompleted(true);
        saveLead(leadEmail, nextAnswers);
        const params = new URLSearchParams({
          source: 'bot',
          paying: nextAnswers.paying ?? '',
          calendar: nextAnswers.calendar ?? '',
          appointments: nextAnswers.appointments ?? '',
        });
        navigate(`/signup?${params.toString()}`);
        return;
      }

      localStorage.setItem(BOT_COMPLETED_KEY, '1');
      setCompleted(true);
      saveLead(leadEmail, nextAnswers).finally(() => dismissBot());
      return;
    }

    advanceTimer.current = setTimeout(() => {
      goNext();
    }, 400);
  };

  const handleEmailNext = () => {
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    setAnswers((prev) => ({ ...prev, email: email.trim() }));
    goNext();
  };

  if (isDismissed()) return null;

  const showBubble = !visible || minimized;
  const showBadge = !completed && !visible;

  return (
    <>
      {showBubble && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Open setup assistant"
          className="fixed bottom-5 right-5 z-[100] h-14 w-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center hover:bg-indigo-700 transition-all hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
          {showBadge && (
            <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white" />
          )}
        </button>
      )}

      {visible && !minimized && (
        <div className="fixed inset-0 z-[100] md:inset-auto md:bottom-6 md:right-6 md:pointer-events-none">
          <div
            className={`pointer-events-auto flex flex-col bg-white shadow-2xl overflow-hidden transition-all duration-300 ease-out
              fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl
              md:static md:w-[380px] md:max-h-[520px] md:rounded-2xl
              ${entered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-4'}`}
          >
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
                P
              </div>
              <div className="flex-1 flex justify-center gap-1.5">
                {PROGRESS_IDS.map((id, i) => (
                  <div
                    key={id}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      progressIndex > i || (progressIndex === i && answers[id])
                        ? 'bg-white'
                        : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={dismissBot}
                className="p-1.5 rounded-lg text-white/90 hover:bg-white/10 transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div
                className={`transition-all duration-300 ${
                  animating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
                }`}
              >
                <div className="flex items-start gap-3 mb-5">
                  <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                    P
                  </div>
                  <p className="text-lg font-semibold text-gray-900 text-center flex-1 pt-1 px-2">
                    {question?.message}
                  </p>
                </div>

                {question?.type === 'email_input' ? (
                  <div className="space-y-3 px-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError('');
                      }}
                      placeholder={question.placeholder}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleEmailNext()}
                    />
                    {emailError && <p className="text-sm text-red-500">{emailError}</p>}
                    <button
                      type="button"
                      onClick={handleEmailNext}
                      className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 px-2">
                    {question?.options?.map((opt) => {
                      const selected = answers[question.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleOption(opt)}
                          className={`w-full text-left rounded-xl border py-3 px-4 text-sm font-medium transition-all ${
                            selected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-gray-200 text-gray-700 hover:border-indigo-400'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={closeToBubble}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Minimize chat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
