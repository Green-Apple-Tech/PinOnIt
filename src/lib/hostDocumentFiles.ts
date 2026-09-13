import { supabase } from './supabase';
import { DOCUMENT_UPLOAD_BUCKET, DOCUMENT_UPLOAD_MAX_BYTES } from './documentTypes';
import { templateNameFromFile, type HostDocumentFile } from './hostDocuments';

export function assertHostPdfFile(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'We only accept PDF files right now. Save or export as PDF, then upload that file.';
  }
  if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    return `This file is a bit large (over ${Math.round(DOCUMENT_UPLOAD_MAX_BYTES / (1024 * 1024))}MB) — compress it or remove large images, then re-upload.`;
  }
  return null;
}

/** Save an uploaded PDF as a reusable host template (not a one-off send). */
export async function saveHostPdfTemplate(opts: {
  hostId: string;
  file: File;
  name?: string;
}) {
  const problem = assertHostPdfFile(opts.file);
  if (problem) return { data: null, error: new Error(problem) };

  const name = (opts.name?.trim() || templateNameFromFile(opts.file)).slice(0, 120);
  const path = `${opts.hostId}/library/${crypto.randomUUID()}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(DOCUMENT_UPLOAD_BUCKET)
    .upload(path, opts.file, { contentType: 'application/pdf', upsert: false });
  if (upErr) return { data: null, error: upErr };

  const { data, error } = await supabase
    .from('host_document_files')
    .insert({
      host_id: opts.hostId,
      name,
      file_path: path,
      file_name: opts.file.name.slice(0, 200),
      file_size_bytes: opts.file.size,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(DOCUMENT_UPLOAD_BUCKET).remove([path]);
    return { data: null, error };
  }
  return { data: data as HostDocumentFile, error: null };
}

export async function renameHostPdfTemplate(opts: { id: string; hostId: string; name: string }) {
  const name = opts.name.trim().slice(0, 120);
  if (!name) return { error: new Error('Give this template a name.') };
  const { error } = await supabase
    .from('host_document_files')
    .update({ name })
    .eq('id', opts.id)
    .eq('host_id', opts.hostId);
  return { error };
}

export async function archiveHostPdfTemplate(opts: { id: string; hostId: string; archived: boolean }) {
  const { error } = await supabase
    .from('host_document_files')
    .update({ archived_at: opts.archived ? new Date().toISOString() : null })
    .eq('id', opts.id)
    .eq('host_id', opts.hostId);
  return { error };
}
