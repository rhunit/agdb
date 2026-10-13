import { useState } from "react";
import { useDashboardData, type LocationFilter } from "../hooks/useDashboardData";
import { useLiveAllBusinessReviews } from "../hooks/useLiveAllBusinessReviews";
import { useLiveBusinessReviews } from "../hooks/useLiveBusinessReviews";
import { useLivePlacesReviewGrowth } from "../hooks/useLivePlacesReviewGrowth";
import { useLivePlacesSummary } from "../hooks/useLivePlacesSummary";
import { useWeeklyLog } from "../hooks/useWeeklyLog";
import { formatUpdatedAt } from "../lib/format";
import { AllReviews, type AllReviewsFilterRequest } from "./AllReviews";
import { BentoGrid } from "./BentoGrid";
import { CriticalReviewFeed } from "./CriticalReviewFeed";
import { LoadingState } from "./LoadingState";
import { LocationsOverview } from "./LocationsOverview";
import { ReviewFeed } from "./ReviewFeed";
import { Sidebar, type SidebarView } from "./Sidebar";
import { StatusStrip } from "./StatusStrip";
import { TestBanner } from "./TestBanner";
import { Topbar } from "./Topbar";
import { TrendChart } from "./TrendChart";
import { TrendContext } from "./TrendContext";
import { WeeklyLog } from "./WeeklyLog";
import { WeeklyUpdateForm } from "./WeeklyUpdateForm";
import { WeekSummary } from "./WeekSummary";
import styles from "./Dashboard.module.css";

export function Dashboard() {
  const [view, setView] = useState<SidebarView>("dashboard");
  const [filter, setFilter] = useState<LocationFilter>("all");
  const [allReviewsFilterRequest, setAllReviewsFilterRequest] =
    useState<AllReviewsFilterRequest | null>(null);
  const reviewGrowth = useLivePlacesReviewGrowth();
  const livePlaces = useLivePlacesSummary();
  const weeklyLog = useWeeklyLog();
  const businessReviews = useLiveBusinessReviews();
  const allBusinessReviews = useLiveAllBusinessReviews(view === "alle-reviews");
  const dashboardLoading =
    livePlaces.loading || businessReviews.loading || reviewGrowth.loading || weeklyLog.loading;
  const data = useDashboardData(
    filter,
    reviewGrowth.data,
    livePlaces.data,
    weeklyLog.entries,
    businessReviews.data,
  );

  return (
    <>
      <TestBanner />
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
                filterRequest={allReviewsFilterRequest}
              />
            </div>
          ) : (
            <>
              <Topbar
                selected={filter}
                onSelect={setFilter}
                updatedAt={formatUpdatedAt()}
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

                    <StatusStrip
                      reviewCount={data.reviewCount}
                      criticalCount={data.criticalCount}
                      oldestCriticalDaysAgo={data.oldestCriticalDaysAgo}
                      onViewCritical={
                        data.criticalCount > 0
                          ? () => {
                              setAllReviewsFilterRequest({ status: "open", ratings: [1, 2] });
                              setView("alle-reviews");
                            }
                          : undefined
                      }
                    />

                    <BentoGrid
                      avgScore={data.avgScore}
                      avgScoreIsLive={data.avgScoreIsLive}
                      avgScoreReviewCount={data.avgScoreReviewCount}
                      avgScoreDelta={data.avgScoreDelta}
                      reviewCount={data.reviewCount}
                      reviewCountDelta={data.reviewCountDelta}
                      statsAreLive={data.statsAreLive}
                      topRatedCount={data.topRatedCount}
                      topRatedCountDelta={data.topRatedCountDelta}
                      criticalCount={data.criticalCount}
                      criticalCountDelta={data.criticalCountDelta}
                      criticalResponseRatio={data.criticalResponseRatio}
                      openCriticalReviews={data.openCriticalReviews}
                    />

                    <div className={styles.split}>
                      <ReviewFeed
                        reviews={data.reviews}
                        showLocation={filter === "all"}
                        isLive={data.reviewsAreLive}
                      />
                      <CriticalReviewFeed
                        reviews={data.criticalFeedReviews}
                        showLocation={filter === "all"}
                        isLive={data.reviewsAreLive}
                      />
                    </div>

                    <div className={styles.split}>
                      <TrendChart
                        title="Nieuwe reviews per locatie"
                        series={data.reviewGrowthSeries}
                        locations={data.locations}
                        total={data.reviewGrowthTotal}
                        deltaPct={data.reviewGrowthDeltaPct}
                        isLive={reviewGrowth.isLive}
                      />
                      <TrendContext
                        avgScoreDelta={data.avgScoreDelta}
                        reviewCountDelta={data.reviewCountDelta}
                        logEntries={data.logEntries}
                      />
                    </div>

                    <WeeklyUpdateForm
                      isLive={weeklyLog.isLive}
                      submitting={weeklyLog.submitting}
                      submitError={weeklyLog.submitError}
                      onSubmit={weeklyLog.submit}
                    />

                    <WeeklyLog
                      entries={data.logEntries}
                      weekCount={data.logWeekCount}
                      isLive={weeklyLog.isLive}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
