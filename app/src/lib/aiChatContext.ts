import { LOCATION_TAB_LABEL } from "../config";
import type { LocationFilter } from "../hooks/useDashboardData";
import type { DateRange } from "./dateRange";
import { formatRangeLabel } from "./dateRange";
import { formatDutchDecimal, formatSignedDecimal } from "./format";
import type { LocationId } from "../types";

export interface DashboardStatsSnapshot {
  reviewCount: number;
  reviewCountDelta: number;
  avgScore: number;
  avgScoreDelta: number;
  avgScoreIsLive: boolean;
  topRatedCount: number;
  topRatedCountDelta: number;
  criticalCount: number;
  criticalCountDelta: number;
  openCriticalCount: number;
}

export interface DashboardContext {
  /** Full plain-text snapshot sent to the AI with each chat message. */
  summary: string;
  /** Short "period · location" label shown in the chat panel itself, so
   * it's clear to the person what the assistant can currently see. */
  label: string;
}

/** Plain-language snapshot of the stats currently on screen — sent along
 * with every AI chat message so it can answer things like "hoeveel
 * reviews zijn binnengekomen" grounded in the real numbers, instead of
 * guessing or claiming it can't see them. Deliberately just the
 * aggregate stats already shown on the dashboard (same ones in
 * WeekSummary/BentoGrid), not individual review text — keeps the prompt
 * small and avoids sending customer review content to a third-party API
 * on every chat turn. */
export function buildDashboardContext(
  filter: LocationFilter,
  dateRange: DateRange,
  stats: DashboardStatsSnapshot,
): DashboardContext {
  const locationLabel =
    filter === "all" ? "alle gekoppelde locaties" : LOCATION_TAB_LABEL[filter as LocationId];
  const periodLabel = formatRangeLabel(dateRange);

  const lines = [
    `Periode: ${periodLabel}. Locatie(s): ${locationLabel}.`,
    `Nieuwe reviews: ${stats.reviewCount} (${formatSignedDecimal(stats.reviewCountDelta, 0)} t.o.v. vorige periode).`,
    stats.avgScoreIsLive
      ? `Gemiddelde score: ${formatDutchDecimal(stats.avgScore)} (${formatSignedDecimal(stats.avgScoreDelta)} t.o.v. vorige periode).`
      : "Gemiddelde score: niet live beschikbaar voor deze selectie.",
    `Nieuwe 5★ reviews: ${stats.topRatedCount} (${formatSignedDecimal(stats.topRatedCountDelta, 0)} t.o.v. vorige periode).`,
    `Nieuwe 1-2★ (kritieke) reviews: ${stats.criticalCount} (${formatSignedDecimal(stats.criticalCountDelta, 0)} t.o.v. vorige periode), waarvan ${stats.openCriticalCount} nog onbeantwoord.`,
  ];
  return { summary: lines.join("\n"), label: `${periodLabel} · ${locationLabel}` };
}
