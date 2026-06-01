import { Link } from 'react-router-dom';
import { MapPin, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6">
        <img src="/pinonit_logo.png" alt="Pin on It" className="h-12 w-auto mx-auto mb-8 opacity-80" />
        <p className="text-[120px] font-black leading-none text-[#5864C6] opacity-10 select-none">404</p>
      </div>
      <div className="-mt-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page not found</h1>
        <p className="text-gray-500 dark:text-slate-400 mb-8 max-w-sm">
          This page doesn't exist or may have been moved. Let's get you back on track.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#5864C6] hover:bg-[#4a56b8] text-white font-semibold rounded-full transition-colors shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
