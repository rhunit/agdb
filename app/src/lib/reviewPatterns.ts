import type { Review } from "../types";

export interface ReviewPattern {
  label: string;
  count: number;
}

interface ThemeDefinition {
  label: string;
  keywords: string[];
}

// Keyword-matched, not AI-generated: each theme is a curated set of Dutch
// (and common English) words that tend to show up in that kind of
// complaint. This is a cheap, instant, fully-explainable heuristic — it
// can miss phrasing it doesn't recognize and can occasionally mismatch a
// word used in another sense, but every match traces directly back to
// real review text, nothing is inferred or fabricated.
//
// Grouped into exactly these three buckets per request — matching the
// categories used in the manually-written location reports (see the
// uploaded "Sloterdijk 28/08 t/m 28/09" PDF): staff/atmosphere
// complaints under Klantvriendelijkheid, anything about the goods
// themselves under Producten, and pricing/extra-costs/policy complaints
// under Huisregels / voorwaarden.
const THEMES: ThemeDefinition[] = [
  {
    label: "Klantvriendelijkheid",
    keywords: [
      "onvriendelijk",
      "chagrijnig",
      "respectloos",
      "lomp",
      "onbeleefd",
      "arrogant",
      "slechte service",
      "geen hulp",
      "rude",
      "unfriendly",
      "unhelpful",
      "wachttijd",
      "lang wachten",
      "te druk",
      "lange rij",
      "wachtrij",
      "queue",
      "crowded",
      "busy",
    ],
  },
  {
    label: "Producten",
    keywords: [
      "slechte kwaliteit",
      "matige kwaliteit",
      "schimmel",
      "oud spul",
      "niet vers",
      "poor quality",
      "moldy",
      "stale",
      "uitverkocht",
      "geen voorraad",
      "beperkt aanbod",
      "weinig keuze",
      "out of stock",
      "sold out",
      "limited selection",
      "te weinig",
      "ondergewicht",
      "weegschaal",
      "afgewogen",
      "short-weighed",
      "under weight",
      "scale",
      // "vies/dirty" in a coffeeshop review almost always describes the
      // product itself ("burns dirty", "vieze smaak", "smerig spul"), not
      // the shop — moved here after exactly that kind of review got
      // mis-filed under Klantvriendelijkheid.
      "vies",
      "smerig",
      "vuil",
      "dirty",
      "unclean",
      "niet schoon",
    ],
  },
  {
    label: "Huisregels / voorwaarden",
    keywords: [
      "duur",
      "prijzig",
      "prijzen",
      "te veel geld",
      "overpriced",
      "expensive",
      "pricey",
      "voorwaarden",
      "huisregels",
      "niet gratis",
      "extra kosten",
      "verplicht",
    ],
  },
];

const MIN_COUNT = 2;
const MAX_THEMES = 3;

function isCritical(review: Review): boolean {
  return review.rating <= 3 && review.snippet.trim().length > 0;
}

/** Whether a single review matches the given theme's keywords — same
 * rule detectReviewPatterns uses to count matches, exposed so a theme
 * chip can filter the review list down to exactly the reviews it was
 * counted from. */
export function reviewMatchesTheme(review: Review, themeLabel: string): boolean {
  const theme = THEMES.find((t) => t.label === themeLabel);
  if (!theme || !isCritical(review)) return false;
  const text = review.snippet.toLowerCase();
  return theme.keywords.some((kw) => text.includes(kw));
}

/** Surfaces recurring complaint themes across 1-3★ reviews by matching
 * each review's text against a small set of curated keyword groups (see
 * THEMES above) — not a model call, so it's free and instant, but it
 * only catches phrasing it knows to look for. Themes mentioned fewer
 * than MIN_COUNT times are dropped as noise (one offhand remark isn't a
 * pattern), and the result is capped and sorted by how often each theme
 * comes up, most frequent first. */
export function detectReviewPatterns(reviews: Review[]): ReviewPattern[] {
  const critical = reviews.filter(isCritical);

  const patterns = THEMES.map((theme): ReviewPattern => {
    const count = critical.filter((r) => {
      const text = r.snippet.toLowerCase();
      return theme.keywords.some((kw) => text.includes(kw));
    }).length;
    return { label: theme.label, count };
  });

  return patterns
    .filter((p) => p.count >= MIN_COUNT)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_THEMES);
}
