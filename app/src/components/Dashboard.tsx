import { useState } from "react";
import { useDashboardData, type LocationFilter } from "../hooks/useDashboardData";
import { useLivePlacesSummary } from "../hooks/useLivePlacesSummary";
import { useLiveSearchViews } from "../hooks/useLiveSearchViews";
import { KpiRow } from "./KpiRow";
import { ReviewFeed } from "./ReviewFeed";
import { Sidebar } from "./Sidebar";
import { StatusStrip } from "./StatusStrip";
import { Topbar } from "./Topbar";
import { TrendChart } from "./TrendChart";
import { WeeklyLog } from "./WeeklyLog";
import styles from "./Dashboard.module.css";

export function Dashboard() {
  const [filter, setFilter] = useState<LocationFilter>("all");
  const liveSearchViews = useLiveSearchViews();
  const livePlaces = useLivePlacesSummary();
  const data = useDashboardData(filter, liveSearchViews.data, livePlaces.data);

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
            reviewCountIsLive={data.reviewCountIsLive}
            reviewCountCapped={data.reviewCountCapped}
            reviewCountDelta={data.reviewCountDelta}
            responseRatio={data.responseRatio}
            openCount={data.openCount}
            searchViewsTotal={data.searchViewsTotal}
            searchViewsDeltaPct={data.searchViewsDeltaPct}
          />

          <div className={styles.split}>
            <ReviewFeed reviews={data.reviews} showLocation={filter === "all"} />
            <TrendChart
              series={data.searchViewsSeries}
              locations={data.locations}
              total={data.searchViewsTotal}
              deltaPct={data.searchViewsDeltaPct}
              isLive={liveSearchViews.isLive}
            />
          </div>

          <WeeklyLog entries={data.logEntries} weekCount={data.logWeekCount} />
        </div>
      </div>
    </div>
  );
}
