import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fmt(iso: string | null | undefined, tz: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'long',
      timeZone: tz && tz.length > 0 ? tz : 'UTC',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString();
  }
}

async function sendResendEmail(to: string, subject: string, html: string, resendKey: string, fromEmail: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error('[generate-document-certificate] Resend error', await res.text());
    return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ ok: false, error: 'Server is not configured' }, 500);
  }

  let payload: { token?: string; emailHost?: boolean };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const token = payload.token?.trim();
  if (!token) return json({ ok: false, error: 'token required' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Allow anon (signer, right after submit) or authenticated sender.
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await caller.auth.getUser();
  const callerId = userData.user?.id ?? null;

  const { data: doc, error: docErr } = await admin
    .from('documents')
    .select(
      'id, token, sender_id, recipient_name, recipient_phone, document_type, document_type_custom, topic, status, created_at, viewed_at, otp_verified_at, esign_consent_at, esign_consent_text, document_agreed_at, signed_at, ip_address, user_agent, signature_data, document_snapshot_text, document_sha256, certificate_path, timezone_at_sign, file_name, file_path',
    )
    .eq('token', token)
    .maybeSingle();

  if (docErr || !doc) return json({ ok: false, error: 'Document not found' }, 404);
  if (doc.status !== 'signed') return json({ ok: false, error: 'Document is not signed yet' }, 400);
  if (callerId && callerId !== doc.sender_id) {
    // Authenticated non-sender cannot fetch
    return json({ ok: false, error: 'Forbidden' }, 403);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('email, notification_email, full_name, business_name')
    .eq('id', doc.sender_id)
    .maybeSingle();

  const tz = doc.timezone_at_sign || 'UTC';
  const typeLabel =
    doc.document_type === 'other' && doc.document_type_custom?.trim()
      ? doc.document_type_custom.trim()
      : String(doc.document_type || 'document').replaceAll('_', ' ');

  const lines: string[] = [
    'PinOnIt — Certificate of Completion',
    '',
    'This certificate records the electronic signature audit data captured by PinOnIt.',
    'Meets federal ESIGN Act requirements for electronic signatures. PinOnIt does not provide legal advice.',
    '',
    `Unique document ID: ${doc.id}`,
    `Document token: ${doc.token}`,
    `Document type: ${typeLabel}`,
    `Topic: ${doc.topic || '—'}`,
    `Signer full name (as entered): ${doc.recipient_name}`,
    `Signer mobile number: ${doc.recipient_phone || '—'}`,
    '',
    'Event timestamps (with timezone):',
    `  Opened:    ${fmt(doc.viewed_at, tz)} (${tz})`,
    `  Verified:  ${fmt(doc.otp_verified_at, tz)} (${tz})`,
    `  Consented: ${fmt(doc.esign_consent_at, tz)} (${tz})`,
    `  Signed:    ${fmt(doc.signed_at, tz)} (${tz})`,
    '',
    `IP address at signing: ${doc.ip_address || '—'}`,
    `User agent at signing: ${doc.user_agent || '—'}`,
    `SHA-256 of signed document snapshot: ${doc.document_sha256 || '—'}`,
    '',
    'Consent statement (captured verbatim):',
    doc.esign_consent_text || '—',
    '',
    'Document snapshot (exact text / version signed):',
    (doc.document_snapshot_text || '(see attached PDF file if uploaded)').slice(0, 3500),
    '',
    `Signature image captured: ${doc.signature_data && doc.signature_data.startsWith('data:image') ? 'Yes (embedded below when available)' : doc.signature_data === 'confirmed' ? 'Confirmed without drawn mark' : '—'}`,
    '',
    `Generated at: ${new Date().toISOString()}`,
    'Retention: This certificate is stored independently of account status and remains retrievable after cancellation.',
  ];

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 752;
  const margin = 48;
  const maxWidth = 612 - margin * 2;

  const drawWrapped = (text: string, size: number, useBold = false) => {
    const f = useBold ? bold : font;
    const words = text.split(/\s+/);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > maxWidth) {
        if (y < 60) {
          page = pdf.addPage([612, 792]);
          y = 752;
        }
        page.drawText(line || word, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.15) });
        y -= size + 4;
        line = line ? word : '';
      } else {
        line = next;
      }
    }
    if (line) {
      if (y < 60) {
        page = pdf.addPage([612, 792]);
        y = 752;
      }
      page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.15) });
      y -= size + 4;
    }
  };

  for (const raw of lines) {
    if (!raw) {
      y -= 8;
      continue;
    }
    if (raw.startsWith('PinOnIt')) {
      drawWrapped(raw, 14, true);
      y -= 4;
    } else {
      drawWrapped(raw, 9, false);
    }
  }

  if (doc.signature_data?.startsWith('data:image/png;base64,')) {
    try {
      const b64 = doc.signature_data.split(',')[1] ?? '';
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const img = await pdf.embedPng(bytes);
      if (y < 140) {
        page = pdf.addPage([612, 792]);
        y = 752;
      }
      y -= 12;
      page.drawText('Signature image:', {
        x: margin,
        y,
        size: 10,
        font: bold,
        color: rgb(0.1, 0.1, 0.15),
      });
      y -= 8;
      const w = Math.min(280, img.width);
      const h = (img.height / img.width) * w;
      y -= h;
      page.drawImage(img, { x: margin, y, width: w, height: h });
    } catch (e) {
      console.error('[generate-document-certificate] signature embed failed', e);
    }
  }

  const pdfBytes = await pdf.save();
  const path = `${doc.id}/certificate-of-completion.pdf`;

  const { error: upErr } = await admin.storage
    .from('document-certificates')
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (upErr) {
    console.error('[generate-document-certificate] upload', upErr);
    return json({ ok: false, error: upErr.message }, 500);
  }

  await admin
    .from('documents')
    .update({ certificate_path: path, certificate_generated_at: new Date().toISOString() })
    .eq('id', doc.id);

  const { data: signed } = await admin.storage
    .from('document-certificates')
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  const downloadUrl = signed?.signedUrl ?? null;
  const hostEmail =
    (profile?.notification_email as string | undefined)?.trim() ||
    (profile?.email as string | undefined)?.trim() ||
    '';

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'PinOnIt <noreply@pinonit.com>';
  const shouldEmail = payload.emailHost !== false;

  if (shouldEmail && resendKey && hostEmail && downloadUrl) {
    const hostName = (profile?.business_name || profile?.full_name || 'there') as string;
    await sendResendEmail(
      hostEmail,
      `Signed: ${typeLabel} — certificate of completion`,
      `<p>Hi ${hostName},</p>
       <p><strong>${doc.recipient_name}</strong> signed your ${typeLabel}${doc.topic ? ` (${doc.topic})` : ''}.</p>
       <p>Meets federal ESIGN Act requirements for electronic signatures. Every signature includes a complete audit record.</p>
       <p><a href="${downloadUrl}">Download certificate of completion (PDF)</a></p>
       <p>You can also retrieve it later from Send Docs + Sign-by-Text. Certificates are retained even if the account is cancelled.</p>
       <p>PinOnIt does not provide legal advice.</p>`,
      resendKey,
      fromEmail,
    );
  }

  return json({
    ok: true,
    certificate_path: path,
    download_url: downloadUrl,
    emailed: Boolean(shouldEmail && hostEmail),
  });
});
