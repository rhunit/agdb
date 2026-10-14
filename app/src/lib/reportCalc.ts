import type { Review } from "../types";

export type StarCounts = Record<1 | 2 | 3 | 4 | 5, number>;

export function starCounts(reviews: Review[]): StarCounts {
  const counts: StarCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) counts[r.rating]++;
  return counts;
}

export function sumStarCounts(a: StarCounts, b: StarCounts): StarCounts {
  return { 1: a[1] + b[1], 2: a[2] + b[2], 3: a[3] + b[3], 4: a[4] + b[4], 5: a[5] + b[5] };
}

export function totalFromCounts(counts: StarCounts): number {
  return counts[1] + counts[2] + counts[3] + counts[4] + counts[5];
}

// Illustrative "pot" rule from the sample monthly report: every 5★ review
// adds, every 1-3★ review subtracts, 4★ is neutral. Kept as a named
// constant (not scattered literals) so it's one place to change once a
// real rule is confirmed — this is still the example formula, not a
// finalized payroll/accounting rule.
export const POT_RULE = {
  fiveStarEur: 5,
  fourStarEur: 0,
  oneToThreeStarEur: -10,
};

export interface PotBreakdown {
  fiveStarEur: number;
  lowStarEur: number;
  netEur: number;
}

export function computePot(counts: StarCounts): PotBreakdown {
  const fiveStarEur = counts[5] * POT_RULE.fiveStarEur;
  const lowStarEur = (counts[1] + counts[2] + counts[3]) * POT_RULE.oneToThreeStarEur;
  return { fiveStarEur, lowStarEur, netEur: fiveStarEur + lowStarEur };
}

export function formatEur(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}€ ${Math.round(Math.abs(n))}`;
}
