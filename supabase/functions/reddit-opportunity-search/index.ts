import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { FINDER_QUERIES, classifyOpportunity, opportunityKinds, parsePublicSearchResults, redditThreadFromUrl, scoreOpportunity } from "../../../src/lib/redditFinder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STAFF = new Set(["support@pinonit.com", "stebbins.peter@gmail.com"]);
const QUERIES_PER_RUN = 5;
const POSTS_PER_QUERY = 8;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function userAgent(): string {
  return "web:pinonit-opportunity-finder:1.0 (contact support@pinonit.com)";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mailStaff(subject: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "PinOnIt <noreply@pinonit.com>",
      to: ["stebbins.peter@gmail.com"],
      subject,
      text,
    }),
  }).catch(() => undefined);
}

type RedditPost = {
  id?: string;
  name?: string;
  title?: string;
  selftext?: string;
  subreddit?: string;
  permalink?: string;
  author?: string;
  created_utc?: number;
  num_comments?: number;
  score?: number;
  archived?: boolean;
  over_18?: boolean;
};

async function redditApiReady(admin: ReturnType<typeof createClient>): Promise<boolean> {
  const clientId = Deno.env.get("REDDIT_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("REDDIT_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) return false;
  const { data } = await admin.from("reddit_oauth_tokens").select("refresh_token").eq("id", 1).maybeSingle();
  return Boolean(data?.refresh_token);
}

function parseIndexedDate(raw: string | null): number | null {
  if (!raw) return null;
  const relative = raw.match(/(\d+)\s+(minute|hour|day|week|month|year)/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const ms = unit.startsWith("min") ? amount * 60_000
      : unit.startsWith("hour") ? amount * 3_600_000
      : unit.startsWith("day") ? amount * 86_400_000
      : unit.startsWith("week") ? amount * 7 * 86_400_000
      : unit.startsWith("month") ? amount * 30 * 86_400_000
      : amount * 365 * 86_400_000;
    return Date.now() - ms;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function searchIndexedReddit(query: string): Promise<Array<{ title: string; link: string; snippet: string; date: string | null; position: number }>> {
  const key = Deno.env.get("SCALESERP_KEY") ?? "";
  if (key) {
    const url = new URL("https://api.scaleserp.com/search");
    url.searchParams.set("api_key", key);
    url.searchParams.set("q", `site:reddit.com ${query}`);
    url.searchParams.set("num", "10");
    url.searchParams.set("fields", "organic_results");
    url.searchParams.set("gl", "us");
    url.searchParams.set("hl", "en");
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as { organic_results?: Array<Record<string, unknown>> };
      const rows = (data.organic_results ?? []).map((item, index) => ({
        title: String(item.title ?? "").replace(/\s*:\s*r\/\S+.*$/, "").trim(),
        link: String(item.link ?? ""),
        snippet: String(item.snippet ?? ""),
        date: item.date ? String(item.date) : null,
        position: Number(item.position ?? index + 1),
      })).filter((row) => row.link.includes("reddit.com"));
      if (rows.length) return rows;
    }
  }
  const body = new URLSearchParams({ q: `site:reddit.com ${query}`, kl: "us-en" });
  const res = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PinOnItOpportunityFinder/1.0 (+https://pinonit.com)",
    },
    body,
  });
  if (!res.ok) throw new Error(`Public search returned ${res.status}.`);
  return parsePublicSearchResults(await res.text()).map((row) => ({ ...row, date: null }));
}

async function redditToken(admin: ReturnType<typeof createClient>, ua: string): Promise<string> {
  const { data: row } = await admin.from("reddit_oauth_tokens").select("refresh_token, access_token, expires_at").eq("id", 1).maybeSingle();
  if (!row?.refresh_token) {
    throw new Error("Reddit is not connected. Use Connect Reddit on the finder page. Password login is not used.");
  }
  const expires = row.expires_at ? Date.parse(row.expires_at) : 0;
  if (row.access_token && expires - Date.now() > 60_000) return row.access_token;

  const id = Deno.env.get("REDDIT_CLIENT_ID") ?? "";
  const secret = Deno.env.get("REDDIT_CLIENT_SECRET") ?? "";
  if (!id || !secret) throw new Error("REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET are missing.");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || typeof payload.access_token !== "string") {
    throw new Error("Reddit declined the refresh. Connect Reddit again. Password login is not used.");
  }
  await admin.from("reddit_oauth_tokens").update({
    access_token: payload.access_token,
    expires_at: new Date(Date.now() + Number(payload.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return payload.access_token;
}

async function redditGet(token: string, ua: string, path: string): Promise<{ data: unknown; remaining: number | null }> {
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": ua },
  });
  const remainingRaw = res.headers.get("x-ratelimit-remaining");
  const remaining = remainingRaw == null ? null : Number(remainingRaw);
  if (res.status === 429) {
    throw new Error("Reddit rate limit reached. Stop and try again later.");
  }
  if (!res.ok) {
    throw new Error(`Reddit returned ${res.status}. The search was not retried.`);
  }
  return { data: await res.json(), remaining: Number.isFinite(remaining) ? remaining : null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body: { action?: string; scheduled?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body.action === "post") {
    return json({ ok: false, error: "Automatic posting is not enabled." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Server is not configured" }, 500);

  const tokenOnly = authHeader.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("REDDIT_FINDER_CRON_SECRET") ?? "";
  const scheduled = body.scheduled === true && (
    (cronSecret.length > 0 && tokenOnly === cronSecret) || tokenOnly === serviceKey
  );
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = scheduled ? { data: { user: null } } : await userClient.auth.getUser();
  const email = userData.user?.email?.toLowerCase() ?? "";
  if (!scheduled && !STAFF.has(email)) return json({ ok: false, error: "Staff only" }, 403);

  const admin = createClient(supabaseUrl, serviceKey);
  const ua = userAgent();

  try {
    const apiReady = await redditApiReady(admin);
    const token = apiReady ? await redditToken(admin, ua) : "";
    const { data: settingsRow } = await admin.from("reddit_finder_settings").select("*").eq("id", 1).maybeSingle();
    const settings = {
      minGreenScore: settingsRow?.min_green_score ?? 80,
      minKeepScore: settingsRow?.min_keep_score ?? 45,
      maxCommentsPerDay: settingsRow?.max_comments_per_day ?? 3,
      maxMentionsPerDay: settingsRow?.max_mentions_per_day ?? 2,
      maxPerSubredditPerDay: settingsRow?.max_per_subreddit_per_day ?? 1,
      cooldownHours: settingsRow?.cooldown_hours ?? 8,
      allowSubreddits: settingsRow?.allow_subreddits ?? [],
      blockSubreddits: settingsRow?.block_subreddits ?? [],
      allowKeywords: settingsRow?.allow_keywords ?? [],
      blockKeywords: settingsRow?.block_keywords ?? [],
    };
    const since = new Date(Date.now() - settings.cooldownHours * 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin.from("reddit_opportunities").select("subreddit, mention, feature, created_at").gte("created_at", since);
    const mentionsToday = (recent ?? []).filter((row) => row.mention === "yes").length;
    const { data: cursorRow } = await admin.from("reddit_finder_cursor").select("next_query_index").eq("id", 1).maybeSingle();
    const start = Number(cursorRow?.next_query_index ?? 0) % FINDER_QUERIES.length;
    const chosen = Array.from({ length: QUERIES_PER_RUN }, (_, i) => FINDER_QUERIES[(start + i) % FINDER_QUERIES.length]);
    const nextIndex = (start + QUERIES_PER_RUN) % FINDER_QUERIES.length;

    const found: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    const rulesBySub = new Map<string, string>();
    let ruleFetches = 0;
    let remaining: number | null = null;

    if (!apiReady) {
      for (const query of chosen) {
        await sleep(400);
        const results = await searchIndexedReddit(query.q);
        for (const result of results) {
          const thread = redditThreadFromUrl(result.link);
          if (!thread || !result.title || seen.has(thread.fullname)) continue;
          seen.add(thread.fullname);
          const dated = parseIndexedDate(result.date);
          const createdUtc = dated != null
            ? Math.floor(dated / 1000)
            : Math.floor((Date.now() - 5 * 24 * 60 * 60 * 1000) / 1000);
          const scored = scoreOpportunity({
            title: result.title,
            body: result.snippet,
            createdUtc,
            numComments: 0,
            archived: false,
            query,
            rulesText: "",
            searchRank: result.position,
            dateUnknown: dated == null,
          });
          const ageDays = dated == null ? null : Math.max(0, (Date.now() - dated) / 86_400_000);
          const subredditToday = (recent ?? []).filter((row) => row.subreddit === thread.subreddit).length
            + found.filter((row) => row.subreddit === thread.subreddit).length;
          const duplicate = (recent ?? []).some((row) => row.subreddit === thread.subreddit && row.feature === query.feature);
          const band = classifyOpportunity({
            score: scored.score,
            mention: scored.mention,
            rulesBan: false,
            text: `${result.title}\n${result.snippet}`,
            subreddit: thread.subreddit,
            settings,
            duplicate,
            mentionsToday: mentionsToday + found.filter((row) => row.mention === "yes").length,
            subredditToday,
          });
          const kinds = opportunityKinds({
            seoQuery: query.seo,
            searchRank: result.position,
            ageDays,
            mention: scored.mention,
            band: band.band,
            intent: query.intent,
          });
          const status = band.band === "red" ? "skip" : band.band === "green" ? "approved" : "review";
          found.push({
            band: band.band,
            band_reason: band.reason,
            status,
            reddit_fullname: thread.fullname,
            title: result.title.slice(0, 300),
            subreddit: thread.subreddit,
            permalink: thread.permalink,
            author: null,
            posted_at: dated ? new Date(dated).toISOString() : null,
            snippet: result.snippet.replace(/\s+/g, " ").trim().slice(0, 500),
            search_query: query.q,
            industry: query.industry,
            feature: query.feature,
            problem: scored.problem,
            why_relevant: scored.whyRelevant,
            score: scored.score,
            mention: scored.mention,
            mention_reason: scored.mentionReason,
            suggested_response: scored.suggestedResponse,
            high_seo_value: kinds.seo || scored.highSeoValue,
            rules_note: "Subreddit rules were not loaded. Read the sidebar before you post.",
            num_comments: 0,
            reddit_score: 0,
            last_seen_at: new Date().toISOString(),
            customer_opportunity: kinds.customer,
            seo_opportunity: kinds.seo,
            discovery_mode: "fallback",
            search_rank: result.position,
          });
        }
      }
    }

    for (const query of chosen) {
      if (!apiReady) break;
      if (remaining != null && remaining < 2) break;
      await sleep(1100);
      const search = await redditGet(
        token,
        ua,
        `/search?q=${encodeURIComponent(query.q)}&sort=new&t=month&type=link&limit=${POSTS_PER_QUERY}`,
      );
      remaining = search.remaining;
      const children = (search.data as { data?: { children?: Array<{ data?: RedditPost }> } }).data?.children ?? [];
      for (const child of children) {
        const post = child.data;
        if (!post?.name || !post.title || !post.permalink || !post.subreddit || post.over_18) continue;
        if (seen.has(post.name)) continue;
        seen.add(post.name);

        let rulesText = rulesBySub.get(post.subreddit) ?? "";
        if (!rulesBySub.has(post.subreddit)) {
          const { data: cached } = await admin.from("reddit_subreddit_rules").select("rules_text, checked_at").eq("subreddit", post.subreddit).maybeSingle();
          const fresh = cached?.checked_at && Date.now() - Date.parse(cached.checked_at) < 7 * 24 * 60 * 60 * 1000;
          if (fresh) {
            rulesText = cached?.rules_text ?? "";
          } else if (ruleFetches < 5 && (remaining == null || remaining >= 2)) {
            ruleFetches += 1;
            await sleep(1100);
            try {
              const rulesRes = await redditGet(token, ua, `/r/${encodeURIComponent(post.subreddit)}/about/rules`);
              remaining = rulesRes.remaining;
              const rules = (rulesRes.data as { rules?: Array<{ short_name?: string; description?: string }> }).rules ?? [];
              rulesText = rules.map((rule) => `${rule.short_name ?? ""} ${rule.description ?? ""}`).join("\n").slice(0, 4000);
              await admin.from("reddit_subreddit_rules").upsert({
                subreddit: post.subreddit,
                rules_text: rulesText,
                checked_at: new Date().toISOString(),
              });
            } catch {
              rulesText = cached?.rules_text ?? "";
            }
          } else {
            rulesText = cached?.rules_text ?? "";
          }
          rulesBySub.set(post.subreddit, rulesText);
        }

        const bodyText = (post.selftext ?? "").slice(0, 2000);
        const scored = scoreOpportunity({
          title: post.title,
          body: bodyText,
          createdUtc: post.created_utc ?? Math.floor(Date.now() / 1000),
          numComments: post.num_comments ?? 0,
          archived: Boolean(post.archived),
          query,
          rulesText,
        });
        const subredditToday = (recent ?? []).filter((row) => row.subreddit === post.subreddit).length
          + found.filter((row) => row.subreddit === post.subreddit).length;
        const duplicate = (recent ?? []).some((row) => row.subreddit === post.subreddit && row.feature === query.feature);
        const rulesBan = /no self-?promo|no advertising|no solicitation/i.test(rulesText);
        const band = classifyOpportunity({
          score: scored.score,
          mention: scored.mention,
          rulesBan,
          text: `${post.title}\n${bodyText}`,
          subreddit: post.subreddit,
          settings,
          duplicate,
          mentionsToday: mentionsToday + found.filter((row) => row.mention === "yes").length,
          subredditToday,
        });
        const status = band.band === "red" ? "skip" : band.band === "green" ? "approved" : "review";
        found.push({
          band: band.band,
          band_reason: band.reason,
          status,
          reddit_fullname: post.name,
          title: post.title.slice(0, 300),
          subreddit: post.subreddit,
          permalink: post.permalink,
          author: post.author ?? null,
          posted_at: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
          snippet: (post.selftext ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
          search_query: query.q,
          industry: query.industry,
          feature: query.feature,
          problem: scored.problem,
          why_relevant: scored.whyRelevant,
          score: scored.score,
          mention: scored.mention,
          mention_reason: scored.mentionReason,
          suggested_response: scored.suggestedResponse,
          high_seo_value: scored.highSeoValue,
          rules_note: scored.rulesNote,
          num_comments: post.num_comments ?? 0,
          reddit_score: post.score ?? 0,
          last_seen_at: new Date().toISOString(),
          customer_opportunity: band.band !== "red" && scored.mention !== "no",
          seo_opportunity: scored.highSeoValue,
          discovery_mode: "api",
          search_rank: null,
        });
      }
    }

    const names = found.map((row) => String(row.reddit_fullname));
    const { data: existing } = names.length
      ? await admin.from("reddit_opportunities").select("reddit_fullname, status").in("reddit_fullname", names)
      : { data: [] };
    const statusByName = new Map((existing ?? []).map((row) => [row.reddit_fullname as string, row.status as string]));

    const inserts = found.filter((row) => !statusByName.has(String(row.reddit_fullname)));
    const refresh = found.filter((row) => statusByName.get(String(row.reddit_fullname)) === "new");
    if (inserts.length) {
      const { error } = await admin.from("reddit_opportunities").insert(inserts);
      if (error) throw new Error(error.message);
    }
    for (const row of refresh) {
      await admin.from("reddit_opportunities").update(row).eq("reddit_fullname", row.reddit_fullname).eq("status", "new");
    }
    for (const row of found) {
      if (statusByName.has(String(row.reddit_fullname)) && statusByName.get(String(row.reddit_fullname)) !== "new") {
        await admin.from("reddit_opportunities").update({
          last_seen_at: row.last_seen_at,
          num_comments: row.num_comments,
          reddit_score: row.reddit_score,
        }).eq("reddit_fullname", row.reddit_fullname);
      }
    }

    const worthwhile = inserts.filter((row) => row.band === "green" || row.customer_opportunity || row.seo_opportunity);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    if (scheduled && worthwhile.length && settingsRow?.last_digest_on !== today) {
      const greens = worthwhile.filter((row) => row.band === "green").length;
      const customers = worthwhile.filter((row) => row.customer_opportunity).length;
      const seo = worthwhile.filter((row) => row.seo_opportunity).length;
      const message = `PinOnIt found ${worthwhile.length} good Reddit opportunities today.\n${customers} are high-intent customer opportunities.\n${seo} also have high AI/SEO value.\n\nNext one: https://pinonit.com/dashboard/reddit-opportunities`;
      await admin.from("reddit_alerts").insert({
        kind: greens ? "green_ready" : "yellow_review",
        message,
      });
      await mailStaff("PinOnIt found Reddit opportunities", message);
      await admin.from("reddit_finder_settings").update({ last_digest_on: today }).eq("id", 1);
    }
    if (settingsRow?.auto_post_enabled) {
      await admin.from("reddit_alerts").insert({
        kind: "posting_blocked",
        message: "Auto-post is switched on, but Reddit does not allow this app to post commercial comments. Nothing was posted.",
      });
    }

    await admin.from("reddit_finder_cursor").upsert({ id: 1, next_query_index: nextIndex });
    await admin.from("reddit_search_runs").insert({
      started_by: userData.user?.id ?? null,
      queries_run: chosen.length,
      threads_found: found.length,
      threads_saved: inserts.length,
    });

    return json({
      ok: true,
      posting: false,
      discovery: apiReady ? "api" : "fallback",
      queries: chosen.map((query) => query.q),
      found: found.length,
      saved: inserts.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    await admin.from("reddit_alerts").insert({ kind: "automation_error", message: message.slice(0, 500) });
    await admin.from("reddit_search_runs").insert({
      started_by: userData.user?.id ?? null,
      error: message.slice(0, 500),
    });
    return json({ ok: false, error: message }, 502);
  }
});
