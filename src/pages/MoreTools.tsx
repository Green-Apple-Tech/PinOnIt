import { Link } from 'react-router-dom';
import { QrCode, Mail, FileText, ArrowRight } from 'lucide-react';

function ToolCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  to,
}: {
  icon: typeof QrCode;
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm hover:shadow-md transition-shadow">
      <div className="h-14 w-14 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-5">
        <Icon className="h-7 w-7 text-brand-600 dark:text-brand-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400 leading-relaxed flex-1">{description}</p>
      <Link
        to={to}
        className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {buttonLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function MoreToolsPage() {
  return (
    <main className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">More Tools</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Extra ways to share your booking link, send a quote, and grow bookings.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ToolCard
          icon={QrCode}
          title="QR Code Creator"
          description="Generate QR codes for your booking links to share anywhere."
          buttonLabel="Open QR Creator"
          to="/dashboard/qr-code"
        />
        <ToolCard
          icon={Mail}
          title="Email Signature"
          description="Create a professional email signature with your booking link built in."
          buttonLabel="Open Signature Builder"
          to="/dashboard/signature"
        />
        <ToolCard
          icon={FileText}
          title="Quote / Invoice"
          description="Send a quote, invoice, or cash receipt by email or text. Add a PayPal or Venmo link if they should pay somewhere else — PinOnIt does not collect payment."
          buttonLabel="Open Quote / Invoice"
          to="/dashboard/quotes"
        />
      </div>
    </main>
  );
}
