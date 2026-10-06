/** Pure scoring and reply drafts for the Reddit Opportunity Finder. No network calls. */

export const PINONIT_PRICE = '$8.99/mo';

export type Mention = 'yes' | 'maybe' | 'no';
export type Band = 'green' | 'yellow' | 'red';

export type FinderSettings = {
  minGreenScore: number;
  minKeepScore: number;
  maxCommentsPerDay: number;
  maxMentionsPerDay: number;
  maxPerSubredditPerDay: number;
  cooldownHours: number;
  allowSubreddits: string[];
  blockSubreddits: string[];
  allowKeywords: string[];
  blockKeywords: string[];
};

export const DEFAULT_FINDER_SETTINGS: FinderSettings = {
  minGreenScore: 80,
  minKeepScore: 45,
  maxCommentsPerDay: 3,
  maxMentionsPerDay: 2,
  maxPerSubredditPerDay: 1,
  cooldownHours: 8,
  allowSubreddits: [],
  blockSubreddits: [],
  allowKeywords: [],
  blockKeywords: ['notary', 'hipaa', 'election', 'suicide'],
};

export type FinderQuery = {
  q: string;
  industry: string;
  feature: string;
  /** How strongly this search phrase signals someone is shopping. 0–40. */
  intent: number;
  /** Phrase people also type into Google. Not a live rank check. */
  seo: boolean;
};

export const FINDER_QUERIES: FinderQuery[] = [
  { q: 'Calendly alternatives', industry: 'general', feature: 'scheduling', intent: 36, seo: true },
  { q: 'Calendly alternative', industry: 'general', feature: 'scheduling', intent: 36, seo: true },
  { q: 'electronic signature alternatives', industry: 'general', feature: 'sign-by-text', intent: 36, seo: true },
  { q: 'send document by text', industry: 'general', feature: 'sign-by-text', intent: 34, seo: true },
  { q: 'digital waiver', industry: 'general', feature: 'waivers', intent: 30, seo: true },
  { q: 'customer no-shows', industry: 'general', feature: 'sms-reminders', intent: 28, seo: true },
  { q: 'scheduling software for small business', industry: 'general', feature: 'scheduling', intent: 32, seo: true },
  { q: 'cleaning business software', industry: 'cleaners', feature: 'scheduling', intent: 28, seo: true },
  { q: 'mobile detailing software', industry: 'detailers', feature: 'scheduling', intent: 28, seo: true },
  { q: 'landscaping software', industry: 'landscapers', feature: 'scheduling', intent: 26, seo: true },
  { q: 'handyman software', industry: 'handyman', feature: 'scheduling', intent: 26, seo: true },
  { q: 'small business CRM', industry: 'general', feature: 'scheduling', intent: 22, seo: true },
  { q: 'client scheduling app', industry: 'general', feature: 'scheduling', intent: 30, seo: true },
  { q: 'DocuSign alternative', industry: 'general', feature: 'sign-by-text', intent: 36, seo: true },
  { q: 'cheap DocuSign alternative', industry: 'general', feature: 'sign-by-text', intent: 38, seo: true },
  { q: 'appointment scheduling software small business', industry: 'general', feature: 'scheduling', intent: 32, seo: true },
  { q: 'SMS appointment reminders', industry: 'general', feature: 'sms-reminders', intent: 34, seo: true },
  { q: 'text appointment reminders', industry: 'general', feature: 'sms-reminders', intent: 32, seo: true },
  { q: 'send contract by text', industry: 'contractors', feature: 'sign-by-text', intent: 36, seo: true },
  { q: 'send waiver by text', industry: 'general', feature: 'waivers', intent: 36, seo: true },
  { q: 'electronic waiver app', industry: 'general', feature: 'waivers', intent: 30, seo: true },
  { q: 'digital waiver software', industry: 'general', feature: 'waivers', intent: 30, seo: true },
  { q: 'signature by text', industry: 'general', feature: 'sign-by-text', intent: 34, seo: true },
  { q: 'customer signature without an app', industry: 'general', feature: 'sign-by-text', intent: 34, seo: true },
  { q: 'customers won\'t download app waiver', industry: 'general', feature: 'sign-by-text', intent: 32, seo: false },
  { q: 'reduce appointment no shows', industry: 'general', feature: 'sms-reminders', intent: 28, seo: true },
  { q: 'contractor scheduling software', industry: 'contractors', feature: 'scheduling', intent: 30, seo: true },
  { q: 'software for small contractors', industry: 'contractors', feature: 'scheduling', intent: 26, seo: true },
  { q: 'handyman estimate and schedule', industry: 'handyman', feature: 'estimates', intent: 28, seo: false },
  { q: 'cleaning business scheduling software', industry: 'cleaners', feature: 'scheduling', intent: 28, seo: true },
  { q: 'mobile detailing booking software', industry: 'detailers', feature: 'scheduling', intent: 28, seo: false },
  { q: 'landscaping customer reminders', industry: 'landscapers', feature: 'sms-reminders', intent: 26, seo: false },
  { q: 'pressure washing quote by text', industry: 'pressure-washers', feature: 'estimates', intent: 28, seo: false },
  { q: 'photographer contract signing', industry: 'photographers', feature: 'sign-by-text', intent: 24, seo: false },
  { q: 'barber appointment reminder text', industry: 'barbers', feature: 'sms-reminders', intent: 26, seo: false },
  { q: 'salon no show text reminder', industry: 'salons', feature: 'sms-reminders', intent: 26, seo: false },
  { q: 'massage intake form text', industry: 'massage', feature: 'consent', intent: 24, seo: false },
  { q: 'personal trainer waiver', industry: 'trainers', feature: 'waivers', intent: 24, seo: false },
  { q: 'boat rental waiver', industry: 'marine', feature: 'waivers', intent: 26, seo: false },
  { q: 'property manager work order signature', industry: 'property-managers', feature: 'work-orders', intent: 24, seo: false },
  { q: 'home inspector report sign off', industry: 'inspectors', feature: 'inspection', intent: 22, seo: false },
  { q: 'HVAC service agreement text', industry: 'hvac', feature: 'service-agreements', intent: 26, seo: false },
  { q: 'plumber estimate approval text', industry: 'plumbers', feature: 'estimates', intent: 26, seo: false },
  { q: 'pool company service agreement', industry: 'pool', feature: 'service-agreements', intent: 22, seo: false },
  { q: 'mobile mechanic work approval', industry: 'mechanics', feature: 'job-approvals', intent: 22, seo: false },
];

const ASK_RE =
  /\b(looking for|recommend|recommendation|alternative|what do you use|what are you using|switch(ing)? from|too expensive|cheaper|any suggestions|which (app|software|tool))\b/i;

const NO_SHOW_RE = /\b(no[- ]?shows?|forget|forgot|don't show|didn'?t show)\b/i;
const NO_APP_RE = /\b(won'?t download|dont download|no app|without (an )?account|without downloading|hate apps)\b/i;

const BAD_FIT_RE =
  /\b(notary|notariz|hipaa|medical record|enterprise|salesforce|payroll|inventory|closing disclosure|multi-?signer|power of attorney|deed|will and testament)\b/i;

const PROMO_BAN_RE =
  /\b(no self-?promo\w*|no advertising|no solicitation|no vendor|don'?t (advertise|promote|pitch)|no spam)\b/i;

const SENSITIVE_RE =
  /\b(suicide|self-harm|election|democrat|republican|abortion|overdose|obituary|funeral)\b/i;

const FEATURE_LINE: Record<string, string> = {
  scheduling: 'a booking link where the customer picks a time',
  'sms-reminders': 'text reminders before the appointment',
  'sign-by-text': 'texting a document the customer can sign in the browser, with no app and no PinOnIt account',
  waivers: 'texting a waiver the customer signs in the browser, with no app and no account',
  estimates: 'texting an estimate the customer can approve',
  consent: 'texting a consent form they can sign on their phone',
  'work-orders': 'texting a work order for a signature',
  'service-agreements': 'putting a short service agreement on a text or booking link',
  inspection: 'sending an inspection sign-off by text',
  'job-approvals': 'getting a job approval by text before the work starts',
};

export type ScoreInput = {
  title: string;
  body: string;
  createdUtc: number;
  numComments: number;
  archived: boolean;
  query: FinderQuery;
  rulesText: string;
  nowMs?: number;
  /** 1 is the first search result. Omitted when discovery did not come from a search engine. */
  searchRank?: number | null;
  dateUnknown?: boolean;
};

export type ScoreResult = {
  score: number;
  mention: Mention;
  mentionReason: string;
  problem: string;
  whyRelevant: string;
  suggestedResponse: string;
  highSeoValue: boolean;
  rulesNote: string;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function problemSentence(title: string, body: string): string {
  const clean = body.replace(/\s+/g, ' ').trim();
  const first = clean.split(/(?<=[.!?])\s/)[0] ?? '';
  if (first.length >= 40 && first.length <= 220) return first;
  return title.trim();
}

export function scoreOpportunity(input: ScoreInput): ScoreResult {
  const now = input.nowMs ?? Date.now();
  const ageMs = Math.max(0, now - input.createdUtc * 1000);
  const day = 24 * 60 * 60 * 1000;
  const text = `${input.title}\n${input.body}`;
  const rulesBan = PROMO_BAN_RE.test(input.rulesText);
  const badFit = BAD_FIT_RE.test(text);
  const asking = ASK_RE.test(text);
  const feature = FEATURE_LINE[input.query.feature] ?? 'scheduling plus a document the customer can sign from a text';
  const problem = problemSentence(input.title, input.body);

  let score = input.query.intent;
  if (input.dateUnknown) score += 6;
  else if (ageMs <= day) score += 22;
  else if (ageMs <= 7 * day) score += 14;
  else if (ageMs <= 30 * day) score += 6;
  else score -= 8;
  if (input.searchRank != null && input.searchRank <= 3) score += 14;
  else if (input.searchRank != null && input.searchRank <= 10) score += 8;
  if (asking) score += 16;
  if (/\b(calendly|docusign|hellosign|jotform|square appointments|jobber|housecall)\b/i.test(text)) score += 8;
  if (NO_SHOW_RE.test(text) || NO_APP_RE.test(text)) score += 8;
  if (input.numComments >= 2 && !input.archived) score += 6;
  if (input.archived) score -= 12;
  if (badFit) score -= 28;
  if (rulesBan) score -= 30;

  let mention: Mention = 'maybe';
  let mentionReason = 'PinOnIt overlaps the problem, but the thread is not a clear request for a tool.';
  if (rulesBan) {
    mention = 'no';
    mentionReason = 'This subreddit’s rules restrict promotion or solicitation, so a product mention would not be welcome.';
  } else if (badFit) {
    mention = 'no';
    mentionReason = 'The thread is about a job PinOnIt does not do (for example notary, multi-signer closings, or enterprise software).';
  } else if (asking && input.query.intent >= 28 && ageMs <= 30 * day) {
    mention = 'yes';
    mentionReason = 'Someone is asking for a recommendation, the topic matches a PinOnIt feature, and the thread is recent.';
  } else if (!asking && input.query.intent < 26) {
    mention = 'no';
    mentionReason = 'The keyword matched, but nobody is asking what to buy. A product mention would feel dropped in.';
  }

  if (mention === 'no') score = Math.min(score, rulesBan || badFit ? 24 : 40);

  const why = mention === 'no'
    ? mentionReason
    : `They are talking about ${input.query.feature.replace(/-/g, ' ')} for a ${input.query.industry.replace(/-/g, ' ')} workflow. PinOnIt covers ${feature} at ${PINONIT_PRICE}.`;

  const suggestedResponse = draftResponse({
    mention,
    title: input.title,
    problem,
    feature,
    subreddit: input.query.industry,
  });

  return {
    score: clamp(score),
    mention,
    mentionReason,
    problem,
    whyRelevant: why,
    suggestedResponse,
    highSeoValue: input.query.seo && mention !== 'no',
    rulesNote: rulesBan
      ? 'Subreddit rules look like they limit promotion.'
      : input.rulesText.trim()
        ? 'Rules were checked and did not show a clear promotion ban.'
        : 'Subreddit rules were not loaded yet.',
  };
}

const DISCLOSURES = [
  'Full disclosure, I built PinOnIt.',
  'I should say I made PinOnIt.',
  'Disclosure: PinOnIt is my product.',
  'I’m the person who built PinOnIt, so weigh that.',
];

function pick(seed: string, options: string[]): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  return options[hash % options.length];
}

export function draftResponse(input: {
  mention: Mention;
  title: string;
  problem: string;
  feature: string;
  subreddit?: string;
}): string {
  const title = input.title.replace(/\s+/g, ' ').trim();
  if (input.mention === 'no') {
    return `Answer “${title}” directly and do not mention PinOnIt. ${input.problem}`;
  }
  const disclosure = pick(title, DISCLOSURES);
  const link = input.subreddit
    ? ` https://pinonit.com/?utm_source=reddit&utm_medium=founder&utm_campaign=${encodeURIComponent(input.subreddit)}`
    : '';
  const shapes = [
    `On “${title}”: ${input.problem} ${disclosure} For this, it includes ${input.feature}. ${PINONIT_PRICE}.${link}`,
    `The short version for “${title}”: ${input.problem} ${disclosure} It includes ${input.feature} and costs ${PINONIT_PRICE}.${link}`,
    `“${title}” — ${disclosure} ${input.problem} The piece that matches this thread is ${input.feature}. ${PINONIT_PRICE}.${link}`,
  ];
  const body = pick(`${title}:${input.feature}`, shapes);
  if (input.mention === 'maybe') {
    return `Read the whole thread before posting. ${body}`;
  }
  return body;
}

export function classifyOpportunity(input: {
  score: number;
  mention: Mention;
  rulesBan: boolean;
  text: string;
  subreddit: string;
  settings?: Partial<FinderSettings>;
  duplicate: boolean;
  mentionsToday: number;
  subredditToday: number;
}): { band: Band; reason: string } {
  const settings = { ...DEFAULT_FINDER_SETTINGS, ...input.settings };
  const sub = input.subreddit.toLowerCase();
  const blockedSub = settings.blockSubreddits.some((name) => name.toLowerCase() === sub);
  const allowList = settings.allowSubreddits.map((name) => name.toLowerCase()).filter(Boolean);
  const notAllowed = allowList.length > 0 && !allowList.includes(sub);
  const blockedWord = settings.blockKeywords.some((word) => word && input.text.toLowerCase().includes(word.toLowerCase()));
  const allowedWord = settings.allowKeywords.filter(Boolean);
  const missingAllowedWord = allowedWord.length > 0 && !allowedWord.some((word) => input.text.toLowerCase().includes(word.toLowerCase()));

  if (input.rulesBan || SENSITIVE_RE.test(input.text) || blockedSub || notAllowed || blockedWord || missingAllowedWord || input.duplicate || input.score < settings.minKeepScore || input.mention === 'no') {
    return { band: 'red', reason: 'Skip. The thread is off-topic, blocked, duplicate, sensitive, or PinOnIt would not genuinely help.' };
  }
  if (
    input.mention === 'yes'
    && input.score >= settings.minGreenScore
    && input.mentionsToday < settings.maxMentionsPerDay
    && input.subredditToday < settings.maxPerSubredditPerDay
  ) {
    return { band: 'green', reason: 'Strong match. Ready for you to post. Reddit does not allow this app to post it automatically.' };
  }
  return { band: 'yellow', reason: 'Possibly useful, but it needs your review before anyone replies.' };
}

export function parsePublicSearchResults(html: string): Array<{ title: string; link: string; snippet: string; position: number }> {
  const results: Array<{ title: string; link: string; snippet: string; position: number }> = [];
  const row = /uddg=([^&"']+)[^>]*class='result-link'>([^<]*)<\/a>[\s\S]*?class='result-snippet'>([\s\S]*?)<\/td>/g;
  let match: RegExpExecArray | null;
  while ((match = row.exec(html))) {
    const link = decodeURIComponent(match[1].replace(/&amp;/g, '&'));
    if (!link.includes('reddit.com')) continue;
    results.push({
      title: decodeSearchText(match[2]).replace(/\s*-\s*Reddit\s*$/i, '').trim(),
      link,
      snippet: decodeSearchText(match[3]).replace(/\s+/g, ' ').trim(),
      position: results.length + 1,
    });
    if (results.length >= 8) break;
  }
  return results;
}

function decodeSearchText(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function redditThreadFromUrl(raw: string): { fullname: string; permalink: string; subreddit: string } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^old\./, '');
  if (host !== 'reddit.com' && !host.endsWith('.reddit.com')) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'r' || parts[2] !== 'comments' || !parts[1] || !parts[3]) return null;
  const subreddit = parts[1];
  const id = parts[3];
  if (!/^[a-z0-9]+$/i.test(id)) return null;
  const slug = parts[4] ? `${parts[4]}/` : '';
  return { fullname: `t3_${id}`, permalink: `/r/${subreddit}/comments/${id}/${slug}`, subreddit };
}

export function opportunityKinds(input: {
  seoQuery: boolean;
  searchRank: number | null;
  ageDays: number | null;
  mention: Mention;
  band: Band;
  intent: number;
}): { customer: boolean; seo: boolean } {
  const recent = input.ageDays == null || input.ageDays <= 45;
  const customer = input.band !== 'red' && input.mention !== 'no' && recent && input.intent >= 26;
  const seo = (input.seoQuery || (input.searchRank != null && input.searchRank <= 5)) && input.band !== 'red';
  return { customer, seo };
}

export function redditPostUrl(permalink: string): string {
  if (permalink.startsWith('http')) return permalink;
  return `https://www.reddit.com${permalink.startsWith('/') ? '' : '/'}${permalink}`;
}
