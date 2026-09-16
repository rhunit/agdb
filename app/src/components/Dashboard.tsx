import { useState } from "react";
import { useDashboardData, type LocationFilter } from "../hooks/useDashboardData";
import { useLivePlacesReviewGrowth } from "../hooks/useLivePlacesReviewGrowth";
import { useLivePlacesSummary } from "../hooks/useLivePlacesSummary";
import { useWeeklyLog } from "../hooks/useWeeklyLog";
import { KpiRow } from "./KpiRow";
import { ReviewFeed } from "./ReviewFeed";
import { Sidebar } from "./Sidebar";
import { StatusStrip } from "./StatusStrip";
import { Topbar } from "./Topbar";
import { TrendChart } from "./TrendChart";
import { WeeklyLog } from "./WeeklyLog";
import { WeeklyUpdateForm } from "./WeeklyUpdateForm";
import styles from "./Dashboard.module.css";

export function Dashboard() {
  const [filter, setFilter] = useState<LocationFilter>("all");
  const reviewGrowth = useLivePlacesReviewGrowth();
  const livePlaces = useLivePlacesSummary();
  const weeklyLog = useWeeklyLog();
  const data = useDashboardData(
    filter,
    reviewGrowth.data,
    livePlaces.data,
    weeklyLog.entries,
  );

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar
          selected={filter}
          onSelect={setFilter}
          updatedAt="08-09-2026 · 08:15"
        />
        <div className={styles.content}>
          <StatusStrip reviewCount={data.reviewCount} />

          <KpiRow
            avgScore={data.avgScore}
            avgScoreIsLive={data.avgScoreIsLive}
            avgScoreReviewCount={data.avgScoreReviewCount}
            avgScoreDelta={data.avgScoreDelta}
            reviewCount={data.reviewCount}
            reviewCountDelta={data.reviewCountDelta}
            responseRatio={data.responseRatio}
            openCount={data.openCount}
            topRatedCount={data.topRatedCount}
            criticalCount={data.criticalCount}
          />

          <div className={styles.split}>
            <ReviewFeed
              reviews={data.reviews}
              showLocation={filter === "all"}
              isLive={data.locations.some((id) => livePlaces.data?.[id] != null)}
            />
            <TrendChart
              title="Nieuwe reviews per locatie"
              series={data.reviewGrowthSeries}
              locations={data.locations}
              total={data.reviewGrowthTotal}
              deltaPct={data.reviewGrowthDeltaPct}
              isLive={reviewGrowth.isLive}
            />
          </div>

          <WeeklyUpdateForm
            isLive={weeklyLog.isLive}
            submitting={weeklyLog.submitting}
            submitError={weeklyLog.submitError}
            onSubmit={weeklyLog.submit}
          />

          <WeeklyLog entries={data.logEntries} weekCount={data.logWeekCount} />
        </div>
      </div>
    </div>
  );
}
