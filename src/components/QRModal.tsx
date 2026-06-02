import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Download, Copy, Check, QrCode, Zap } from 'lucide-react';

interface QRModalProps {
  url: string;
  title: string;
  onClose: () => void;
  singleUse?: boolean;
  /** Booking-page style: larger QR, custom heading/subtitle, PNG + SVG downloads */
  variant?: 'default' | 'booking';
}

export function QRModal({ url, title, onClose, singleUse = false, variant = 'default' }: QRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [dataUrl, setDataUrl] = useState('');
  const [svgData, setSvgData] = useState('');
  const qrSize = variant === 'booking' ? 320 : 280;
  const fileBase = title.replace(/\s+/g, '-').toLowerCase();

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: qrSize,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(() => {
      setDataUrl(canvasRef.current!.toDataURL('image/png'));
    });
    QRCode.toString(url, {
      type: 'svg',
      width: qrSize,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(setSvgData);
  }, [url, qrSize]);

  const handleDownloadPng = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileBase}-qr.png`;
    a.click();
  };

  const handleDownloadSvg = () => {
    if (!svgData) return;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `${fileBase}-qr.svg`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleCopyImage = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      handleDownloadPng();
    }
  };

  const heading = variant === 'booking'
    ? 'Your booking QR code'
    : singleUse
      ? 'Single-use QR Code'
      : 'Booking QR Code';

  const description = variant === 'booking'
    ? 'Print or share this QR code so clients can book directly from their phone'
    : singleUse
      ? 'This QR code can only be used once. After one booking it becomes invalid.'
      : 'Anyone who scans this code will land directly on your booking page.';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${singleUse ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-brand-50 dark:bg-brand-900/20'}`}>
              {singleUse
                ? <Zap className="h-5 w-5 text-amber-500" />
                : <QrCode className="h-5 w-5 text-brand-500 dark:text-brand-400" />
              }
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                  {heading}
                </p>
                {singleUse && variant !== 'booking' && (
                  <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-full uppercase tracking-wide">
                    1×
                  </span>
                )}
              </div>
              {variant !== 'booking' && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[180px]">{title}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* QR canvas */}
        <div className="flex flex-col items-center px-6 py-6">
          <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100">
            <canvas ref={canvasRef} className="block" style={{ width: qrSize, height: qrSize }} />
          </div>
          <p className={`mt-4 text-xs text-slate-400 dark:text-slate-500 text-center leading-relaxed ${variant === 'booking' ? 'max-w-[280px]' : 'max-w-[220px]'}`}>
            {description}
          </p>
        </div>

        {/* URL preview */}
        <div className="mx-6 mb-4 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Booking URL</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono break-all leading-relaxed">{url}</p>
        </div>

        {/* Actions */}
        {variant === 'booking' ? (
          <div className="grid grid-cols-2 gap-3 px-6 pb-6">
            <button
              onClick={handleDownloadPng}
              className="flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </button>
            <button
              onClick={handleDownloadSvg}
              className="flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors"
            >
              <Download className="h-4 w-4" />
              Download SVG
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-6 pb-6">
            <button
              onClick={handleDownloadPng}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={handleCopyImage}
              className="flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy image'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
