import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode, Download, Copy, Check, Link2, RefreshCw,
  ChevronDown, Palette,
} from 'lucide-react';
import { ColorSwatchRow } from '../components/ColorSwatchRow';

const PRESETS = [
  { label: 'Your website', placeholder: 'https://yourwebsite.com' },
  { label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourname' },
  { label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
  { label: 'Booking link', placeholder: 'https://pinonit.com/yourname' },
];

const SIZES = [128, 256, 512, 1024];

export function QRCreatorPage() {
  const [url, setUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState(512);
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = async (value: string, fg: string, bg: string, sz: number) => {
    if (!value.trim()) { setQrDataUrl(''); return; }
    setGenerating(true);
    setError('');
    try {
      const dataUrl = await QRCode.toDataURL(value.trim(), {
        width: sz,
        margin: 2,
        color: { dark: fg, light: bg },
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(dataUrl);
    } catch {
      setError('Could not generate QR code. Check the URL and try again.');
    }
    setGenerating(false);
  };

  // Auto-generate with debounce as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => generate(url, fgColor, bgColor, size), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url, fgColor, bgColor, size]);

  const download = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    const name = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').slice(0, 30) || 'qr-code';
    a.download = `${name}-${size}px.png`;
    a.click();
  };

  const copyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy URL
      navigator.clipboard.writeText(qrDataUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-3xl w-full">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QR Code Creator</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-400 max-w-lg">
          Turn any link into a scannable QR code. Download as PNG or copy and paste anywhere — business cards, flyers, email signatures, slides.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">

        {/* ── Input panel ─────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* URL input */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Website or link
            </label>
            <div className="relative flex items-center">
              <Link2 className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full pl-9 pr-10 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
              {url && (
                <button
                  onClick={() => setUrl('')}
                  className="absolute right-3 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          {/* Quick presets */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setUrl(p.placeholder)}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-400 rounded-full transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Size
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    size === s
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300'
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">512px works for most uses. 1024px for large prints.</p>
          </div>

          {/* Color options */}
          <div>
            <button
              onClick={() => setShowColorPanel((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <Palette className="h-3.5 w-3.5" />
              Colors
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showColorPanel ? 'rotate-180' : ''}`} />
            </button>

            {showColorPanel && (
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">QR color</p>
                  <ColorSwatchRow value={fgColor} onChange={setFgColor} size="sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Background color</p>
                  <ColorSwatchRow value={bgColor} onChange={setBgColor} size="sm" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Preview panel ────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center">
          <div className={`w-full max-w-xs aspect-square rounded-2xl border-2 flex items-center justify-center transition-all ${
            qrDataUrl
              ? 'border-gray-200 dark:border-slate-700 bg-white shadow-lg'
              : 'border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30'
          }`}>
            {generating ? (
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <p className="text-xs">Generating…</p>
              </div>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain p-4 rounded-2xl" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-300 dark:text-slate-600">
                <QrCode className="h-16 w-16" />
                <p className="text-xs text-gray-400 dark:text-slate-500">Enter a link to preview</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {qrDataUrl && (
            <div className="flex gap-3 mt-5 w-full max-w-xs">
              <button
                onClick={download}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
              >
                <Download className="h-4 w-4" />
                Download PNG
              </button>
              <button
                onClick={copyImage}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl border-2 transition-all ${
                  copied
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-500'
                    : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {qrDataUrl && (
            <p className="mt-3 text-xs text-gray-400 dark:text-slate-500 text-center max-w-xs">
              {size}×{size}px PNG — ready to use on business cards, flyers, email signatures, or slides.
            </p>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-10 border-t border-gray-100 dark:border-slate-800 pt-6">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">Where to use your QR code</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { title: 'Business cards', desc: 'Link directly to your booking page or website' },
            { title: 'Email signature', desc: 'Paste in Gmail or Outlook as an image' },
            { title: 'Presentation slides', desc: 'Let attendees scan instead of typing a URL' },
            { title: 'Printed materials', desc: 'Flyers, posters, menus, brochures' },
          ].map(({ title, desc }) => (
            <div key={title} className="p-3.5 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-0.5">{title}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}
