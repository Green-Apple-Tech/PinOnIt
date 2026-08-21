/** Incoming Slack webhook helper. Failures must never throw into booking/reminder flow. */

const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

export function isValidSlackWebhookUrl(url: unknown): url is string {
  return typeof url === 'string' && SLACK_WEBHOOK_RE.test(url.trim());
}

export async function notifySlackWebhook(
  webhookUrl: unknown,
  text: string,
): Promise<void> {
  if (!isValidSlackWebhookUrl(webhookUrl)) return;
  const body = (text || '').trim();
  if (!body) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error('Slack webhook failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Slack webhook error:', err);
  } finally {
    clearTimeout(timer);
  }
}
