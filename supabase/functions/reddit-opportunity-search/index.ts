import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { FINDER_QUERIES, scoreOpportunity } from "../../../src/lib/redditFinder.ts";

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
  const username = (Deno.env.get("REDDIT_USERNAME") ?? "").replace(/^\/?u\//, "").trim();
  const who = username ? `by /u/${username}` : "contact support@pinonit.com";
  return `web:pinonit-opportunity-finder:1.0 (${who})`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function redditToken(ua: string): Promise<string> {
  const id = Deno.env.get("REDDIT_CLIENT_ID") ?? "";
  const secret = Deno.env.get("REDDIT_CLIENT_SECRET") ?? "";
  if (!id || !secret) {
    throw new Error(
      "Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Supabase. Create a web app at reddit.com/prefs/apps. Do not send a Reddit password.",
    );
  }
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || typeof payload.access_token !== "string") {
    throw new Error("Reddit declined the app token. Check the client id and secret. Password login is not used.");
  }
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

  let body: { action?: string } = {};
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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const email = userData.user?.email?.toLowerCase() ?? "";
  if (!STAFF.has(email)) return json({ ok: false, error: "Staff only" }, 403);

  const admin = createClient(supabaseUrl, serviceKey);
  const ua = userAgent();

  try {
    const token = await redditToken(ua);
    const { data: cursorRow } = await admin.from("reddit_finder_cursor").select("next_query_index").eq("id", 1).maybeSingle();
    const start = Number(cursorRow?.next_query_index ?? 0) % FINDER_QUERIES.length;
    const chosen = Array.from({ length: QUERIES_PER_RUN }, (_, i) => FINDER_QUERIES[(start + i) % FINDER_QUERIES.length]);
    const nextIndex = (start + QUERIES_PER_RUN) % FINDER_QUERIES.length;

    const found: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    const rulesBySub = new Map<string, string>();
    let ruleFetches = 0;
    let remaining: number | null = null;

    for (const query of chosen) {
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

        const scored = scoreOpportunity({
          title: post.title,
          body: (post.selftext ?? "").slice(0, 2000),
          createdUtc: post.created_utc ?? Math.floor(Date.now() / 1000),
          numComments: post.num_comments ?? 0,
          archived: Boolean(post.archived),
          query,
          rulesText,
        });
        found.push({
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
      queries: chosen.map((query) => query.q),
      found: found.length,
      saved: inserts.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    await admin.from("reddit_search_runs").insert({
      started_by: userData.user?.id ?? null,
      error: message.slice(0, 500),
    });
    return json({ ok: false, error: message }, 502);
  }
});
