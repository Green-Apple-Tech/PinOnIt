export const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

export function isValidSlackWebhookUrl(url: string): boolean {
  return SLACK_WEBHOOK_RE.test(url.trim());
}
