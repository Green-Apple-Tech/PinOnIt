export type SmsMockMessage = {
  role: 'business' | 'customer' | 'system';
  text: string;
};

export function SmsPhoneMockup({ messages, caption }: { messages: SmsMockMessage[]; caption?: string }) {
  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="rounded-[2rem] border-[6px] border-slate-800 dark:border-slate-700 bg-slate-800 dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="h-6 bg-slate-800 dark:bg-slate-900 flex items-center justify-center">
          <div className="h-1 w-16 rounded-full bg-slate-600" />
        </div>
        <div className="bg-slate-100 dark:bg-slate-950 px-3 py-4 space-y-2 min-h-[220px]">
          {messages.map((msg, i) => {
            if (msg.role === 'system') {
              return (
                <p key={i} className="text-center text-[10px] text-slate-500 dark:text-slate-400 py-1">
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
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {caption ? (
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{caption}</p>
      ) : null}
    </div>
  );
}
