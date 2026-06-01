import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'How do I set up my booking page?',
  'How do I migrate from Calendly?',
  'How do automated reminders work?',
  'How do I collect payments with Stripe?',
  'Can I translate messages to other languages?',
  'How do I add more services?',
];

const KNOWLEDGE_BASE: Record<string, string> = {
  'booking page': 'To set up your booking page, go to Settings and set your URL slug (e.g. pinonit.app/your-name). Then add services and set your availability. Your booking page will be live immediately.',
  'migrate': 'Switching from Calendly or another scheduler? Go through our onboarding wizard which helps you recreate your event types, set your availability, and configure automated reminders. You can also manually add services and availability from the dashboard.',
  'calendly': 'Pin on It gives you everything Calendly does plus automated reminders, AI-translated messages, and paid bookings -- at half the price. Our onboarding wizard helps you migrate your event types and schedule in minutes.',
  'reminder': 'Automated reminders are sent based on your reminder rules. Go to Reminders in the dashboard to create message templates and set timing rules (e.g. 24 hours before, at booking time, 1 day after). Guests can confirm or cancel with one tap.',
  'payment': 'To collect payments, add a price to your service when creating it. When a guest books a paid service, they\'ll be directed to Stripe Checkout. You need a Stripe account and your Stripe keys configured in Supabase edge function secrets.',
  'stripe': 'Stripe integration is built in. Add your STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to your Supabase edge function secrets. Then create products and prices in Stripe and update the price IDs in the billing page code.',
  'translate': 'AI-powered multilingual messaging translates your reminder and confirmation messages into your guest\'s language automatically. Enable "Auto-translate" on any message template. Requires an OpenAI API key configured in Supabase secrets.',
  'language': 'We support 16 languages including English, Spanish, French, German, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Italian, Dutch, Russian, Polish, Turkish, and Vietnamese.',
  'service': 'Go to Services in the dashboard to add, edit, or remove appointment types. Each service has a name, duration, optional price, and color. You can have unlimited services on the Pro plan.',
  'availability': 'Set your weekly recurring schedule in the Availability section. Add time blocks for each day of the week. Guests will only see available slots based on your schedule and existing bookings.',
  'cancel': 'Guests can cancel bookings via the one-tap cancel link in their confirmation/reminder emails. Hosts can also cancel or mark bookings as complete from the dashboard.',
  'confirm': 'Confirmation links are included in every automated message. Guests tap to confirm their appointment, which updates the booking status instantly.',
  'reschedule': 'Guests can reschedule by clicking the reschedule link in their messages. This redirects them to your booking page to pick a new time.',
  'slug': 'Your booking page URL slug is set in Settings. It becomes pinonit.app/your-slug. Choose something memorable and professional.',
  'price': 'Pin on It Pro is $8/month -- half the price of Calendly Standard ($16/month). You get automated reminders, AI translation, paid bookings, QR booking codes, and more included. No extra charges for features that should be standard.',
};

function getAIResponse(input: string): string {
  const lower = input.toLowerCase();

  for (const [keyword, response] of Object.entries(KNOWLEDGE_BASE)) {
    if (lower.includes(keyword)) return response;
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return 'Hi there! I can help you with Pin on It. Ask me about setting up your booking page, automated reminders, payments, migration from other tools, or anything else.';
  }

  if (lower.includes('help') || lower.includes('how')) {
    return 'I can help with: setting up your booking page, configuring services and availability, automated reminders and AI translation, collecting payments via Stripe, or migrating from Calendly/Acuity. What would you like to know?';
  }

  return 'I\'m not sure about that specific topic, but I can help with booking pages, services, availability, reminders, AI translation, payments, and migration. Try asking about one of those!';
}

export function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your Pin on It assistant. Ask me anything about setting up your scheduling, reminders, payments, or migrating from another tool.' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;

    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const response = getAIResponse(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
      setTyping(false);
    }, 600 + Math.random() * 400);
  };

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 text-white rounded-full shadow-lg transition-all hover:scale-105 flex items-center justify-center" style={{backgroundColor: '#5864C6', boxShadow: '0 10px 15px -3px #5864C640'}}
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[520px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#5864C615' }}>
                <Sparkles className="h-4 w-4" style={{ color: '#5864C6' }} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Pin on It AI</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Ask me anything</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                  style={msg.role === 'user' ? {backgroundColor: '#5864C6'} : undefined}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500 dark:text-slate-400" />
                </div>
              </div>
            )}
          </div>

          {/* Suggested prompts (show when few messages) */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 rounded-full transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5864C6] transition"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="p-2 text-white rounded-lg transition-colors disabled:opacity-50" style={{backgroundColor: '#5864C6'}}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
