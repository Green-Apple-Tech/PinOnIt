import { useEffect, useState } from 'react';
import { Ban, Flag, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from './Toast';
import { parseBlockInput, type BookingBlock, type BlockReason } from '../lib/bookingBlocks';

export function BookingBlocksSettings({ hostId }: { hostId: string }) {
  const [blocks, setBlocks] = useState<BookingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [asSpam, setAsSpam] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('booking_blocks')
      .select('*')
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });
    setBlocks((data as BookingBlock[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [hostId]);

  const addBlock = async () => {
    const parsed = parseBlockInput(draft);
    if (!parsed) {
      toast.error('Enter an email (name@company.com) or a domain (spam.com).');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('booking_blocks').upsert(
      {
        host_id: hostId,
        match_type: parsed.matchType,
        value: parsed.value,
        reason: asSpam ? 'spam' : 'blocked',
      },
      { onConflict: 'host_id,match_type,value' },
    );
    setSaving(false);
    if (error) {
      toast.error('Could not save that block.');
      return;
    }
    setDraft('');
    toast.success(asSpam ? 'Marked as spam — they cannot book.' : 'Blocked — they cannot book.');
    void load();
  };

  const setReason = async (block: BookingBlock, reason: BlockReason) => {
    const { error } = await supabase.from('booking_blocks').update({ reason }).eq('id', block.id).eq('host_id', hostId);
    if (error) {
      toast.error('Could not update that entry.');
      return;
    }
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, reason } : b)));
  };

  const remove = async (block: BookingBlock) => {
    const { error } = await supabase.from('booking_blocks').delete().eq('id', block.id).eq('host_id', hostId);
    if (error) {
      toast.error('Could not remove that block.');
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Block emails &amp; domains</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          People on this list cannot book on your public page. Marking as spam is the same block, with a spam label so you remember why. You can also right-click a meeting on Calendar to block that guest.
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void addBlock(); }}
          placeholder="name@company.com or spam.com"
          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={asSpam}
            onChange={(e) => setAsSpam(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
          />
          Mark as spam
        </label>
        <button
          type="button"
          onClick={() => void addBlock()}
          disabled={saving || !draft.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add to list
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : blocks.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No blocked emails or domains yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {blocks.map((block) => (
            <li key={block.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {block.match_type === 'domain' ? `@${block.value}` : block.value}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {block.match_type === 'domain' ? 'Whole domain' : 'Email'}
                  {block.reason === 'spam' ? ' · Spam' : ''}
                </p>
              </div>
              {block.reason === 'spam' ? (
                <button
                  type="button"
                  onClick={() => void setReason(block, 'blocked')}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Unmark spam
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void setReason(block, 'spam')}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Flag className="h-3 w-3" />
                  Spam
                </button>
              )}
              <button
                type="button"
                onClick={() => void remove(block)}
                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400 flex items-start gap-1.5">
        <Ban className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Your public booking page ({`pinonit.com/yourname`}) stays up. Only these people are turned away.
      </p>
    </div>
  );
}
