import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { hostIdFromJwt, jsonAuthError } from '../_shared/callerAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const MAX_WORDS = 10_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function truncateWords(text: string): { text: string; truncated: boolean } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS) return { text: text.trim(), truncated: false };
  return { text: words.slice(0, MAX_WORDS).join(' '), truncated: true };
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeBullets(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return json({ ok: false, error: 'Server is not configured' }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const hostId = await hostIdFromJwt(req, supabase);
  if (!hostId) return jsonAuthError(corsHeaders);

  let payload: {
    full_text?: string;
    existing_hash?: string | null;
    existing_summary?: string | null;
    force?: boolean;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const fullText = (payload.full_text ?? '').trim();
  if (!fullText) return json({ ok: false, error: 'full_text is required' }, 400);
  // Uploads never call this; still reject obvious PDF binary garbage.
  if (fullText.startsWith('%PDF')) {
    return json({ ok: false, error: 'Uploaded PDFs are not summarized' }, 400);
  }

  const hash = await sha256Hex(fullText);
  const existingHash = (payload.existing_hash ?? '').trim().toLowerCase();
  if (!payload.force && existingHash && existingHash === hash && (payload.existing_summary ?? '').trim()) {
    return json({
      ok: true,
      skipped: true,
      hash,
      truncated: false,
      summary: normalizeBullets(payload.existing_summary!),
      summary_text: normalizeBullets(payload.existing_summary!).join('\n'),
    });
  }

  const { text: forModel, truncated } = truncateWords(fullText);
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return json({ ok: false, error: 'Summary generation is not configured' }, 503);
  }

  const prompt = `Summarize this business agreement for a general reader who is about to sign it on their phone.

Rules:
- Write exactly 4 to 6 short bullet points
- Plain English only — no legal jargon
- Each bullet one sentence, max ~20 words
- Do not invent terms that are not in the text
- Do not say whether the document is legally binding or enforceable
- Output ONLY the bullets, one per line, starting with "- "

Document text:
---
${forModel}
---`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!aiRes.ok) {
    console.error('[summarize-document-template]', await aiRes.text());
    return json({ ok: false, error: 'Could not generate summary' }, 502);
  }

  const aiJson = (await aiRes.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const raw = (aiJson.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n');
  const summary = normalizeBullets(raw);
  if (summary.length < 3) {
    return json({ ok: false, error: 'Summary generation returned too little content' }, 502);
  }

  return json({
    ok: true,
    skipped: false,
    hash,
    truncated,
    summary,
    summary_text: summary.join('\n'),
    host_id: hostId,
  });
});
