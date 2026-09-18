export type SmsMockMessage = {
  role: 'business' | 'customer' | 'system';
  text: string;
};

export function SmsPhoneMockup({ messages, caption }: { messages: SmsMockMessage[]; caption?: string }) {
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="relative rounded-[2.25rem] overflow-hidden bg-gradient-to-br from-brand-400 via-brand-600 to-brand-900 p-6 sm:p-8 shadow-2xl shadow-brand-900/25">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,0.35) 18px 19px)',
          }}
        />
        <div className="pointer-events-none absolute -top-16 -left-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
        <div className="relative rounded-[1.65rem] border-[5px] border-slate-900 bg-slate-50 dark:bg-slate-100 overflow-hidden shadow-lg">
          <div className="h-6 bg-slate-900 flex items-center justify-center">
            <div className="h-1 w-16 rounded-full bg-slate-500" />
          </div>
          <div className="px-3.5 py-4 space-y-2 min-h-[220px]">
            {messages.map((msg, i) => {
              if (msg.role === 'system') {
                return (
                  <p key={i} className="text-center text-[10px] text-slate-500 py-1">
                    {msg.text}
                  </p>
                );
              }
              const isCustomer = msg.role === 'customer';
              return (
                <div key={i} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-snug ${
                      isCustomer
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-slate-200 text-slate-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {caption ? (
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{caption}</p>
      ) : null}
    </div>
  );
}
