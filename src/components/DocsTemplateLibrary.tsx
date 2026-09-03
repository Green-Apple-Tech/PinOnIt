import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from './Toast';
import { formatErrorMessage } from '../lib/errors';
import {
  DOCUMENT_UPLOAD_BUCKET,
  DOCUMENT_UPLOAD_MAX_BYTES,
  DOCUMENT_UPLOAD_READABILITY_HINT,
  defaultDocumentBody,
  documentTypeLabel,
  documentUploadMaxLabel,
  signByTextAckLabel,
} from '../lib/documents';
import {
  HOST_EDITABLE_TEMPLATE_TYPES,
  type HostDocumentFile,
  type HostDocumentTemplate,
} from '../lib/hostDocuments';
import type { DocumentTemplate, SmbDocumentType } from '../lib/types';
import { useAuth } from '../hooks/useAuth';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  hostId: string;
  waiverTemplate: string;
  onWaiverTemplateChange: (value: string) => void;
};

export function DocsTemplateLibrary({ hostId, waiverTemplate, onWaiverTemplateChange }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [globalTemplates, setGlobalTemplates] = useState<DocumentTemplate[]>([]);
  const [overrides, setOverrides] = useState<HostDocumentTemplate[]>([]);
  const [files, setFiles] = useState<HostDocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openType, setOpenType] = useState<SmbDocumentType | null>('nda');
  const [drafts, setDrafts] = useState<Partial<Record<SmbDocumentType, string>>>({});
  const [savingType, setSavingType] = useState<SmbDocumentType | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [scopeAcked, setScopeAcked] = useState(false);
  const uploadMaxLabel = documentUploadMaxLabel();
  const scopeAlreadyAccepted = Boolean(profile?.sign_by_text_scope_accepted_at);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, o, f] = await Promise.all([
      supabase.from('document_templates').select('*'),
      supabase.from('host_document_templates').select('*').eq('host_id', hostId),
      supabase.from('host_document_files').select('*').eq('host_id', hostId).order('created_at', { ascending: false }),
    ]);
    if (g.error || o.error || f.error) {
      toast.error(g.error?.message || o.error?.message || f.error?.message || 'Could not load Doc templates.');
    }
    setGlobalTemplates((g.data as DocumentTemplate[]) ?? []);
    setOverrides((o.data as HostDocumentTemplate[]) ?? []);
    setFiles((f.data as HostDocumentFile[]) ?? []);
    setLoading(false);
  }, [hostId]);

  useEffect(() => {
    void load();
  }, [load]);

  const seedFor = (type: SmbDocumentType) => {
    const global = globalTemplates.find((t) => t.document_type === type)?.full_text?.trim();
    if (type === 'waiver' && waiverTemplate.trim()) return waiverTemplate;
    return global || defaultDocumentBody(type);
  };

  const draftFor = (type: SmbDocumentType) => {
    if (drafts[type] !== undefined) return drafts[type] as string;
    const override = overrides.find((o) => o.document_type === type)?.full_text;
    if (override) return override;
    return seedFor(type);
  };

  const saveType = async (type: SmbDocumentType) => {
    const text = (drafts[type] ?? draftFor(type)).trim();
    if (!text) {
      toast.error('Template text cannot be empty.');
      return;
    }
    setSavingType(type);
    try {
      const { error } = await supabase.from('host_document_templates').upsert(
        {
          host_id: hostId,
          document_type: type,
          full_text: text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'host_id,document_type' },
      );
      if (error) throw error;
      if (type === 'waiver') {
        onWaiverTemplateChange(text);
        await supabase.from('profiles').update({ waiver_template: text }).eq('id', hostId);
      }
      toast.success(`${documentTypeLabel(type)} template saved`);
      await load();
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setSavingType(null);
    }
  };

  const resetType = async (type: SmbDocumentType) => {
    setSavingType(type);
    try {
      await supabase.from('host_document_templates').delete().eq('host_id', hostId).eq('document_type', type);
      if (type === 'waiver') {
        const seed = globalTemplates.find((t) => t.document_type === 'waiver')?.full_text?.trim() || defaultDocumentBody('waiver');
        onWaiverTemplateChange(seed);
        await supabase.from('profiles').update({ waiver_template: null }).eq('id', hostId);
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
      toast.success(`Restored built-in ${documentTypeLabel(type)} template`);
      await load();
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setSavingType(null);
    }
  };

  const uploadNamedPdf = async (file: File | null) => {
    if (!file) return;
    if (!scopeAlreadyAccepted && !scopeAcked) {
      toast.error('Confirm Sign-by-Text scope before uploading a PDF.');
      return;
    }
    setPdfBusy(true);
    try {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('We only accept PDF files right now. Save or export as PDF, then upload that file.');
        return;
      }
      if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
        toast.error(`This file is a bit large (over ${formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)}) — compress it or remove large images, then re-upload.`);
        return;
      }
      const name = pdfName.trim() || file.name.replace(/\.pdf$/i, '').slice(0, 120);
      const path = `${hostId}/library/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(DOCUMENT_UPLOAD_BUCKET)
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from('host_document_files').insert({
        host_id: hostId,
        name,
        file_path: path,
        file_name: file.name.slice(0, 200),
        file_size_bytes: file.size,
      });
      if (error) {
        await supabase.storage.from(DOCUMENT_UPLOAD_BUCKET).remove([path]);
        throw error;
      }
      if (!scopeAlreadyAccepted && scopeAcked) {
        await supabase
          .from('profiles')
          .update({ sign_by_text_scope_accepted_at: new Date().toISOString() })
          .eq('id', hostId);
        await refreshProfile();
      }
      setPdfName('');
      toast.success('PDF saved — it will appear in Document Type when you send.');
      await load();
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setPdfBusy(false);
    }
  };

  const deleteFile = async (row: HostDocumentFile) => {
    try {
      await supabase.from('host_document_files').delete().eq('id', row.id).eq('host_id', hostId);
      await supabase.storage.from(DOCUMENT_UPLOAD_BUCKET).remove([row.file_path]);
      toast.success('Removed saved PDF');
      await load();
    } catch (err) {
      toast.error(formatErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Default document templates</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Built-in wording is the starting point. Open a type, edit, and save your own version. Sending still works without customizing.
        </p>
        <div className="space-y-2">
          {HOST_EDITABLE_TEMPLATE_TYPES.map((type) => {
            const open = openType === type;
            const customized = overrides.some((o) => o.document_type === type) || (type === 'waiver' && !!waiverTemplate.trim());
            return (
              <div key={type} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenType(open ? null : type)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-brand-600 shrink-0" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{documentTypeLabel(type)}</span>
                    {customized && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                        Custom
                      </span>
                    )}
                  </span>
                  {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <textarea
                      value={draftFor(type)}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [type]: e.target.value }))}
                      rows={10}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingType === type}
                        onClick={() => void saveType(type)}
                        className="min-h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {savingType === type ? 'Saving…' : 'Save template'}
                      </button>
                      <button
                        type="button"
                        disabled={savingType === type}
                        onClick={() => void resetType(type)}
                        className="min-h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Restore built-in
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Saved PDFs</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Upload a PDF once, name it, then pick it from Document Type when you send. PDF only, up to {formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)}.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{DOCUMENT_UPLOAD_READABILITY_HINT}</p>
        {!scopeAlreadyAccepted && (
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-3">
            <input
              type="checkbox"
              checked={scopeAcked}
              onChange={(e) => setScopeAcked(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
              {signByTextAckLabel(uploadMaxLabel)}
            </span>
          </label>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={pdfName}
            onChange={(e) => setPdfName(e.target.value.slice(0, 120))}
            placeholder="Name (e.g. Standard liability waiver)"
            className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
          <label className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold cursor-pointer">
            <Upload className="h-4 w-4" />
            {pdfBusy ? 'Uploading…' : 'Upload PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={pdfBusy}
              onChange={(e) => {
                void uploadNamedPdf(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {files.length === 0 ? (
          <p className="text-sm text-slate-400">No saved PDFs yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{f.name}</p>
                  <p className="text-xs text-slate-400 truncate">{f.file_name} · {formatBytes(f.file_size_bytes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteFile(f)}
                  className="p-2 text-slate-400 hover:text-red-500"
                  aria-label={`Delete ${f.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
