const STORAGE_KEY = 'pinonit_campaign';

export const CAMPAIGN_QUERY_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
] as const;

export type CampaignParams = Partial<Record<(typeof CAMPAIGN_QUERY_KEYS)[number] | 'landing', string>>;

function canStore() {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function readCampaignParams(): CampaignParams {
  if (!canStore()) return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CampaignParams;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function captureCampaignParams(search: string, landingPath?: string): CampaignParams {
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const next: CampaignParams = { ...readCampaignParams() };
  for (const key of CAMPAIGN_QUERY_KEYS) {
    const value = sp.get(key)?.trim().slice(0, 200);
    if (value) next[key] = value;
  }
  if (!next.utm_source) {
    const fromRef = utmSourceFromReferrer();
    if (fromRef) next.utm_source = fromRef;
  }
  if (landingPath?.startsWith('/') && !landingPath.startsWith('//') && landingPath.length <= 80) {
    next.landing = landingPath;
  }
  if (canStore() && Object.keys(next).length > 0) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

/** ChatGPT search and similar referrers often omit UTM; keep the host as utm_source. */
export function utmSourceFromReferrer(referrer = typeof document !== 'undefined' ? document.referrer : '') {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) return 'chatgpt.com';
    if (host === 'chat.openai.com') return 'chatgpt.com';
    if (host === 'perplexity.ai' || host.endsWith('.perplexity.ai')) return 'perplexity.ai';
    return null;
  } catch {
    return null;
  }
}

export function campaignQueryString(params: CampaignParams = readCampaignParams()): string {
  const sp = new URLSearchParams();
  for (const key of CAMPAIGN_QUERY_KEYS) {
    const value = params[key];
    if (value) sp.set(key, value);
  }
  return sp.toString();
}

/** Signup URL with captured UTMs / referral code preserved. */
export function signupHref(params?: CampaignParams): string {
  const q = campaignQueryString(params);
  return q ? `/signup?${q}` : '/signup';
}

export async function persistSignupAttribution(userId: string) {
  const params = readCampaignParams();
  if (!userId || Object.keys(params).length === 0) return;
  try {
    const { supabase } = await import('./supabase');
    await supabase
      .from('profiles')
      .update({ signup_attribution: params })
      .eq('id', userId)
      .is('signup_attribution', null);
  } catch {
    /* column may not exist yet; non-critical */
  }
}
