import { fetchArticle, mentionsTerm, resolveGoogleNewsUrl } from "./articleCheck.js";
import {
  addMentions,
  addRejected,
  pageState,
  loadTerms,
  mentionId,
  type Mention,
  type MentionSource,
  type MentionTerm,
} from "./mentionsStore.js";

// Fetches new mentions of the tracked terms from each source. Every source
// is searched for the exact phrase (in quotes); what comes back is then
// filtered on the term's exclude words and, if set, its capitalisation.

type Found = Omit<Mention, "id" | "foundAt" | "hidden" | "hiddenBy"> & {
  /** Everything the source returned as text, for matching only — a term
   * can sit past the first line that gets stored. Not saved. */
  matchText: string;
};

const USER_AGENT = "web:agdb-review-dashboard:1.0 (mention tracking)";
const REQUEST_TIMEOUT_MS = 20_000;

// ---- Small XML/HTML helpers (RSS and Atom feeds; no parser dependency) ----

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Feed text → plain text: CDATA unwrapped, entities decoded, tags removed. */
function plainText(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Entities first: feeds often carry HTML as escaped text (&lt;b&gt;).
  return decodeEntities(decodeEntities(unwrapped).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function blocks(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, "g"))].map((m) => m[0]);
}

function tagText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? plainText(m[1]) : "";
}

/** The first sentence-ish line of a text, kept short for the list. */
export function firstLine(text: string, title = ""): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || clean === title.trim()) return "";
  const sentence = clean.match(/^.{20,}?[.!?](\s|$)/)?.[0] ?? clean;
  return sentence.length > 240 ? `${sentence.slice(0, 237).trimEnd()}…` : sentence.trim();
}

async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

// ---- Matching ----

/** Whether a found item really belongs to the term: none of its exclude
 * words, and the exact capitalisation if the term asks for it. */
export function acceptsHit(term: MentionTerm, title: string, body: string): boolean {
  const text = `${title} ${body}`;
  const lower = text.toLowerCase();
  if (term.exclude.some((w) => lower.includes(w.toLowerCase()))) return false;
  if (term.matchCase && !text.includes(term.term)) return false;
  return true;
}

// ---- Reddit ----
// The official API when REDDIT_CLIENT_ID/SECRET are set (Reddit now only
// hands those out after a request is approved); otherwise Reddit's own
// public RSS feed of the same search, which needs no keys.

let redditToken: { token: string; expiresAt: number } | null = null;

export function isRedditConfigured(): boolean {
  return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

async function redditAccessToken(): Promise<string> {
  if (redditToken && redditToken.expiresAt > Date.now() + 60_000) return redditToken.token;
  const basic = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`,
  ).toString("base64");
  const body = await fetchText("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = JSON.parse(body) as { access_token?: string; expires_in?: number; error?: string };
  if (!data.access_token) throw new Error(`Reddit weigert de sleutels (${data.error ?? "geen token"})`);
  redditToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return redditToken.token;
}

interface RedditPost {
  title: string;
  selftext?: string;
  permalink: string;
  created_utc: number;
  subreddit_name_prefixed: string;
}

export async function searchReddit(term: MentionTerm): Promise<Found[]> {
  const token = await redditAccessToken();
  const url = new URL("https://oauth.reddit.com/search");
  url.searchParams.set("q", `"${term.term}"`);
  url.searchParams.set("sort", "new");
  url.searchParams.set("t", "year");
  url.searchParams.set("limit", "50");
  url.searchParams.set("type", "link");
  const body = await fetchText(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = JSON.parse(body) as { data?: { children?: { data: RedditPost }[] } };
  return (data.data?.children ?? []).map(({ data: p }) => ({
    url: `https://www.reddit.com${p.permalink}`,
    source: "reddit" as MentionSource,
    sourceName: p.subreddit_name_prefixed,
    title: p.title,
    firstLine: firstLine(p.selftext ?? "", p.title),
    matchText: p.selftext ?? "",
    publishedAt: new Date(p.created_utc * 1000).toISOString(),
    terms: [term.term],
  }));
}

/** Reddit's search feed is Atom: one <entry> per post, the subreddit as
 * <category label="r/…">, the post text as HTML in <content> followed by
 * "submitted by /u/… [link] [comments]". */
export function parseRedditRss(xml: string, term: string): Found[] {
  return blocks(xml, "entry").map((entry) => {
    const url = decodeEntities(entry.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "");
    const label = decodeEntities(entry.match(/<category[^>]*label="([^"]+)"/)?.[1] ?? "");
    const title = tagText(entry, "title");
    const text = tagText(entry, "content").split(/\bsubmitted by\b/)[0].trim();
    const published = tagText(entry, "published") || tagText(entry, "updated");
    return {
      url,
      source: "reddit" as MentionSource,
      sourceName: label || "Reddit",
      title,
      firstLine: firstLine(text, title),
      matchText: text,
      publishedAt: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null,
      terms: [term],
    };
  }).filter((f) => f.url);
}

// Gentle on Reddit: one feed request at a time, a short pause in between.
const REDDIT_RSS_PAUSE_MS = 2_000;

export async function searchRedditRss(term: MentionTerm): Promise<Found[]> {
  const url = new URL("https://www.reddit.com/search.rss");
  url.searchParams.set("q", `"${term.term}"`);
  url.searchParams.set("sort", "new");
  url.searchParams.set("t", "year");
  url.searchParams.set("limit", "50");
  const found = parseRedditRss(await fetchText(url.toString()), term.term);
  await new Promise((resolve) => setTimeout(resolve, REDDIT_RSS_PAUSE_MS));
  return found;
}

// ---- Google News (public RSS search) ----

export function parseGoogleNews(xml: string, term: string): Found[] {
  return blocks(xml, "item").map((item) => {
    const source = tagText(item, "source");
    let title = tagText(item, "title");
    // Google News titles end in " - Publisher"; the publisher has its own column.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3);
    const pubDate = tagText(item, "pubDate");
    const description = tagText(item, "description");
    return {
      url: tagText(item, "link"),
      source: "news" as MentionSource,
      sourceName: source || "Google Nieuws",
      title,
      // The description only repeats title and publisher; nothing to add.
      firstLine: firstLine(description.replace(source, ""), title),
      matchText: description,
      publishedAt: pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : null,
      terms: [term],
    };
  }).filter((f) => f.url);
}

export async function searchGoogleNews(term: MentionTerm): Promise<Found[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `"${term.term}"`);
  url.searchParams.set("hl", "nl");
  url.searchParams.set("gl", "NL");
  url.searchParams.set("ceid", "NL:nl");
  return parseGoogleNews(await fetchText(url.toString()), term.term);
}

// ---- Google Alerts (the term's own Atom feed) ----

/** Alerts links go through google.com/url?…&url=<real page>; keep the real one. */
function unwrapGoogleRedirect(href: string): string {
  try {
    const u = new URL(href);
    if (u.hostname.startsWith("www.google.") && u.pathname === "/url") {
      return u.searchParams.get("url") ?? u.searchParams.get("q") ?? href;
    }
  } catch {
    // Not a URL; keep as is.
  }
  return href;
}

export function parseGoogleAlerts(xml: string, term: string): Found[] {
  return blocks(xml, "entry").map((entry) => {
    const href = decodeEntities(entry.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "");
    const url = unwrapGoogleRedirect(href);
    let host = "";
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      // Leave empty.
    }
    const title = tagText(entry, "title");
    const content = tagText(entry, "content");
    const published = tagText(entry, "published") || tagText(entry, "updated");
    return {
      url,
      source: "alerts" as MentionSource,
      sourceName: host || "Web",
      title,
      firstLine: firstLine(content, title),
      matchText: content,
      publishedAt: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null,
      terms: [term],
    };
  }).filter((f) => f.url);
}

export async function searchGoogleAlerts(term: MentionTerm): Promise<Found[]> {
  if (!term.alertsFeedUrl) return [];
  return parseGoogleAlerts(await fetchText(term.alertsFeedUrl), term.term);
}

// ---- Running a check ----

export interface SourceStatus {
  configured: boolean;
  lastRunAt: string | null;
  lastError: string | null;
}

const status: Record<MentionSource, SourceStatus> = {
  reddit: { configured: true, lastRunAt: null, lastError: null },
  news: { configured: true, lastRunAt: null, lastError: null },
  alerts: { configured: false, lastRunAt: null, lastError: null },
};
let lastCheckAt: string | null = null;
let running: Promise<number> | null = null;

export function mentionStatus() {
  const terms = loadTerms();
  // Always on: the API with keys, the public feed without.
  status.reddit.configured = true;
  status.alerts.configured = terms.some((t) => t.alertsFeedUrl);
  return { sources: status, lastCheckAt, checking: running !== null };
}

async function runSource(
  source: MentionSource,
  terms: MentionTerm[],
  search: (t: MentionTerm) => Promise<Found[]>,
  out: Found[],
) {
  const errors: string[] = [];
  for (const term of terms) {
    try {
      const hits = await search(term);
      out.push(...hits.filter((h) => acceptsHit(term, h.title, h.matchText)));
    } catch (err) {
      errors.push(`${term.term}: ${(err as Error).message}`);
    }
  }
  status[source].lastRunAt = new Date().toISOString();
  status[source].lastError = errors.length > 0 ? errors.join("; ") : null;
  if (errors.length > 0) console.error(`mentions: ${source} errors — ${errors.join("; ")}`);
}

/** Searches every source for every term and stores what's new. Returns how
 * many new mentions were found. A check already running is shared, not
 * started twice. */
export function checkMentions(): Promise<number> {
  if (running) return running;
  running = (async () => {
    const terms = loadTerms();
    const found: Found[] = [];
    await runSource("reddit", terms, isRedditConfigured() ? searchReddit : searchRedditRss, found);
    await runSource("news", terms, searchGoogleNews, found);
    const withFeeds = terms.filter((t) => t.alertsFeedUrl);
    if (withFeeds.length > 0) await runSource("alerts", withFeeds, searchGoogleAlerts, found);
    const added = addMentions(await verifyArticles(found, terms));
    lastCheckAt = new Date().toISOString();
    if (added > 0) console.log(`mentions: ${added} new mention(s)`);
    return added;
  })().finally(() => {
    running = null;
  });
  return running;
}

// Fetching and checking articles takes a moment each; anything beyond this
// per run is simply picked up by the next run.
const MAX_ARTICLE_CHECKS_PER_RUN = 30;

type Checked = Omit<Found, "matchText"> & { idUrl?: string };

/** Search engines match a term anywhere on a page, including "Lees ook"
 * teasers for other articles. For new news and web hits, fetch the page
 * and keep only the terms its own article text mentions. A page that
 * can't be fetched or read is kept only for terms in its title. Rejected
 * pages are remembered and not checked again. */
async function verifyArticles(found: Found[], terms: MentionTerm[]): Promise<Checked[]> {
  const termByName = new Map(terms.map((t) => [t.term, t]));
  // One check per page, for all the terms it came up for.
  const byUrl = new Map<string, Found>();
  for (const f of found) {
    const existing = byUrl.get(f.url);
    if (existing) existing.terms = [...new Set([...existing.terms, ...f.terms])];
    else byUrl.set(f.url, { ...f, terms: [...f.terms] });
  }

  const out: Checked[] = [];
  const rejected: string[] = [];
  let checks = 0;
  for (const f of byUrl.values()) {
    const { matchText: _, ...mention } = f;
    const state = pageState(mentionId(f.url));
    if (state === "rejected") continue;
    if (f.source === "reddit" || state === "known") {
      // Reddit hits are the post itself; known pages only gain terms.
      out.push(mention);
      continue;
    }
    const id = mentionId(f.url);
    if (checks >= MAX_ARTICLE_CHECKS_PER_RUN) continue;
    checks++;

    let realUrl: string | null = f.url;
    let article = null;
    try {
      if (f.source === "news") realUrl = await resolveGoogleNewsUrl(f.url);
      if (realUrl) article = await fetchArticle(realUrl);
    } catch {
      article = null;
    }
    const inText = (text: string) =>
      f.terms.filter((t) => {
        const term = termByName.get(t);
        return term ? mentionsTerm(text, term.term, term.matchCase) : false;
      });
    const kept = article ? inText(article.body) : inText(f.title);
    if (kept.length === 0) {
      rejected.push(id);
      continue;
    }
    out.push({
      ...mention,
      url: realUrl ?? f.url,
      idUrl: f.url,
      terms: kept,
      // The article's own opening beats a feed's snippet ("eerste regel
      // van de bron"); the snippet is the fallback when it couldn't be read.
      firstLine: article?.lead || mention.firstLine,
    });
  }
  addRejected(rejected);
  if (rejected.length > 0) {
    console.log(`mentions: ${rejected.length} page(s) skipped — term not in the article itself`);
  }
  return out;
}

/** Checks every 30 minutes, the first time shortly after startup. */
export function scheduleMentionChecks(): void {
  const run = () => void checkMentions().catch((err) => console.error("mentions check failed:", err));
  setTimeout(run, 60_000);
  setInterval(run, 30 * 60_000);
}
