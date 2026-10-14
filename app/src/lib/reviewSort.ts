import type { Review } from "../types";

export type SortOption = "recent" | "oldest" | "positive" | "negative" | "recent-replies";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Meest recent" },
  { value: "oldest", label: "Oudst eerst" },
  { value: "positive", label: "Positief eerst" },
  { value: "negative", label: "Negatief eerst" },
  { value: "recent-replies", label: "Recent beantwoord" },
];

/** Sorts a review list without mutating it. "Recent beantwoord" sinks
 * never-answered reviews to the bottom rather than mixing them in at a
 * fake position — there's no reply time to sort them by. */
export function sortReviews(reviews: Review[], sortBy: SortOption): Review[] {
  const sorted = [...reviews];
  switch (sortBy) {
    case "recent":
      return sorted.sort((a, b) => a.daysAgo - b.daysAgo);
    case "oldest":
      return sorted.sort((a, b) => b.daysAgo - a.daysAgo);
    case "positive":
      return sorted.sort((a, b) => b.rating - a.rating || a.daysAgo - b.daysAgo);
    case "negative":
      return sorted.sort((a, b) => a.rating - b.rating || a.daysAgo - b.daysAgo);
    case "recent-replies":
      return sorted.sort((a, b) => {
        const at = a.responseTime ? new Date(a.responseTime).getTime() : -Infinity;
        const bt = b.responseTime ? new Date(b.responseTime).getTime() : -Infinity;
        return bt - at;
      });
  }
}
