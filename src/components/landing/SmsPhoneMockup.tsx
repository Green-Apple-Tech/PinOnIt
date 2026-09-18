import { MarketingShotFrame } from './MarketingShotFrame';

export type SmsMockMessage = {
  role: 'business' | 'customer' | 'system';
  text: string;
};

export function SmsPhoneMockup({ messages, caption }: { messages: SmsMockMessage[]; caption?: string }) {
  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto">
      <MarketingShotFrame className="aspect-square" padding="p-6 sm:p-8">
        <div className="h-full flex flex-col items-center justify-center gap-5">
          <div className="w-full max-w-[19rem] sm:max-w-[21rem] rounded-[1.65rem] border-[5px] border-slate-900 bg-slate-50 overflow-hidden shadow-lg">
            <div className="h-6 bg-slate-900 flex items-center justify-center">
              <div className="h-1 w-16 rounded-full bg-slate-500" />
            </div>
            <div className="px-3.5 py-4 space-y-2 min-h-[240px]">
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
          {caption ? (
            <p className="text-center text-sm sm:text-base font-medium text-slate-600 leading-snug px-2">
              {caption}
            </p>
          ) : null}
        </div>
      </MarketingShotFrame>
    </div>
  );
}
