import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

export function SigningQr({ url, caption }: { url: string; caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void QRCode.toCanvas(canvas, url, {
      width: 220,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(() => {
      setDataUrl(canvas.toDataURL('image/png'));
    });
  }, [url]);

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-950">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">QR code</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{caption}</p>
      <canvas ref={canvasRef} className="mx-auto mt-3 rounded-xl bg-white" width={220} height={220} />
      <button
        type="button"
        disabled={!dataUrl}
        onClick={() => {
          if (!dataUrl) return;
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'sign-qr.png';
          a.click();
        }}
        className="mt-3 inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <Download className="h-4 w-4" />
        Download QR
      </button>
    </div>
  );
}
