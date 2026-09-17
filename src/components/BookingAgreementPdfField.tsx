import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import { DOCUMENT_UPLOAD_READABILITY_HINT } from '../lib/documentCopy';
import { documentUploadMaxLabel } from '../lib/documentTypes';
import { saveHostPdfTemplate } from '../lib/hostDocumentFiles';
import { DOCS_TEMPLATE_UPLOAD_PATH, type HostDocumentFile } from '../lib/hostDocuments';
import { formatErrorMessage } from '../lib/errors';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  hostId: string;
  files: HostDocumentFile[];
  fileId: string | null;
  fileName: string | null;
  onFilesChange: (files: HostDocumentFile[]) => void;
  onChange: (file: HostDocumentFile | null) => void;
};

export function BookingAgreementPdfField({
  hostId,
  files,
  fileId,
  fileName,
  onFilesChange,
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = files.find((f) => f.id === fileId) ?? null;
  const uploadMax = documentUploadMaxLabel();

  const upload = async (file: File | null) => {
    if (!file) return;
    setError('');
    setBusy(true);
    const { data, error: upErr } = await saveHostPdfTemplate({ hostId, file });
    setBusy(false);
    if (upErr || !data) {
      setError(formatErrorMessage(upErr) || 'Could not upload that PDF.');
      return;
    }
    onFilesChange([data, ...files.filter((f) => f.id !== data.id)]);
    onChange(data);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-500 dark:text-slate-400">
        PDF (same library as Send Docs)
      </label>
      <select
        value={fileId ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            onChange(null);
            return;
          }
          const next = files.find((f) => f.id === id) ?? null;
          onChange(next);
        }}
        className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="">Use text below</option>
        {files.length > 0 && (
          <optgroup label="Your templates">
            {files.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </optgroup>
        )}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold cursor-pointer">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? 'Uploading…' : 'Upload PDF'}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </label>
        <Link
          to={DOCS_TEMPLATE_UPLOAD_PATH}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Settings → Docs
        </Link>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400">
        PDF only, up to {uploadMax}. Uploads are saved so you can reuse them when you send a document.
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{DOCUMENT_UPLOAD_READABILITY_HINT}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {(selected || fileId) && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {selected?.name || fileName || 'Saved PDF'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
            {selected
              ? `Saved PDF · ${selected.file_name} · ${formatBytes(selected.file_size_bytes)}`
              : 'Guests will open this PDF on the booking page.'}
          </p>
        </div>
      )}
    </div>
  );
}
