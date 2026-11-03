import { parse, type HTMLElement } from "node-html-parser";

// Whether a page found by a search really mentions a term in the article
// itself. Search engines match the whole page — a coffeeshop named in a
// "Lees ook" teaser under an unrelated article counts for them, not for us.

const USER_AGENT = "Mozilla/5.0 (compatible; agdb-review-dashboard/1.0; mention check)";
const FETCH_TIMEOUT_MS = 15_000;

// Blocks around an article that aren't part of it.
const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "nav",
  "aside",
  "footer",
  "header",
  "form",
  "iframe",
  // The headline is shown as the title already; leaving it in would glue
  // it to the opening sentence ("Beste zaden 2026Dit jaar…").
  "h1",
];
const NOISE_NAME =
  /related|gerelateerd|lees-?ook|lees-?meer|read-?more|more-?news|meer-?nieuws|recommend|aanbevolen|teaser|sidebar|popular|populair|trending|most-?read|meest-?gelezen|newsletter|nieuwsbrief|share|social|comment|reactie|footer|menu|navigation|breadcrumb|advert|promo/i;

export interface ArticleText {
  /** The article's own text, without menus, footers or related links. */
  body: string;
  /** Its first sentence, for the "first line" column. */
  lead: string;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The structured-data article text many news sites publish for search
 * engines (schema.org NewsArticle.articleBody) — the most reliable source. */
function jsonLdBody(root: HTMLElement): string {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.rawText) as unknown;
      const nodes = (Array.isArray(data) ? data : [data]).flatMap((n) =>
        n && typeof n === "object" && "@graph" in n ? (n as { "@graph": unknown[] })["@graph"] : [n],
      );
      for (const node of nodes) {
        const body = (node as { articleBody?: unknown })?.articleBody;
        if (typeof body === "string" && body.trim().length > 80) return clean(body);
      }
    } catch {
      // Malformed JSON-LD: try the next one.
    }
  }
  return "";
}

/** The article's text, or null when no article text can be found. */
export function extractArticle(html: string): ArticleText | null {
  const root = parse(html);
  let body = jsonLdBody(root);

  if (!body) {
    for (const el of root.querySelectorAll(NOISE_SELECTORS.join(","))) el.remove();
    for (const el of root.querySelectorAll("[class], [id]")) {
      const name = `${el.getAttribute("class") ?? ""} ${el.getAttribute("id") ?? ""}`;
      if (NOISE_NAME.test(name)) el.remove();
    }
    const candidates = [
      ...root.querySelectorAll('[itemprop="articleBody"]'),
      ...root.querySelectorAll("article"),
      ...root.querySelectorAll("main"),
    ];
    // The longest candidate is the article; a page can hold several
    // <article> elements (teasers) besides the real one.
    const best = candidates
      // structuredText keeps block elements apart (paragraphs, headings).
      .map((el) => clean(el.structuredText))
      .sort((a, b) => b.length - a.length)[0];
    body = best ?? "";
  }

  if (body.length < 80) return null;
  const lead = body.match(/^.{20,}?[.!?](\s|$)/)?.[0]?.trim() ?? body.slice(0, 200);
  return { body, lead: lead.length > 240 ? `${lead.slice(0, 237).trimEnd()}…` : lead };
}

export function mentionsTerm(text: string, term: string, matchCase: boolean): boolean {
  return matchCase ? text.includes(term) : text.toLowerCase().includes(term.toLowerCase());
}

export async function fetchArticle(url: string): Promise<ArticleText | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return extractArticle(await res.text());
}

// ---- Google News links ----
// Google News RSS links (news.google.com/rss/articles/<id>) don't redirect
// to the article; the real URL comes from Google's own lookup endpoint,
// which needs a signature and timestamp from the article's Google page.
// Best effort: any failure just means the article can't be checked.

export async function resolveGoogleNewsUrl(url: string): Promise<string | null> {
  const id = url.match(/news\.google\.com\/(?:rss\/)?articles\/([^?/]+)/)?.[1];
  if (!id) return url;
  const page = await fetch(`https://news.google.com/rss/articles/${id}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).then((r) => r.text());
  const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) return null;
  const req = [
    "Fbv4je",
    `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`,
  ];
  const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: `f.req=${encodeURIComponent(JSON.stringify([[req]]))}`,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).then((r) => r.text());
  try {
    const payload = JSON.parse(res.split("\n\n")[1]) as unknown[][];
    const decoded = JSON.parse(payload[0][2] as string) as unknown[];
    return typeof decoded[1] === "string" ? decoded[1] : null;
  } catch {
    return null;
  }
}
