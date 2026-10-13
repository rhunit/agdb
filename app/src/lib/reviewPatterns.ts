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
// real review text, nothing is inferred or fabricated. Themes with
// overlapping keywords are intentional (e.g. "personeel" can also flag a
// quality remark) — a review can count toward more than one theme.
const THEMES: ThemeDefinition[] = [
  {
    label: "Te duur / prijs",
    keywords: [
      "duur",
      "prijzig",
      "prijzen",
      "te veel geld",
      "overpriced",
      "expensive",
      "pricey",
    ],
  },
  {
    label: "Hygiëne / netheid",
    keywords: [
      "vies",
      "smerig",
      "rommelig",
      "niet schoon",
      "vuil",
      "dirty",
      "unclean",
      "messy",
    ],
  },
  {
    label: "Personeel / service",
    keywords: [
      "onvriendelijk",
      "chagrijnig",
      "respectloos",
      "lomp",
      "onbeleefd",
      "slechte service",
      "geen hulp",
      "rude",
      "unfriendly",
      "unhelpful",
    ],
  },
  {
    label: "Wachttijd / drukte",
    keywords: [
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
    label: "Productkwaliteit",
    keywords: [
      "slechte kwaliteit",
      "matige kwaliteit",
      "schimmel",
      "oud spul",
      "niet vers",
      "poor quality",
      "moldy",
      "stale",
    ],
  },
  {
    label: "Aanbod / voorraad",
    keywords: [
      "uitverkocht",
      "geen voorraad",
      "beperkt aanbod",
      "weinig keuze",
      "out of stock",
      "sold out",
      "limited selection",
    ],
  },
  {
    label: "Gewicht / hoeveelheid",
    keywords: [
      "te weinig",
      "ondergewicht",
      "weegschaal",
      "afgewogen",
      "short-weighed",
      "under weight",
      "scale",
    ],
  },
];

const MIN_COUNT = 2;
const MAX_THEMES = 6;

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
