import { useMemo, useState } from "react";
import { useDashboardData, type LocationFilter } from "../hooks/useDashboardData";
import { useLiveAllBusinessReviews } from "../hooks/useLiveAllBusinessReviews";
import { useLiveBusinessReviews } from "../hooks/useLiveBusinessReviews";
import { useLivePlacesReviewGrowth } from "../hooks/useLivePlacesReviewGrowth";
import { useLivePlacesSummary } from "../hooks/useLivePlacesSummary";
import { useRemovedReviews } from "../hooks/useRemovedReviews";
import { useReviewEdits } from "../hooks/useReviewEdits";
import { useWeeklyLog } from "../hooks/useWeeklyLog";
import { buildDashboardContext } from "../lib/aiChatContext";
import { rangeForPreset, type DateRange } from "../lib/dateRange";
import { formatUpdatedAt } from "../lib/format";
import { AiChatPanel } from "./AiChatPanel";
import { AllReviews } from "./AllReviews";
import { BentoGrid } from "./BentoGrid";
import { CriticalReviewFeed } from "./CriticalReviewFeed";
import { LoadingState } from "./LoadingState";
import { LocationsOverview } from "./LocationsOverview";
import { Rapportage } from "./Rapportage";
import { RatingBreakdown } from "./RatingBreakdown";
import { RemovedReviewsCard } from "./RemovedReviewsCard";
import { ReviewFeed } from "./ReviewFeed";
import { Sidebar, type SidebarView } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TrendChart } from "./TrendChart";
import { TrendContext } from "./TrendContext";
import { WeeklyLog } from "./WeeklyLog";
import { WeeklyUpdateForm } from "./WeeklyUpdateForm";
import { WeekSummary } from "./WeekSummary";
import styles from "./Dashboard.module.css";

// Temporarily hidden per request ("verberg deze tegels voor nu maar
// even") — the components themselves are untouched, flip back to true
// to bring them back.
const SHOW_REVIEW_GROWTH_CHART = false;
const SHOW_TREND_CONTEXT = false;
const SHOW_WEEKLY_UPDATE_FORM = false;
const SHOW_WEEKLY_LOG = false;

export function Dashboard() {
  const [view, setView] = useState<SidebarView>("dashboard");
  const [filter, setFilter] = useState<LocationFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeForPreset("7d"));
  const reviewGrowth = useLivePlacesReviewGrowth();
  const livePlaces = useLivePlacesSummary();
  const weeklyLog = useWeeklyLog();
  const businessReviews = useLiveBusinessReviews();
  // Also drives the dashboard's date-range-scoped stats below, not just
  // the "Alle reviews" page — so it's needed whenever that page or the
  // dashboard itself is showing, just not for "Locaties".
  const allBusinessReviews = useLiveAllBusinessReviews(view !== "locaties");
  // Both detected server-side by diffing against our own snapshots — see
  // server/src/reviewHistoryStore.ts for why this can only ever start
  // from the point that backend first ran.
  const reviewEdits = useReviewEdits(view !== "locaties");
  const removedReviews = useRemovedReviews(view !== "locaties");
  const dashboardLoading =
    livePlaces.loading || businessReviews.loading || reviewGrowth.loading || weeklyLog.loading;
  const data = useDashboardData(
    filter,
    dateRange,
    reviewGrowth.data,
    livePlaces.data,
    weeklyLog.entries,
    businessReviews.data,
    allBusinessReviews.data,
  );

  const removedForFilter = useMemo(() => {
    const locationSet = new Set(data.locations);
    return (removedReviews.removed ?? []).filter((r) => locationSet.has(r.location));
  }, [removedReviews.removed, data.locations]);

  // What the AI chat panel is told about — the same aggregate numbers
  // already on screen (WeekSummary/BentoGrid), not individual review
  // text, so it can answer "hoeveel reviews kwamen er binnen" accurately
  // without us sending customer review content to a third-party API on
  // every chat turn.
  const aiChatContext = useMemo(
    () =>
      buildDashboardContext(filter, dateRange, {
        reviewCount: data.reviewCount,
        reviewCountDelta: data.reviewCountDelta,
        avgScore: data.avgScore,
        avgScoreDelta: data.avgScoreDelta,
        avgScoreIsLive: data.avgScoreIsLive,
        topRatedCount: data.topRatedCount,
        topRatedCountDelta: data.topRatedCountDelta,
        criticalCount: data.criticalCount,
        criticalCountDelta: data.criticalCountDelta,
        openCriticalCount: data.openCriticalReviews.length,
      }),
    [filter, dateRange, data],
  );

  return (
    <>
      <div className={styles.shell}>
        <Sidebar active={view} onNavigate={setView} />
        <div className={styles.main}>
          {view === "locaties" ? (
            <div className={styles.content}>
              <LocationsOverview
                onSelect={(id) => {
                  setFilter(id);
                  setView("dashboard");
                }}
              />
            </div>
          ) : view === "alle-reviews" ? (
            <div className={styles.content}>
              <AllReviews
                reviewsByLocation={allBusinessReviews.data}
                isLive={allBusinessReviews.isLive}
                loading={allBusinessReviews.loading}
                edits={reviewEdits.edits}
                removed={removedReviews.removed}
              />
            </div>
          ) : view === "rapportage" ? (
            <div className={styles.content}>
              <Rapportage
                reviewsByLocation={allBusinessReviews.data}
                isLive={allBusinessReviews.isLive}
                loading={allBusinessReviews.loading}
                edits={reviewEdits.edits}
                removed={removedReviews.removed}
              />
            </div>
          ) : (
            <>
              <Topbar
                selected={filter}
                onSelect={setFilter}
                updatedAt={formatUpdatedAt()}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
              <div className={styles.content}>
                {dashboardLoading ? (
                  <LoadingState />
                ) : (
                  <>
                    <WeekSummary
                      reviewCount={data.reviewCount}
                      topRatedCount={data.topRatedCount}
                      criticalCount={data.criticalCount}
                      avgScore={data.avgScore}
                      avgScoreDelta={data.avgScoreDelta}
                      avgScoreIsLive={data.avgScoreIsLive}
                      avgScoreReviewCount={data.avgScoreReviewCount}
                      openCriticalCount={data.openCriticalReviews.length}
                    />

                    <BentoGrid
                      avgScore={data.avgScore}
                      avgScoreIsLive={data.avgScoreIsLive}
                      avgScoreReviewCount={data.avgScoreReviewCount}
                      avgScoreDelta={data.avgScoreDelta}
                      reviewCount={data.reviewCount}
                      reviewCountDelta={data.reviewCountDelta}
                      topRatedCount={data.topRatedCount}
                      topRatedCountDelta={data.topRatedCountDelta}
                      criticalCount={data.criticalCount}
                      criticalCountDelta={data.criticalCountDelta}
                      criticalResponseRatio={data.criticalResponseRatio}
                      openCriticalReviews={data.openCriticalReviews}
                    />

                    <RatingBreakdown
                      reviews={data.periodReviews}
                      loading={allBusinessReviews.loading}
                    />

                    <div className={styles.split}>
                      <ReviewFeed
                        reviews={data.reviews}
                        showLocation={filter === "all"}
                      />
                      <CriticalReviewFeed
                        reviews={data.criticalFeedReviews}
                        showLocation={filter === "all"}
                        edits={reviewEdits.edits}
                      />
                    </div>

                    <RemovedReviewsCard
                      removed={removedForFilter}
                      loading={removedReviews.loading}
                    />

                    {(SHOW_REVIEW_GROWTH_CHART || SHOW_TREND_CONTEXT) && (
                      <div className={styles.split}>
                        {SHOW_REVIEW_GROWTH_CHART && (
                          <TrendChart
                            title="Nieuwe reviews per locatie"
                            series={data.reviewGrowthSeries}
                            locations={data.locations}
                            total={data.reviewGrowthTotal}
                            deltaPct={data.reviewGrowthDeltaPct}
                          />
                        )}
                        {SHOW_TREND_CONTEXT && (
                          <TrendContext
                            avgScoreDelta={data.avgScoreDelta}
                            reviewCountDelta={data.reviewCountDelta}
                            logEntries={data.logEntries}
                          />
                        )}
                      </div>
                    )}

                    {SHOW_WEEKLY_UPDATE_FORM && (
                      <WeeklyUpdateForm
                        isLive={weeklyLog.isLive}
                        submitting={weeklyLog.submitting}
                        submitError={weeklyLog.submitError}
                        onSubmit={weeklyLog.submit}
                      />
                    )}

                    {SHOW_WEEKLY_LOG && (
                      <WeeklyLog
                        entries={data.logEntries}
                        weekCount={data.logWeekCount}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <AiChatPanel contextSummary={aiChatContext.summary} contextLabel={aiChatContext.label} />
    </>
  );
}
