import { INTENT_PATHS } from './seoIntentPages';
import { readCampaignParams } from './campaignAttribution';

const SESSION_KEY = 'pinonit_mkt_logged';

const MARKETING_PREFIXES = [
  '/',
  '/calendly-alternative',
  '/why-pinonit',
  '/legal-templates',
  '/nda',
  '/reminders',
  ...INTENT_PATHS,
];

function isMarketingPath(pathname: string) {
  if (MARKETING_PREFIXES.includes(pathname)) return true;
  return INTENT_PATHS.includes(pathname);
}

export async function logMarketingVisit(pathname: string) {
  if (typeof window === 'undefined') return;
  if (!isMarketingPath(pathname)) return;
  try {
    const logged = sessionStorage.getItem(SESSION_KEY);
    const seen = logged ? (JSON.parse(logged) as string[]) : [];
    if (seen.includes(pathname)) return;
    seen.push(pathname);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(seen.slice(-40)));
  } catch {
    return;
  }

  const params = readCampaignParams();
  try {
    const { supabase } = await import('./supabase');
    await supabase.from('marketing_visits').insert({
      path: pathname.slice(0, 120),
      utm_source: params.utm_source?.slice(0, 80) || null,
      utm_medium: params.utm_medium?.slice(0, 80) || null,
      utm_campaign: params.utm_campaign?.slice(0, 120) || null,
      referrer_host: referrerHost(),
    });
  } catch {
    /* table may not exist yet */
  }
}

function referrerHost() {
  try {
    if (!document.referrer) return null;
    return new URL(document.referrer).hostname.replace(/^www\./, '').slice(0, 120);
  } catch {
    return null;
  }
}
