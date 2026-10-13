import { formatDutchDecimal, formatDutchInt } from "./format";

export interface WeekSummaryInput {
  reviewCount: number;
  topRatedCount: number;
  criticalCount: number;
  avgScore: number;
  avgScoreDelta: number;
  avgScoreIsLive: boolean;
  avgScoreReviewCount: number;
  openCriticalCount: number;
}

/** Builds a plain-language, at-most-3-line recap from numbers the
 * dashboard already computed and displays elsewhere — no model call, so
 * it's free, instant, and can never say something the data doesn't
 * support. Each line maps 1:1 to a stat already shown in BentoGrid, so
 * this is a summary of the page, not a separate claim. */
export function buildWeekSummary(input: WeekSummaryInput): string[] {
  const lines: string[] = [];

  if (input.reviewCount === 0) {
    lines.push("Deze week kwamen er geen nieuwe reviews binnen.");
  } else {
    const breakdown: string[] = [];
    if (input.topRatedCount > 0) {
      breakdown.push(`${formatDutchInt(input.topRatedCount)} met 5 sterren`);
    }
    if (input.criticalCount > 0) {
      breakdown.push(`${formatDutchInt(input.criticalCount)} met 1–2 sterren`);
    }
    const suffix = breakdown.length > 0 ? `, waarvan ${breakdown.join(" en ")}` : "";
    lines.push(
      `Deze week kwamen er ${formatDutchInt(input.reviewCount)} nieuwe review${
        input.reviewCount === 1 ? "" : "s"
      } binnen${suffix}.`,
    );
  }

  // The live avgScore is a current snapshot, not something with a real
  // "vorige week" baseline to diff against (that delta only exists as a
  // mock fallback) — so when it's live, state the number itself rather
  // than a week-over-week claim the data can't actually back up.
  if (input.avgScoreIsLive) {
    lines.push(
      `De gemiddelde score staat op ${formatDutchDecimal(input.avgScore)}, gebaseerd op ${formatDutchInt(
        input.avgScoreReviewCount,
      )} Google-reviews.`,
    );
  } else if (input.avgScoreDelta > 0.05) {
    lines.push(
      `De gemiddelde score is ${formatDutchDecimal(
        Math.abs(input.avgScoreDelta),
      )} punt omhoog gegaan ten opzichte van vorige week, dus dat is positief.`,
    );
  } else if (input.avgScoreDelta < -0.05) {
    lines.push(
      `De gemiddelde score is ${formatDutchDecimal(
        Math.abs(input.avgScoreDelta),
      )} punt omlaag gegaan ten opzichte van vorige week, dus dat verdient aandacht.`,
    );
  } else {
    lines.push("De gemiddelde score is stabiel gebleven ten opzichte van vorige week.");
  }

  if (input.openCriticalCount > 0) {
    lines.push(
      `Er ${input.openCriticalCount === 1 ? "staat" : "staan"} nog ${formatDutchInt(
        input.openCriticalCount,
      )} kritieke review${input.openCriticalCount === 1 ? "" : "s"} open om op te reageren.`,
    );
  } else {
    lines.push("Alle kritieke reviews zijn beantwoord — geen actie nodig.");
  }

  return lines;
}
