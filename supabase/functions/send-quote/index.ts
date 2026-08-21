import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { appendSmsOptOut } from '../_shared/sms-opt-out.ts';
import { NOREPLY_FROM, SUPPORT_EMAIL } from '../_shared/contact-email.ts';
import { jsonAuthError } from '../_shared/callerAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type LineItem = { description?: string; amount?: number };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function kindLabel(kind: string) {
  if (kind === 'invoice') return 'invoice';
  if (kind === 'receipt') return 'receipt';
  return 'quote';
}

function kindTitle(kind: string) {
  if (kind === 'invoice') return 'Invoice';
  if (kind === 'receipt') return 'Receipt';
  return 'Quote';
}

function lineTotal(items: LineItem[]) {
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function htmlEscape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

async function sendResendEmail(to: string, subject: string, html: string, text: string, resendKey: string) {
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? NOREPLY_FROM;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      reply_to: SUPPORT_EMAIL,
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    console.error('Resend error:', await res.text());
    return false;
  }
  return true;
}

async function sendTwilioSms(to: string, body: string) {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (!twilioSid || !twilioToken || !messagingServiceSid) {
    return { ok: false, error: 'SMS is not configured' };
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        MessagingServiceSid: messagingServiceSid,
        To: to,
        Body: appendSmsOptOut(body),
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    console.error('Twilio error:', err);
    return { ok: false, error: err };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const header = req.headers.get('Authorization') ?? '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token || token === 'anon') return jsonAuthError(corsHeaders);
    const { data: userData } = await supabase.auth.getUser(token);
    const hostId = userData.user?.id;
    if (!hostId) return jsonAuthError(corsHeaders);

    const body = await req.json();
    const quoteId = String(body.quote_id ?? '');
    const via = Array.isArray(body.via) ? body.via.map(String) : [];
    const sendEmail = via.includes('email');
    const sendSms = via.includes('sms');
    if (!quoteId || (!sendEmail && !sendSms)) {
      return jsonResponse({ error: 'Choose email and/or text, then send.' }, 400);
    }

    const { data: quote, error: quoteErr } = await supabase
      .from('host_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('host_id', hostId)
      .maybeSingle();
    if (quoteErr || !quote) {
      return jsonResponse({ error: 'Quote not found' }, 404);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', hostId)
      .maybeSingle();

    const hostName = (profile?.full_name || profile?.email || 'Your host').trim();
    const items = Array.isArray(quote.line_items) ? (quote.line_items as LineItem[]) : [];
    const total = lineTotal(items);
    const money = formatMoney(total, quote.currency || 'USD');
    const appUrl = (Deno.env.get('APP_URL') || 'https://pinonit.com').replace(/\/$/, '');
    const viewUrl = `${appUrl}/q/${quote.token}`;
    const kind = kindLabel(quote.kind);
    const title = kindTitle(quote.kind);
    const clientName = (quote.client_name as string | null)?.trim() || 'there';

    const sentVia: string[] = Array.isArray(quote.sent_via) ? [...quote.sent_via] : [];
    const errors: string[] = [];

    if (sendEmail) {
      const to = (quote.client_email as string | null)?.trim();
      if (!to) {
        errors.push('Add a client email to send by email.');
      } else {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (!resendKey) {
          errors.push('Email sending is not configured.');
        } else {
          const itemRows = items
            .filter((i) => (i.description || '').trim() || Number(i.amount))
            .map(
              (i) =>
                `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${htmlEscape((i.description || '').trim() || 'Item')}</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${htmlEscape(formatMoney(Number(i.amount) || 0, quote.currency || 'USD'))}</td></tr>`,
            )
            .join('');
          const payLine = quote.pay_elsewhere_url
            ? `<p style="margin:24px 0 0;"><a href="${htmlEscape(quote.pay_elsewhere_url)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Pay ${htmlEscape(quote.pay_elsewhere_label || 'now')}</a></p>`
            : '';
          const html = `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">From ${htmlEscape(hostName)}</p>
              <h1 style="margin:0 0 16px;font-size:22px;">${htmlEscape(title)}</h1>
              <p>Hi ${htmlEscape(clientName)},</p>
              <p>Here is your ${htmlEscape(kind)} for <strong>${htmlEscape(money)}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">${itemRows}
                <tr><td style="padding-top:12px;font-weight:700;">Total</td><td style="padding-top:12px;text-align:right;font-weight:700;">${htmlEscape(money)}</td></tr>
              </table>
              ${quote.notes ? `<p style="white-space:pre-wrap;">${htmlEscape(quote.notes)}</p>` : ''}
              ${payLine}
              <p style="margin-top:24px;"><a href="${htmlEscape(viewUrl)}">View ${htmlEscape(kind)}</a></p>
              <p style="margin-top:32px;font-size:12px;color:#9ca3af;">Sent with PinOnIt</p>
            </div>`;
          const text = [
            `Hi ${clientName},`,
            '',
            `${hostName} sent you a ${kind} for ${money}.`,
            quote.notes ? `\n${quote.notes}\n` : '',
            quote.pay_elsewhere_url ? `Pay: ${quote.pay_elsewhere_url}` : '',
            `View: ${viewUrl}`,
          ]
            .filter(Boolean)
            .join('\n');
          const ok = await sendResendEmail(to, `${title} from ${hostName} — ${money}`, html, text, resendKey);
          if (!ok) errors.push('Email failed to send.');
          else if (!sentVia.includes('email')) sentVia.push('email');
        }
      }
    }

    if (sendSms) {
      const to = (quote.client_phone as string | null)?.trim();
      if (!to) {
        errors.push('Add a client phone to send by text.');
      } else {
        const payBit = quote.pay_elsewhere_url ? ` Pay: ${quote.pay_elsewhere_url}` : '';
        const msg = `${hostName} sent you a ${kind} for ${money}.${payBit} View: ${viewUrl}`;
        const result = await sendTwilioSms(to, msg);
        if (!result.ok) errors.push(result.error || 'Text failed to send.');
        else if (!sentVia.includes('sms')) sentVia.push('sms');
      }
    }

    if (sentVia.length > 0) {
      await supabase
        .from('host_quotes')
        .update({ status: 'sent', sent_via: sentVia, updated_at: new Date().toISOString() })
        .eq('id', quoteId)
        .eq('host_id', hostId);
    }

    if (errors.length && sentVia.length === 0) {
      return jsonResponse({ error: errors.join(' ') }, 400);
    }

    return jsonResponse({
      success: true,
      view_url: viewUrl,
      sent_via: sentVia,
      warnings: errors,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 400);
  }
});
